import { apiClient } from "./apiClient";
import type { ApproverMember, GraphUser, ApproverRoleCode } from "@/types/approverRoles";

export const approverService = {
  /**
   * Search Entra / Microsoft Graph directory users for autocomplete.
   */
  searchGraphUsers: async (query: string): Promise<GraphUser[]> => {
    if (!query || query.trim().length < 2) return [];
    try {
      return await apiClient.get<GraphUser[]>(`/api/graph/users/search?q=${encodeURIComponent(query.trim())}`);
    } catch (err) {
      console.warn("Graph search request error:", err);
      return [];
    }
  },

  /**
   * Fetch current members assigned to an approver role.
   */
  getRoleMembers: async (roleCode: ApproverRoleCode): Promise<ApproverMember[]> => {
    return await apiClient.get<ApproverMember[]>(`/api/approver-roles/${roleCode}/members`);
  },

  /**
   * Assign Entra users to an approver role (with pre-provisioning).
   */
  assignRoleMembers: async (
    roleCode: ApproverRoleCode,
    members: Array<{
      object_id: string;
      email: string;
      display_name?: string;
      job_title?: string;
      department?: string;
    }>
  ): Promise<ApproverMember[]> => {
    return await apiClient.post<ApproverMember[]>(`/api/approver-roles/${roleCode}/members`, members);
  },

  /**
   * Remove a user from an approver role.
   */
  removeRoleMember: async (roleCode: ApproverRoleCode, userId: string): Promise<{ status: string; user_id: string; role: string }> => {
    return await apiClient.delete<{ status: string; user_id: string; role: string }>(
      `/api/approver-roles/${roleCode}/members/${userId}`
    );
  },
};
