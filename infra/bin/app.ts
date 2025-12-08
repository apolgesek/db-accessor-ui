#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { StaticSiteStack } from '../lib/stack';

const app = new cdk.App();
new StaticSiteStack(app, 'StaticSiteStack', {
  // Synthesize with your preferred env; these default env vars are handy in CI
  env: {
    account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION,
  },
  stage: process.env.STAGE as 'dev' | 'prod',
  projectName: 'db-accessor-ui',
  siteBucketName: 'db-accessor-ui', // prefix for globally unique bucket name
  priceClass: 'PriceClass_100',
  // For a custom domain, uncomment both lines below (cert must be in us-east-1):
  // acmCertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  // alternateDomainName: 'app.example.com',
  githubOrg: 'apolgesek',
  githubRepo: 'db-accessor-ui',
});
