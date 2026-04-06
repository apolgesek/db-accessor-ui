import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface StaticSiteStackProps extends cdk.StackProps {
  siteBucketName: string;
  projectName?: string;
  priceClass?: 'PriceClass_100' | 'PriceClass_200' | 'PriceClass_All';

  /**
   * ACM certificate ARN in us-east-1 for custom domain (optional).
   */
  acmCertificateArn?: string;
  /**
   * Alternate domain name (e.g. app.example.com). Optional.
   */
  alternateDomainName?: string;
  existingGitHubOidcProviderArn?: string;
  githubOrg: string;
  githubRepo: string;
  stage: 'dev' | 'prod';

  /**
   * Only this viewer IP is allowed to access CloudFront.
   * Use a single IPv4/IPv6 literal (no CIDR).
   */
  allowedIp: string;
}

export class StaticSiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StaticSiteStackProps) {
    super(scope, id, props);
    const stack = cdk.Stack.of(this);
    const projectName = props.projectName + '-' + props.stage;
    const priceClass = props.priceClass ?? 'PriceClass_100';
    const useCustomDomain = !!props.acmCertificateArn && !!props.alternateDomainName;
    const ghOidcProviderArn = `arn:aws:iam::${stack.account}:oidc-provider/token.actions.githubusercontent.com`;

    // --- S3 bucket (private) ---
    const bucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: props.siteBucketName + '-' + props.stage,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    // --- CloudFront Origin Access Control (OAC) ---
    const oac = new cloudfront.CfnOriginAccessControl(this, 'OriginAccessControl', {
      originAccessControlConfig: {
        name: `${projectName}-oac`,
        description: `1OAC for ${projectName}`,
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    const ipAllowFunction = new cloudfront.CfnFunction(this, 'IpAllowFunction', {
      name: `${projectName}-allow-ip`,
      autoPublish: true,
      functionConfig: {
        comment: 'Allow only one white-listed IP',
        runtime: 'cloudfront-js-2.0',
      },
      functionCode: `function handler(event) {
        var request = event.request;
        var clientIp = request.clientIp;

        if (clientIp !== ${JSON.stringify(props.allowedIp)}) {
          return {
            statusCode: 403,
            statusDescription: 'Forbidden',
            headers: {'content-type': { value: 'text/plain; charset=utf-8' }},
            body: 'Forbidden'
          };
        }

        return request;
      }`,
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
          functionAssociations: [
            {
              eventType: 'viewer-request',
              functionArn: ipAllowFunction.attrFunctionArn,
            },
          ],
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
      tags: [{ key: 'test', value: 'true' }],
    });

    // --- Bucket policy: allow CloudFront to read (scoped to this distribution) ---
    const distributionArn = cdk.Arn.format(
      {
        service: 'cloudfront',
        region: '',
        resource: 'distribution',
        resourceName: distribution.attrId,
      },
      this,
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
      }),
    );

    // --- OIDC provider (imported) ---
    const oidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GitHubOidcProvider',
      ghOidcProviderArn,
    );

    // --- Federated principal for GitHub Actions ---
    const assumedBy = new iam.FederatedPrincipal(
      (oidcProvider as iam.OpenIdConnectProvider).openIdConnectProviderArn,
      {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub': `repo:${props.githubOrg}/${props.githubRepo}:*`,
        },
      },
      'sts:AssumeRoleWithWebIdentity',
    );

    // --- Runtime deploy role: S3 upload + CloudFront invalidation only ---
    const deployRole = new iam.Role(this, 'GitHubDeployRole', {
      roleName: `${projectName}-github-deploy`,
      assumedBy,
      description:
        'Role assumed by GitHub Actions to upload static assets and invalidate CloudFront',
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
      }),
    );

    // CloudFront invalidation on this distribution
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CFInvalidate',
        effect: iam.Effect.ALLOW,
        actions: ['cloudfront:CreateInvalidation'],
        resources: [distributionArn],
      }),
    );

    // --- CDK role: for cdk diff/deploy of this stack ---
    const cdkRole = new iam.Role(this, 'GitHubCdkRole', {
      roleName: `${projectName}-github-cdk`,
      assumedBy,
      description: 'Role assumed by GitHub Actions to run cdk diff/deploy for this stack',
    });

    // --- CDK bootstrap integration (assume bootstrap roles + read bootstrap version) ---
    const qualifier = 'hnb659fds'; // default CDK bootstrap qualifier

    const bootstrapVersionParamArn = stack.formatArn({
      service: 'ssm',
      resource: 'parameter',
      resourceName: `/cdk-bootstrap/${qualifier}/version`,
    });

    const filePublishingRoleArn = `arn:aws:iam::${stack.account}:role/cdk-${qualifier}-file-publishing-role-${stack.account}-${stack.region}`;
    const deployRoleArn = `arn:aws:iam::${stack.account}:role/cdk-${qualifier}-deploy-role-${stack.account}-${stack.region}`;
    const lookupRoleArn = `arn:aws:iam::${stack.account}:role/cdk-${qualifier}-lookup-role-${stack.account}-${stack.region}`;

    // Allow GitHubCdkRole to assume CDK bootstrap roles (assets, deploy, lookup)
    cdkRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AssumeCdkBootstrapRoles',
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [filePublishingRoleArn, deployRoleArn, lookupRoleArn],
      }),
    );

    // Allow reading the bootstrap stack version (CDK requires this)
    cdkRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ReadCdkBootstrapVersion',
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetParameter'],
        resources: [bootstrapVersionParamArn],
      }),
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
      description: 'ARN to use for app deploy in GitHub',
    });

    new cdk.CfnOutput(this, 'GitHubCdkRoleArn', {
      value: cdkRole.roleArn,
      description: 'ARN to use for CDK diff/deploy from GitHub',
    });
  }
}
