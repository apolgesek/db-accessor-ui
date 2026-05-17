export type RulesetOperator = 'BEGINS_WITH' | 'EQUALS';

export type RulesetRule = {
  path: string;
};

export type ActiveRulesetScope = {
  targetPk: string;
  pkOperator?: RulesetOperator;
  targetSk?: string;
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
  targetPk: string;
  pkOperator: RulesetOperator;
  targetSk?: string;
  skOperator?: RulesetOperator;
  version?: number;
};
