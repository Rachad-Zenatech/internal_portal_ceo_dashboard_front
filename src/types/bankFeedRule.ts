export interface RuleCondition {
  id?: number;
  rule_type: number;
  rule_type_name?: string;
  value: any;
  position?: number;
}

export interface RuleAction {
  id?: number;
  action_type: number;
  action_type_name?: string;
  value: any;
  position?: number;
}

export interface BankFeedRule {
  id: number;
  rule_name: string;
  is_and_rule: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  created_at: string;
}

export interface BankFeedRuleCreate {
  rule_name: string;
  is_and_rule: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export interface BankFeedRuleUpdate {
  rule_name?: string;
  is_and_rule?: boolean;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
}
