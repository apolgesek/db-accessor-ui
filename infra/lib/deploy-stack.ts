import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface DbAccessorUiDeployStackProps extends cdk.StackProps {
  projectName: string;
  siteBucketName: string;
  githubOrg: string;
  githubRepo: string;
  stage: 'dev' | 'prod';
}

export class DbAccessorUiDeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DbAccessorUiDeployStackProps) {
    super(scope, id, props);

    const stack = cdk.Stack.of(this);
    const projectName = `${props.projectName}-${props.stage}`;
    const qualifier = 'hnb659fds';
    const oidcProviderArn = `arn:aws:iam::${stack.account}:oidc-provider/token.actions.githubusercontent.com`;
    const ssmParameterArn = (parameterName: string) =>
      stack.formatArn({
        service: 'ssm',
        resource: 'parameter',
        resourceName: parameterName.replace(/^\//, ''),
      });
    const bucket = s3.Bucket.fromBucketName(
      this,
      `${projectName}-ui-bucket`,
      `${props.siteBucketName}-${props.stage}`,
    );

    const oidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GitHubOidcProvider',
      oidcProviderArn,
    );

    const assumedBy = new iam.FederatedPrincipal(
      oidcProvider.openIdConnectProviderArn,
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

    const deployRole = new iam.Role(this, 'GitHubDeployRole', {
      roleName: `${projectName}-github-deploy`,
      assumedBy,
      description:
        'Role assumed by GitHub Actions to upload static assets and invalidate CloudFront',
    });
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
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudFrontInvalidate',
        effect: iam.Effect.ALLOW,
        actions: ['cloudfront:CreateInvalidation'],
        resources: [`arn:${stack.partition}:cloudfront::${stack.account}:distribution/*`],
      }),
    );
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ReadDeploymentTargets',
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetParameter'],
        resources: [
          ssmParameterArn(`/db-accessor-ui-${props.stage}/static-site/bucket-name`),
          ssmParameterArn(`/db-accessor-infra-${props.stage}/cloudfront/distribution-id`),
        ],
      }),
    );

    const cdkRole = new iam.Role(this, 'GitHubCdkRole', {
      roleName: `${projectName}-github-cdk`,
      assumedBy,
      description: 'Role assumed by GitHub Actions to run cdk diff/deploy for this app',
    });

    const bootstrapVersionParamArn = ssmParameterArn(`/cdk-bootstrap/${qualifier}/version`);

    const filePublishingRoleArn = `arn:aws:iam::${stack.account}:role/cdk-${qualifier}-file-publishing-role-${stack.account}-${stack.region}`;
    const deployRoleArn = `arn:aws:iam::${stack.account}:role/cdk-${qualifier}-deploy-role-${stack.account}-${stack.region}`;
    const lookupRoleArn = `arn:aws:iam::${stack.account}:role/cdk-${qualifier}-lookup-role-${stack.account}-${stack.region}`;

    cdkRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AssumeCdkBootstrapRoles',
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [filePublishingRoleArn, deployRoleArn, lookupRoleArn],
      }),
    );
    cdkRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ReadCdkBootstrapVersion',
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetParameter'],
        resources: [bootstrapVersionParamArn],
      }),
    );

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
