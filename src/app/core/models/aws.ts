export type AwsAccount = {
  id: string;
  name: string;
  email: string;
};

export type AwsRegion = {
  code: string;
  longName: string;
};

export type AwsAccountsResponse = {
  accounts: AwsAccount[];
  regions: AwsRegion[];
};

export type DynamoDbTable = {
  name: string;
  pk: string;
  sk?: string;
};

export type ConfiguredDynamoDbTable = DynamoDbTable & {
  accountId: string;
  region: string;
  createdAt: string;
  createdBy?: string;
  piiDetectionEnabled: boolean;
};

export type CreateConfiguredDynamoDbTablePayload = {
  accountId: string;
  region: string;
  table: string;
};

export type UpdatePiiDetectionPayload = {
  accountId: string;
  region: string;
  table: string;
  enabled: boolean;
};

export type UpdatePiiDetectionResponse = {
  accountId: string;
  region: string;
  table: string;
  piiDetectionEnabled: boolean;
  updatedAt: string;
};
