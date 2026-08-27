import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { approverService } from "@/services/approverService";
import type { ApproverRoleCode } from "@/types/approverRoles";
import { toast } from "sonner";

export function useApproverRoleMembers(roleCode: ApproverRoleCode) {
  return useQuery({
    queryKey: ["approverRoleMembers", roleCode],
    queryFn: () => approverService.getRoleMembers(roleCode),
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useGraphUserSearch(query: string) {
  return useQuery({
    queryKey: ["graphUserSearch", query],
    queryFn: () => approverService.searchGraphUsers(query),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useAssignApproverMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roleCode,
      members,
    }: {
      roleCode: ApproverRoleCode;
      members: Array<{
        object_id: string;
        email: string;
        display_name?: string;
        job_title?: string;
        department?: string;
      }>;
    }) => {
      return approverService.assignRoleMembers(roleCode, members);
    },
    onSuccess: (_data, variables) => {
      const roleLabel = variables.roleCode === "HIGH_LEVEL_APPROVER" ? "High-Level (Executive)" : "Low-Level (Manager)";
      toast.success(`Successfully assigned approver(s) to ${roleLabel} tier`, {
        description: `Pre-provisioning and workflow routing sync completed.`,
      });
      queryClient.invalidateQueries({ queryKey: ["approverRoleMembers", variables.roleCode] });
      queryClient.invalidateQueries({ queryKey: ["approverRoleMembers"] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || "Failed to assign approver";
      toast.error(`Assignment failed: ${msg}`);
    },
  });
}

export function useRemoveApproverMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roleCode,
      userId,
    }: {
      roleCode: ApproverRoleCode;
      userId: string;
      userName?: string;
    }) => {
      return approverService.removeRoleMember(roleCode, userId);
    },
    onSuccess: (_data, variables) => {
      const name = variables.userName || "User";
      const roleLabel = variables.roleCode === "HIGH_LEVEL_APPROVER" ? "High-Level Approvers" : "Low-Level Approvers";
      toast.success(`${name} removed from ${roleLabel}`, {
        description: "Pending requests automatically re-routed to remaining role members.",
      });
      queryClient.invalidateQueries({ queryKey: ["approverRoleMembers", variables.roleCode] });
      queryClient.invalidateQueries({ queryKey: ["approverRoleMembers"] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || "Failed to remove approver";
      toast.error(`Removal failed: ${msg}`);
    },
  });
}
