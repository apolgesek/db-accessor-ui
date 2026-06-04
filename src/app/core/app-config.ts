export type AppAuthConfig = {
  authority: string;
  clientId: string;
  scope?: string;
  identityProviderName?: string;
};

export type AppConfig = {
  version: string;
  apiUrl: string;
  webSocketUrl: string;
  storagePrefix?: string;
  auth: AppAuthConfig;
};
