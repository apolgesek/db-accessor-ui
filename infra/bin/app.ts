#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { StaticSiteStack } from '../lib/stack';

const app = new cdk.App();
new StaticSiteStack(app, 'StaticSiteStack', {
  // Synthesize with your preferred env; these default env vars are handy in CI
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'eu-central-1',
  },

  projectName: 'db-accessor-ui-dev',
  siteBucketName: 'db-accessor-ui-dev', // must be globally unique
  priceClass: 'PriceClass_100',
  // For a custom domain, uncomment both lines below (cert must be in us-east-1):
  // acmCertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  // alternateDomainName: 'app.example.com',

  createGitHubOidcProvider: false,
  existingGitHubOidcProviderArn:
    'arn:aws:iam::058264309711:oidc-provider/token.actions.githubusercontent.com',

  githubOrg: 'apolgesek',
  githubRepo: 'db-accessor-ui',
});
