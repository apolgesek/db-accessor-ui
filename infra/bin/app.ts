#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { DbAccessorUiDeployStack } from '../lib/deploy-stack';
import { DbAccessorUiStack } from '../lib/stack';

const app = new cdk.App();
const env = {
  account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION,
};
const stage = process.env.STAGE as 'dev' | 'prod';
const projectName = 'db-accessor-ui';
const siteBucketName = 'db-accessor-ui';
const githubOrg = 'apolgesek';
const githubRepo = 'db-accessor-ui';

new DbAccessorUiDeployStack(app, `${projectName}-deploy-stack`, {
  env,
  stage,
  projectName,
  siteBucketName,
  githubOrg,
  githubRepo,
});

new DbAccessorUiStack(app, `${projectName}-stack`, {
  env,
  stage,
  projectName,
  siteBucketName,
});
