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
  pK: string;
  sK?: string;
};
