import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface StaticSiteStackProps extends cdk.StackProps {
  /**
   * Globally unique bucket name (no uppercase/underscores).
   */
  siteBucketName: string;

  /**
   * Project name used for resource naming.
   * @default 'angular-cdn-prod'
   */
  projectName?: string;

  /**
   * Price class for CloudFront.
   * @default 'PriceClass_100'
   */
  priceClass?: 'PriceClass_100' | 'PriceClass_200' | 'PriceClass_All';

  /**
   * ACM certificate ARN in us-east-1 for custom domain (optional).
   */
  acmCertificateArn?: string;

  /**
   * Alternate domain name (e.g. app.example.com). Optional.
   */
  alternateDomainName?: string;

  /**
   * Existing OIDC provider ARN if not creating a new one.
   */
  existingGitHubOidcProviderArn?: string;

  /**
   * GitHub organization (owner).
   */
  githubOrg: string;

  /**
   * GitHub repository name.
   */
  githubRepo: string;
}

export class StaticSiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StaticSiteStackProps) {
    super(scope, id, props);

    const projectName = props.projectName ?? 'angular-cdn-prod';
    const priceClass = props.priceClass ?? 'PriceClass_100';
    const useCustomDomain = !!props.acmCertificateArn && !!props.alternateDomainName;

    // --- S3 bucket (private) ---
    const bucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: props.siteBucketName,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    // --- CloudFront Origin Access Control (OAC) ---
    const oac = new cloudfront.CfnOriginAccessControl(this, 'OriginAccessControl', {
      originAccessControlConfig: {
        name: `${projectName}-oac`,
        description: `OAC forsa ${projectName}`,
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    // --- CloudFront Distribution (L1 to wire OAC explicitly) ---
    const distribution = new cloudfront.CfnDistribution(this, 'CloudFrontDistribution', {
      distributionConfig: {
        enabled: true,
        httpVersion: 'http2and3',
        priceClass,
        defaultRootObject: 'index.html',
        aliases: useCustomDomain ? [props.alternateDomainName!] : undefined,
        origins: [
          {
            id: 's3-site',
            domainName: bucket.bucketRegionalDomainName,
            s3OriginConfig: {}, // required for S3 origins
            originAccessControlId: oac.attrId,
          },
        ],
        defaultCacheBehavior: {
          targetOriginId: 's3-site',
          viewerProtocolPolicy: 'redirect-to-https',
          allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
          compress: true,
          // AWS Managed: CachingOptimized
          cachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
        },
        customErrorResponses: [
          { errorCode: 403, responseCode: 200, responsePagePath: '/index.html' },
          { errorCode: 404, responseCode: 200, responsePagePath: '/index.html' },
        ],
        viewerCertificate: useCustomDomain
          ? {
              acmCertificateArn: props.acmCertificateArn!,
              sslSupportMethod: 'sni-only',
              minimumProtocolVersion: 'TLSv1.2_2021',
            }
          : { cloudFrontDefaultCertificate: true },
      },
    });

    // --- Bucket policy: allow CloudFront to read (scoped to this distribution) ---
    const distributionArn = cdk.Arn.format(
      {
        service: 'cloudfront',
        region: '',
        resource: 'distribution',
        resourceName: distribution.attrId,
      },
      this
    );

    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudFrontRead',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        actions: ['s3:GetObject'],
        resources: [bucket.arnForObjects('*')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': distributionArn,
          },
        },
      })
    );

    const oidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GitHubOidcProvider',
      props.existingGitHubOidcProviderArn!
    );

    // --- IAM role for GitHub Actions (OIDC) ---
    const assumedBy = new iam.FederatedPrincipal(
      // Works for both created and imported providers
      (oidcProvider as iam.OpenIdConnectProvider).openIdConnectProviderArn ??
        props.existingGitHubOidcProviderArn!,
      {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub': `repo:${props.githubOrg}/${props.githubRepo}:*`,
        },
      },
      'sts:AssumeRoleWithWebIdentity'
    );

    const deployRole = new iam.Role(this, 'GitHubDeployRole', {
      roleName: `${projectName}-github-deploy`,
      assumedBy,
      // inline policy below
    });

    // S3 write + list for the target bucket
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'S3Write',
        effect: iam.Effect.ALLOW,
        actions: [
          's3:PutObject',
          's3:PutObjectAcl',
          's3:DeleteObject',
          's3:ListBucket',
          's3:GetBucketLocation',
          's3:AbortMultipartUpload',
          's3:ListBucketMultipartUploads',
        ],
        resources: [bucket.bucketArn, bucket.arnForObjects('*')],
      })
    );

    // CloudFront invalidation on this distribution
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CFInvalidate',
        effect: iam.Effect.ALLOW,
        actions: ['cloudfront:CreateInvalidation'],
        resources: [distributionArn],
      })
    );

    // ARN of THIS stack for CloudFormation permissions
    const thisStackArn = cdk.Stack.of(this).formatArn({
      service: 'cloudformation',
      resource: 'stack',
      resourceName: `${cdk.Stack.of(this).stackName}/*`,
    });

    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CDKLookup',
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudformation:DescribeStacks',
          'cloudformation:DescribeStackResources',
          'cloudformation:GetTemplate',
          'cloudformation:GetTemplateSummary',
          'cloudformation:ListStackResources',
        ],
        resources: [thisStackArn],
      })
    );

    // --- Outputs (for wiring into GitHub Actions repo variables) ---
    new cdk.CfnOutput(this, 'SiteBucketNameOut', {
      value: bucket.bucketName,
      description: 'Site bucket name',
    });

    new cdk.CfnOutput(this, 'SiteBucketDomainName', {
      value: bucket.bucketRegionalDomainName,
      description: 'Regional S3 domain for the origin',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.attrId,
      description: 'CloudFront distribution ID',
    });

    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: distribution.attrDomainName,
      description: 'CloudFront domain name',
    });

    new cdk.CfnOutput(this, 'GitHubDeployRoleArn', {
      value: deployRole.roleArn,
      description: 'ARN to use as AWS_ROLE_TO_ASSUME_ARN in GitHub',
    });
  }
}
