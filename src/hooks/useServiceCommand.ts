import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

export type CommandStatus = "QUEUED" | "DISPATCHED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export interface ServiceCommandResult {
  command_id: string;
  target_service: string;
  resource_type: string;
  resource_id: string;
  command_type: string;
  status: CommandStatus;
  message?: string;
  failure_code?: string;
  failure_message?: string;
  retryable?: boolean;
}

export interface SubmitCommandOptions {
  targetService: string;
  resourceType: string;
  resourceId: string;
  commandType: string;
  payload?: Record<string, any>;
  idempotencyKey?: string;
}

export function useServiceCommand() {
  const [activeCommand, setActiveCommand] = useState<ServiceCommandResult | null>(null);

  const mutation = useMutation({
    mutationFn: async (opts: SubmitCommandOptions): Promise<ServiceCommandResult> => {
      const idKey = opts.idempotencyKey || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined);

      let url = "";
      if (opts.targetService === "administration" && opts.resourceType === "request") {
        url = "/approvals/" + opts.resourceId + "/action";
      } else if (opts.targetService === "administration" && opts.resourceType === "approver_role") {
        url = "/approver-roles/" + opts.resourceId + "/members";
      } else if (opts.targetService === "ma" && opts.resourceType === "deal") {
        url = "/ma/deals/" + opts.resourceId + "/transition";
      } else {
        url = "/approvals/" + opts.resourceId + "/action";
      }

      const headers: Record<string, string> = {};
      if (idKey) {
        headers["Idempotency-Key"] = idKey;
      }

      const res = await apiClient.post<ServiceCommandResult>(url, opts.payload || {}, { headers });
      return res;
    },
    onSuccess: (data) => {
      setActiveCommand(data);
    },
  });

  return {
    submitCommand: mutation.mutateAsync,
    isLoading: mutation.isPending,
    activeCommand,
    error: mutation.error,
  };
}

export function useApproveRequest() {
  const { submitCommand, isLoading, activeCommand, error } = useServiceCommand();

  const approve = useCallback(
    async (requestId: string, note?: string) => {
      return await submitCommand({
        targetService: "administration",
        resourceType: "request",
        resourceId: requestId,
        commandType: "APPROVE_REQUEST",
        payload: { action: "APPROVE", note },
      });
    },
    [submitCommand]
  );

  return { approve, isLoading, activeCommand, error };
}

export function useRejectRequest() {
  const { submitCommand, isLoading, activeCommand, error } = useServiceCommand();

  const reject = useCallback(
    async (requestId: string, note?: string) => {
      return await submitCommand({
        targetService: "administration",
        resourceType: "request",
        resourceId: requestId,
        commandType: "REJECT_REQUEST",
        payload: { action: "REJECT", note },
      });
    },
    [submitCommand]
  );

  return { reject, isLoading, activeCommand, error };
}

export function useTransitionDeal() {
  const { submitCommand, isLoading, activeCommand, error } = useServiceCommand();

  const transitionDeal = useCallback(
    async (dealId: string, stage: string, note?: string) => {
      return await submitCommand({
        targetService: "ma",
        resourceType: "deal",
        resourceId: dealId,
        commandType: "TRANSITION_DEAL_STAGE",
        payload: { deal_id: dealId, stage, note },
      });
    },
    [submitCommand]
  );

  return { transitionDeal, isLoading, activeCommand, error };
}
