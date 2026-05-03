export type RulesetOperator = 'BEGINS_WITH' | 'EQUALS';

export type RulesetRule = {
  path: string;
};

export type ActiveRulesetScope = {
  targetPK: string;
  pkOperator?: RulesetOperator;
  targetSK?: string;
  skOperator?: RulesetOperator;
  ruleset: RulesetRule[];
  updatedAt: string;
  version?: number;
};

export type ActiveRulesetResponse = {
  accountId: string;
  region: string;
  table: string;
  updatedAt: string | null;
  activeRulesets: Record<string, ActiveRulesetScope>;
};

export type CreateRulesetRequestPayload = {
  accountId: string;
  region: string;
  table: string;
  ruleset: RulesetRule[];
  targetPK: string;
  pkOperator: RulesetOperator;
  targetSK?: string;
  skOperator?: RulesetOperator;
  version?: number;
};
