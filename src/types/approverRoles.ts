export interface ApproverMember {
  user_id: string;
  email: string;
  display_name?: string | null;
  job_title?: string | null;
  department?: string | null;
  is_provisioned: boolean;
}

export interface GraphUser {
  object_id: string;
  display_name: string;
  email: string;
  job_title?: string;
  department?: string;
  user_principal_name?: string;
}

export type ApproverRoleCode = "HIGH_LEVEL_APPROVER" | "LOW_LEVEL_APPROVER";

export interface ApproverRoleMeta {
  code: ApproverRoleCode;
  name: string;
  tier: "EXECUTIVE" | "MANAGER";
  threshold: string;
  thresholdSubtitle: string;
  description: string;
  color: string;
}
