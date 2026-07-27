export type XgboostAccountDistribution = {
  account_number: string;
  account_name?: string | null;
  training_rows: number;
  share: number;
};

export type XgboostFeatureImportance = {
  feature: string;
  importance: number;
};

export type XgboostTrainingExample = {
  source_row: number;
  vendor: string;
  name: string;
  company_name: string;
  amount: number;
  memo: string;
  description: string;
  current_account_number: string;
  current_account_name: string;
  current_account_type: string;
  approved_account: string;
};

export type XgboostTrainingExamples = {
  account_number: string;
  account_name?: string | null;
  total: number;
  limit: number;
  offset: number;
  examples: XgboostTrainingExample[];
};

export type XgboostTreeNode = {
  id: number;
  depth: number;
  type: "split" | "leaf";
  feature: string | null;
  threshold: number | null;
  leaf_score: number | null;
  gain: number | null;
  cover: number;
};

export type XgboostTreeEdge = {
  source: number;
  target: number;
  branch: "yes" | "no" | "child";
  is_missing_default: boolean;
};

export type XgboostModelTree = {
  tree_index: number;
  tree_count: number;
  boosting_round: number;
  class_index: number;
  account_number: string;
  max_depth: number;
  nodes: XgboostTreeNode[];
  edges: XgboostTreeEdge[];
};

export type XgboostTransactionInput = { vendor?: string; description?: string; amount?: number | null };
export type XgboostTrainingAccountEvidence = { account_number: string; account_name?: string | null; training_rows: number };
export type XgboostTransactionExplanation = {
  input: XgboostTransactionInput;
  normalized_vendor_signature: string;
  prediction: { predicted_account: string; confidence: number; model_confidence?: number | null; support_confidence?: number | null; reason: string; requires_ai_review: boolean; requires_manual_review: boolean; review_suggestion?: Record<string, unknown> | null };
  suggested_account: string | null;
  suggested_account_name?: string | null;
  exact_vendor_training_rows: number;
  exact_training_accounts: XgboostTrainingAccountEvidence[];
  vendor_was_trained_to_suggestion: boolean;
  training_conflict: boolean;
  top_candidates: Array<{ account: string; account_name?: string | null; confidence: number; account_training_rows: number; vendor_account_training_rows: number }>;
  closest_training_signatures: Array<{ signature: string; similarity: number; training_rows: number; accounts: XgboostTrainingAccountEvidence[] }>;
  active_features: Array<{ feature: string; value: number }>;
  strongest_tree_contributions: Array<{ tree_index: number; boosting_round: number; leaf_id: number; leaf_score: number; cover: number }>;
};

export type XgboostModelStatus = {
  xgboost_installed: boolean;
  model_loaded: boolean;
  label_mapping_present: boolean;
  metadata_present: boolean;
  model_path: string;
  labels_path: string;
  metadata_path: string;
  model_updated_at: string | null;
  model_size_bytes: number | null;
  training_summary: {
    training_rows: number;
    class_count: number;
    known_vendor_count: number;
    feature_count: number;
    feature_version: string | null;
  };
  account_distribution: XgboostAccountDistribution[];
  feature_importance: XgboostFeatureImportance[];
  tree_summary: {
    tree_count: number;
    boosting_round_count: number;
    account_class_count: number;
    default_tree_index: number;
    account_classes: Array<{ class_index: number; account_number: string; account_name?: string | null }>;
  };
  support_thresholds: {
    min_account_support_for_auto: number;
    min_vendor_support_for_auto: number;
    low_support_confidence_cap: number;
  };
  training_quality?: {
    activated: boolean;
    decision: "activated" | "rejected_kept_active_model" | string;
    gate_reasons: string[];
    rows_per_ai_chunk: number;
    coverage: {
      reviewed_vendor_count: number;
      reviewed_vendors_covered: number;
      reviewed_vendor_coverage: number;
      vendors_with_consistent_account_support: number;
      accounts_with_minimum_support: number;
      accounts_below_minimum_support: number;
    };
    candidate_validation: XgboostQualityMetrics;
    active_validation: XgboostQualityMetrics;
    candidate_review_impact: XgboostQualityMetrics;
    active_review_impact: XgboostQualityMetrics;
  } | null;
  cumulative_training?: {
    previous_rows: number;
    submitted_rows: number;
    cumulative_rows: number;
    deduplicated_rows: number;
    replaced_conflicting_transactions: number;
  } | null;
};

export type XgboostQualityMetrics = {
  rows: number;
  accuracy: number | null;
  mean_confidence: number | null;
  resolved_rows: number;
  predicted_unresolved_rows: number;
  expected_ai_chunks: number;
};
