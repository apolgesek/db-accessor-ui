export type PiiEntityType =
  | 'PERSON'
  | 'EMAIL_ADDRESS'
  | 'PHONE_NUMBER'
  | 'DATE_OF_BIRTH'
  | 'ADDRESS'
  | 'POSTAL_CODE'
  | 'CREDIT_CARD'
  | 'IBAN_CODE'
  | 'IP_ADDRESS';

export type PiiRulesetSuggestion = {
  path: string;
  confidence: number;
  observedRecordCount: number;
  detectedRecordCount: number;
  detections: {
    entityType: PiiEntityType;
    confidence: number;
    detectedRecordCount: number;
    evidence: {
      source: 'PATH_RULE' | 'VALUE_VALIDATOR';
      ruleId: string;
      confidence: number;
    }[];
  }[];
};

export type PiiSuggestionsResponse = {
  version: 1;
  accountId: string;
  region: string;
  table: string;
  piiDetectionEnabled: boolean;
  latestScan: {
    scanId: string;
    trigger: 'ENABLED' | 'SCHEDULED';
    status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
    requestedAt: string;
    startedAt?: string;
    completedAt?: string;
    sampledItemCount?: number;
    failureCode?: string;
  } | null;
  suggestionsGeneratedAt: string | null;
  totalSuggestionCount: number;
  suggestionsTruncated: boolean;
  suggestions: PiiRulesetSuggestion[];
};
