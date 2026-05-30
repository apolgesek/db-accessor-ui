import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface DbAccessorUiStackProps extends cdk.StackProps {
  siteBucketName: string;
  projectName: string;
  stage: 'dev' | 'prod';
}

export class DbAccessorUiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DbAccessorUiStackProps) {
    super(scope, id, props);

    const projectName = `${props.projectName}-${props.stage}`;

    const bucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: `${props.siteBucketName}-${props.stage}`,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: props.stage === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: props.stage === 'dev',
    });

    new ssm.StringParameter(this, 'SiteBucketNameParameter', {
      parameterName: `/${projectName}/static-site/bucket-name`,
      stringValue: bucket.bucketName,
    });
    new ssm.StringParameter(this, 'SiteBucketRegionalDomainNameParameter', {
      parameterName: `/${projectName}/static-site/bucket-regional-domain-name`,
      stringValue: bucket.bucketRegionalDomainName,
    });

    new cdk.CfnOutput(this, 'SiteBucketNameOut', {
      value: bucket.bucketName,
      description: 'Site bucket name',
    });
    new cdk.CfnOutput(this, 'SiteBucketDomainName', {
      value: bucket.bucketRegionalDomainName,
      description: 'Regional S3 domain for the shared CloudFront origin',
    });
  }
}
