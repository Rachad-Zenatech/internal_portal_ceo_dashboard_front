import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { apiClient } from "@/services/apiClient";
import { useCeoRealtimeStream } from "@/hooks/useCeoRealtimeStream";
import { useServiceStatus } from "@/lib/ServiceStatusContext";
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Check,
  X,
  Search,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Lock,
  WifiOff,
} from "lucide-react";
import { AssignApproversModal } from "@/components/Administration/AssignApproversModal";
import { WidgetErrorBoundary } from "@/components/common/WidgetErrorBoundary";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getEnv } from "@/lib/env";
import { useApproverRoleMembers } from "@/hooks/useApproverRoles";
import { KpiCard, formatMoney } from "@/components/Dashboard/KpiCard";

interface PurchaseRequestLineItem {
  id?: string | number;
  description?: string;
  item_name?: string;
  product_name?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
  total_price?: number;
  item_url?: string;
  converted_unit_price?: number | null;
  converted_total?: number | null;
  original_unit_price?: number | null;
  original_total?: number | null;
  original_currency?: string | null;
}

interface PurchaseRequest {
  id: string;
  department?: string;
  amount: number;
  status: string;
  description?: string;
  product_name?: string;
  priority?: string;
  requester_name?: string;
  created_at: string;
  gl_code?: string;
  currency?: string;
  original_currency?: string | null;
  original_amount?: number | null;
  exchange_rate?: number | null;
  is_converted?: boolean;
  item_url?: string;
  product_info?: {
    vendor?: string;
    preferred_vendor?: string;
    specs?: string;
    delivery_date?: string;
    model?: string;
    warranty?: string;
  };
  vendor?: string;
  items?: PurchaseRequestLineItem[];
  item_mode?: "SINGLE" | "MULTIPLE";
  quantity?: number;
  unit_price?: number;
  quote_data?: any;
  request_type?: string;
  assigned_user?: string;
  hold_reason?: string;
  approved_at?: string;
  note?: string;
  request_date?: string;
  payment_method?: string | null;
  // After-tax amount decided by the Administration server
  amount_after_tax?: number | null;
  tax_rate?: number | null;
  tax_source?: "routing" | "default" | string | null;
  level_1_approver_name?: string | null;
  level_1_approved_at?: string | null;
  level_1_comment?: string | null;
  level_2_approver_name?: string | null;
  level_2_approved_at?: string | null;
  requires_second_level?: boolean;
  // Present on the detail response (merged in from the Administration request detail)
  purchase_order?: { payment_method?: string | null; vendor?: string | null; shipped_to_location?: string | null } | null;
  invoice?: { actual_cost_after_tax?: number | null } | null;
  wire_transfer?: unknown;
  rawReq?: any;
  attachments?: Array<{
    name: string;
    url: string;
    size?: string;
  }>;
}

function formatUsd(amount: number): string {
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return isNeg ? `-$${formatted}` : `$${formatted}`;
}

function formatForeignCurrency(amount: number, currency: string): string {
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return isNeg ? `-${currency} ${formatted}` : `${currency} ${formatted}`;
}

interface CurrencyInfo {
  isConverted: boolean;
  usdAmount: number;
  origAmount: number | null;
  origCurrency: string | null;
  exchangeRate: number | null;
}

function getRequestCurrencyInfo(req?: PurchaseRequest | null): CurrencyInfo {
  if (!req) {
    return { isConverted: false, usdAmount: 0, origAmount: null, origCurrency: null, exchangeRate: null };
  }

  const rawAmount = Number(req.amount) || 0;
  const quoteData = req.quote_data;
  const conv = quoteData?.conversion;

  let isConverted = Boolean(req.is_converted);
  let origCurrency: string | null = req.original_currency || null;
  let origAmount: number | null = req.original_amount !== undefined && req.original_amount !== null ? Number(req.original_amount) : null;
  let exchangeRate: number | null = req.exchange_rate !== undefined && req.exchange_rate !== null ? Number(req.exchange_rate) : null;
  let usdAmount = rawAmount;

  if (conv) {
    if (conv.is_converted || (conv.original_currency && conv.original_currency !== "USD")) {
      isConverted = true;
    }
    if (!origCurrency) {
      origCurrency = conv.original_currency || quoteData?.currency || null;
    }
    if (exchangeRate === null && conv.exchange_rate !== undefined && conv.exchange_rate !== null) {
      exchangeRate = Number(conv.exchange_rate);
    }
    if (origAmount === null) {
      const tot = conv.original_total ?? conv.original_subtotal;
      if (tot !== undefined && tot !== null) origAmount = Number(tot);
    }
    if (conv.converted_total !== undefined && conv.converted_total !== null) {
      usdAmount = Number(conv.converted_total);
    }
  }

  if (!isConverted && req.description) {
    const descMatch = req.description.match(/Original:\s*([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\s*@\s*Rate\s*([\d.]+)/i);
    if (descMatch) {
      isConverted = true;
      if (!origCurrency) origCurrency = descMatch[1].toUpperCase();
      if (origAmount === null) origAmount = parseFloat(descMatch[2].replace(/,/g, ''));
      if (exchangeRate === null) exchangeRate = parseFloat(descMatch[3]);
    }
  }

  if (!isConverted && req.currency && req.currency !== "USD") {
    isConverted = true;
    if (!origCurrency) origCurrency = req.currency;
    if (origAmount === null) origAmount = rawAmount;
  }

  return {
    isConverted: isConverted && Boolean(origCurrency) && origCurrency !== "USD",
    usdAmount,
    origAmount,
    origCurrency,
    exchangeRate,
  };
}

// Same default estimate Administration uses when no address-based sales tax rate applies
const DEFAULT_TAX_RATE = 0.08;

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CC: "Credit Card",
  DC: "Debit Card",
  W: "Wire",
  WIRE: "Wire Transfer",
};

function getPaymentMethodLabel(req?: PurchaseRequest | null): string {
  const raw = req?.purchase_order?.payment_method || req?.payment_method;
  if (raw && String(raw).trim()) {
    const key = String(raw).trim();
    return PAYMENT_METHOD_LABELS[key.toUpperCase()] || key;
  }
  return req?.wire_transfer ? "Wire Transfer" : "-";
}

interface TaxInfo {
  subtotal: number;
  tax: number;
  total: number;
  ratePercent: number;
  source: "invoice" | "administration" | "quote" | "estimate";
}

/**
 * Total after tax. Order: actual invoiced cost, then the figure decided by the Administration server
 * (amount_after_tax / tax_rate), then the quote's own tax rate, then a local default estimate (last resort,
 * only when the server did not send a figure).
 */
function getAfterTaxInfo(req: PurchaseRequest | null | undefined, usdSubtotal: number): TaxInfo {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // Pass the Administration server's stored after-tax amount through unchanged.
  const serverTotal = Number(req?.amount_after_tax);
  const serverRate = Number(req?.tax_rate);
  if (serverTotal > 0 && Number.isFinite(serverRate)) {
    const tax = Math.max(0, round2(serverTotal - usdSubtotal));
    const source = req?.tax_source === "default" ? "estimate" : "administration";
    return { subtotal: usdSubtotal, tax, total: serverTotal, ratePercent: round2(serverRate * 100), source };
  }

  const quoteTax = Number(req?.quote_data?.tax);
  const quoteSubtotal = Number(req?.quote_data?.subtotal);
  if (quoteTax > 0 && quoteSubtotal > 0) {
    const rate = quoteTax / quoteSubtotal;
    const tax = round2(usdSubtotal * rate);
    return { subtotal: usdSubtotal, tax, total: round2(usdSubtotal + tax), ratePercent: round2(rate * 100), source: "quote" };
  }

  const tax = round2(usdSubtotal * DEFAULT_TAX_RATE);
  return { subtotal: usdSubtotal, tax, total: round2(usdSubtotal + tax), ratePercent: DEFAULT_TAX_RATE * 100, source: "estimate" };
}

function formatShortDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function describeApprovalLevel(name?: string | null, approvedAt?: string | null): string {
  if (name && approvedAt) return `${name} - ${formatShortDate(approvedAt)}`;
  if (name) return `${name} (pending)`;
  return "Pending";
}

function getRequestQuantity(req: PurchaseRequest): number {
  const items = Array.isArray(req.items) ? req.items : [];
  return items.length > 0 ? items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0) : Number(req.quantity) || 1;
}

/** Table cells: quantity, payment method and Level 1 approver (kept in sync across the three request tables). */
function renderRequestMetaCells(req: PurchaseRequest) {
  const l1Name = req.level_1_approver_name;
  const l1At = req.level_1_approved_at;
  return (
    <>
      <td className="py-3 px-4 text-center whitespace-nowrap font-mono text-slate-700 dark:text-zinc-300">
        {getRequestQuantity(req)}
      </td>
      <td className="py-3 px-4 whitespace-nowrap">
        <span
          className="block truncate max-w-[130px] text-slate-700 dark:text-zinc-300"
          title={getPaymentMethodLabel(req)}
        >
          {getPaymentMethodLabel(req)}
        </span>
      </td>
      <td className="py-3 px-4 whitespace-nowrap">
        {l1At ? (
          <>
            <span className="block truncate max-w-[130px] font-medium text-slate-800 dark:text-zinc-200">
              {l1Name || "Approved"}
            </span>
            <span className="text-[10px] text-slate-400 block">{formatShortDate(l1At)}</span>
          </>
        ) : (
          <>
            <span className="block truncate max-w-[130px] text-slate-500 dark:text-zinc-400">{l1Name || "Pending"}</span>
            {l1Name && <span className="text-[10px] text-slate-400 block">awaiting approval</span>}
          </>
        )}
      </td>
    </>
  );
}

function renderRequestAmountCell(req: PurchaseRequest) {
  const cInfo = getRequestCurrencyInfo(req);
  const tax = getAfterTaxInfo(req, cInfo.usdAmount);
  return (
    <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
      <div className="flex flex-col items-end">
        <span className="font-bold text-slate-900 dark:text-zinc-100">{formatUsd(tax.total)}</span>
        <span className="text-[10px] font-normal text-muted-foreground font-sans">
          {formatUsd(tax.subtotal)} + tax{tax.source === "estimate" ? " (est.)" : ""}
        </span>
        {cInfo.isConverted && cInfo.origAmount !== null && cInfo.origCurrency && (
          <span className="text-[10px] font-normal text-muted-foreground font-sans">
            ({formatForeignCurrency(cInfo.origAmount, cInfo.origCurrency)})
          </span>
        )}
      </div>
    </td>
  );
}

interface ItemPriceInfo {
  usdUnitPrice: number;
  usdTotal: number;
  origUnitPrice: number | null;
  origTotal: number | null;
  isConverted: boolean;
  origCurrency: string | null;
}

function getItemPriceInfo(it: any, reqInfo: CurrencyInfo, idx: number, quoteItems?: any[]): ItemPriceInfo {
  const itQty = Number(it.quantity) || 1;
  const rawPrice = Number(it.unit_price) || 0;
  const rawTotal = Number(it.total_price ?? it.total) || (itQty * rawPrice);

  if (!reqInfo.isConverted) {
    return {
      usdUnitPrice: rawPrice,
      usdTotal: rawTotal,
      origUnitPrice: null,
      origTotal: null,
      isConverted: false,
      origCurrency: null,
    };
  }

  const origCurrency = it.original_currency || reqInfo.origCurrency;

  if (it.converted_total !== undefined && it.converted_total !== null) {
    const usdTotal = Number(it.converted_total);
    const usdUnitPrice = it.converted_unit_price !== undefined && it.converted_unit_price !== null
      ? Number(it.converted_unit_price)
      : (itQty !== 0 ? usdTotal / itQty : usdTotal);
    const origUnitPrice = it.original_unit_price !== undefined && it.original_unit_price !== null
      ? Number(it.original_unit_price)
      : rawPrice;
    const origTotal = it.original_total !== undefined && it.original_total !== null
      ? Number(it.original_total)
      : rawTotal;

    return {
      usdUnitPrice,
      usdTotal,
      origUnitPrice,
      origTotal,
      isConverted: true,
      origCurrency,
    };
  }

  let qItem = quoteItems && idx < quoteItems.length ? quoteItems[idx] : null;
  if (!qItem && quoteItems) {
    qItem = quoteItems.find((qi: any) => qi.description === it.description || qi.product_name === it.product_name);
  }

  if (qItem && (qItem.converted_total !== undefined || qItem.converted_unit_price !== undefined)) {
    const usdTotal = Number(qItem.converted_total ?? (qItem.converted_unit_price ? qItem.converted_unit_price * itQty : rawTotal * (reqInfo.exchangeRate || 1)));
    const usdUnitPrice = Number(qItem.converted_unit_price ?? (itQty !== 0 ? usdTotal / itQty : usdTotal));
    const origUnitPrice = Number(qItem.original_unit_price ?? qItem.unit_price ?? rawPrice);
    const origTotal = Number(qItem.original_total ?? qItem.total ?? rawTotal);

    return {
      usdUnitPrice,
      usdTotal,
      origUnitPrice,
      origTotal,
      isConverted: true,
      origCurrency: qItem.original_currency || origCurrency,
    };
  }

  if (reqInfo.exchangeRate && reqInfo.exchangeRate > 0) {
    const usdUnitPrice = rawPrice * reqInfo.exchangeRate;
    const usdTotal = rawTotal * reqInfo.exchangeRate;
    return {
      usdUnitPrice,
      usdTotal,
      origUnitPrice: rawPrice,
      origTotal: rawTotal,
      isConverted: true,
      origCurrency,
    };
  }

  return {
    usdUnitPrice: rawPrice,
    usdTotal: rawTotal,
    origUnitPrice: rawPrice,
    origTotal: rawTotal,
    isConverted: true,
    origCurrency,
  };
}

const isRequestActionable = (
  status?: string | null,
  isInHistory?: boolean
): boolean => {
  if (isInHistory) return false;
  if (!status) return false;
  const s = status.trim().toUpperCase().replace(/\s+/g, "_");

  const nonActionableStatuses = [
    "DRAFT",
    "NEW",
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
    "CANCEL",
    "COMPLETED",
    "DECLINED",
    "CLOSED",
    "WAITING_PAYMENT",
    "PAYMENT_PENDING",
    "PAID",
    "ORDERED",
    "PURCHASED",
    "SHIPPED",
    "GOODS_RECEIVED",
    "INVOICE_RECEIVED",
    "SENT_TO_AP",
  ];
  if (nonActionableStatuses.includes(s)) return false;

  const pendingStatuses = [
    "WAITING_APPROVAL",
    "PENDING_APPROVAL",
    "PENDING",
  ];
  return pendingStatuses.includes(s);
};

export default function Administration() {
  useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [approvalViewMode, setApprovalViewMode] = useState<"pending" | "pending_sync" | "approved">("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Selected single request for single-action modal
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(null);
  const [approvalNote, setApprovalNote] = useState("");

  // Multiple Selection State for Bulk Operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"APPROVE" | "REJECT" | null>(null);
  const [bulkActionNote, setBulkActionNote] = useState("");

  // Detailed view dialog state
  const [detailedRequest, setDetailedRequest] = useState<PurchaseRequest | null>(null);

  // Assign Approvers Modal state
  const [isAssignApproversOpen, setIsAssignApproversOpen] = useState(false);

  // Real-time Event Stream & Event-Driven Service Availability
  const { lastSyncedAt, triggerManualSync } = useCeoRealtimeStream();
  const { isOnline } = useServiceStatus();
  const isAdminOnline = isOnline("admin");

  // Pending Approvals Query
  const {
    data: rawApprovals = [],
    isLoading: isApprovalsLoading,
    refetch: refetchApprovals,
    isFetching: isFetchingApprovals,
    isError: isApprovalsError,
  } = useQuery<PurchaseRequest[]>({
    queryKey: ["admin", "pendingApprovals"],
    queryFn: ({ signal }) => apiClient.get<PurchaseRequest[]>("/api/v1/ceo/approvals/pending", { signal }),
    staleTime: 30000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const pendingApprovals = useMemo(() => {
    return Array.isArray(rawApprovals) ? rawApprovals : [];
  }, [rawApprovals]);

  // Completed / Approved History Query
  const {
    data: rawCompletedHistory = [],
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
    isFetching: isFetchingHistory,
  } = useQuery<PurchaseRequest[]>({
    queryKey: ["admin", "completedApprovalsHistory"],
    queryFn: ({ signal }) => apiClient.get<PurchaseRequest[]>("/api/v1/ceo/approvals/history", { signal }),
    staleTime: 30000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Detail query for active selected detailed request
  const detailedRequestId = detailedRequest?.id;
  const { data: requestDetailResponse, isLoading: isDetailLoading } = useQuery({
    queryKey: ["admin", "approvalDetail", detailedRequestId],
    queryFn: async ({ signal }) => {
      if (!detailedRequestId) return null;
      const res = await apiClient.get<any>(`/api/v1/ceo/approvals/${detailedRequestId}`, { signal });
      if (res?.request) {
        // Keep the purchase order / invoice / wire details that sit beside the request in the response
        return {
          ...res.request,
          purchase_order: res.purchase_order ?? null,
          invoice: res.invoice ?? null,
          wire_transfer: res.wire_transfer ?? null,
        };
      }
      return res;
    },
    enabled: Boolean(detailedRequestId),
    staleTime: 60000,
    retry: false,
  });

  const activeRequest = useMemo(() => {
    if (!detailedRequest) return null;
    if (requestDetailResponse && String(requestDetailResponse.id) === String(detailedRequest.id)) {
      return { ...detailedRequest, ...requestDetailResponse };
    }
    return detailedRequest;
  }, [detailedRequest, requestDetailResponse]);

  const activeCurrencyInfo = useMemo(() => {
    return getRequestCurrencyInfo(activeRequest);
  }, [activeRequest]);

  const activeTaxInfo = useMemo(
    () => getAfterTaxInfo(activeRequest, activeCurrencyInfo.usdAmount),
    [activeRequest, activeCurrencyInfo.usdAmount],
  );

  const selectedCurrencyInfo = useMemo(() => {
    return getRequestCurrencyInfo(selectedRequest);
  }, [selectedRequest]);

  // Single Item Approval / Rejection Mutation
  const approvalMutation = useMutation({
    mutationFn: async ({ requestId, action, note }: { requestId: string; action: string; note: string }) => {
      return apiClient.post(`/api/v1/ceo/approvals/${requestId}/action`, {
        action,
        note,
      });
    },
    onSuccess: (data: any) => {
      const isQueued = data?.status === "QUEUED" || !isAdminOnline;
      if (isQueued) {
        toast.info(
          actionType === "APPROVE"
            ? "Approval queued. It will execute automatically when Admin Portal reconnects."
            : "Rejection queued. It will execute automatically when Admin Portal reconnects."
        );
        toast.info("Saved and will sync to the server once it is back online.");
      } else {
        toast.success(
          actionType === "APPROVE"
            ? "Purchase request approved successfully"
            : "Purchase request rejected"
        );
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "pendingApprovals"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "completedApprovalsHistory"] });
      queryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
      queryClient.invalidateQueries({ queryKey: ["completedApprovalsHistory"] });
      queryClient.invalidateQueries({ queryKey: ["ceoEvents"] });
      queryClient.invalidateQueries({ queryKey: ["ceoAuditLogs"] });
      setSelectedRequest(null);
      setApprovalNote("");
      setActionType(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to execute approval action. Please try again.");
    },
  });

  // Bulk Approval / Rejection Mutation
  const bulkApprovalMutation = useMutation({
    mutationFn: async ({
      requestIds,
      action,
      note,
    }: {
      requestIds: string[];
      action: "APPROVE" | "REJECT";
      note?: string;
    }) => {
      return apiClient.post(`/api/v1/ceo/approvals/bulk-action`, {
        request_ids: requestIds,
        action,
        note,
      });
    },
    onSuccess: (data: any) => {
      const isQueued = data?.status === "QUEUED" || !isAdminOnline;
      const count = selectedIds.length;
      if (isQueued) {
        toast.info(
          bulkActionType === "APPROVE"
            ? `Bulk approval queued for ${count} request(s). Will execute automatically upon reconnection.`
            : `Bulk rejection queued for ${count} request(s). Will execute automatically upon reconnection.`
        );
        toast.info("Saved and will sync to the server once it is back online.");
      } else {
        toast.success(
          bulkActionType === "APPROVE"
            ? `Successfully approved ${count} purchase request(s)`
            : `Successfully rejected ${count} purchase request(s)`
        );
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "pendingApprovals"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "completedApprovalsHistory"] });
      queryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
      queryClient.invalidateQueries({ queryKey: ["completedApprovalsHistory"] });
      queryClient.invalidateQueries({ queryKey: ["ceoEvents"] });
      queryClient.invalidateQueries({ queryKey: ["ceoAuditLogs"] });
      setSelectedIds([]);
      setBulkActionNote("");
      setIsBulkDialogOpen(false);
      setBulkActionType(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to execute bulk action. Please try again.");
    },
  });

  const handleActionSubmit = () => {
    if (!selectedRequest || !actionType) return;
    const isInHistory =
      approvalViewMode === "approved" ||
      Boolean((selectedRequest as any).isHistory) ||
      allCompletedRequests.some((c) => String(c.id) === String(selectedRequest.id));
    if (!isRequestActionable(selectedRequest.status, isInHistory)) {
      toast.error(`Request #${selectedRequest.id} is already ${selectedRequest.status.toLowerCase()} and cannot be modified.`);
      setSelectedRequest(null);
      setActionType(null);
      return;
    }
    approvalMutation.mutate({
      requestId: selectedRequest.id,
      action: actionType,
      note: approvalNote,
    });
  };

  const handleBulkSubmit = () => {
    if (selectedIds.length === 0 || !bulkActionType) return;
    bulkApprovalMutation.mutate({
      requestIds: selectedIds,
      action: bulkActionType,
      note: bulkActionNote,
    });
  };

  const refreshAll = useCallback(() => {
    triggerManualSync();
    refetchApprovals();
    refetchHistory();
    toast.info("Retrying connection and refreshing live feeds...");
  }, [triggerManualSync, refetchApprovals, refetchHistory]);

  const allCompletedRequests = useMemo(() => {
    if (Array.isArray(rawCompletedHistory)) {
      return rawCompletedHistory.map((r: any) => ({
        id: String(r.id),
        department: r.department || "Operations",
        amount: Number(r.amount) || 0,
        requester_name: r.requester_name || r.requester || "Staff Member",
        created_at: r.created_at || r.request_date || "",
        description: r.description || r.product_name || `Purchase Request #${r.id}`,
        status: r.status || "COMPLETED",
        approved_at: r.created_at || "",
        note: r.approval_note || r.hold_reason || (r.pending_sync ? (r.status === "REJECTED" ? "Rejected Offline (Queued)" : "Approved Offline (Queued)") : (r.status === "REJECTED" ? "Rejected" : "Signed Off")),
        vendor: r.vendor || r.product_info?.vendor || "Verified Vendor",
        currency: r.currency || "USD",
        original_currency: r.original_currency,
        original_amount: r.original_amount,
        exchange_rate: r.exchange_rate,
        is_converted: r.is_converted,
        quote_data: r.quote_data,
        items: r.items,
        pending_sync: Boolean(r.pending_sync),
        rawReq: r,
      }));
    }
    return [];
  }, [rawCompletedHistory]);

  const syncedApprovedRequests = useMemo(
    () => allCompletedRequests.filter((r) => !r.pending_sync),
    [allCompletedRequests]
  );

  const isDetailedInApproveHistory = useMemo(() => {
    if (!detailedRequest) return false;
    if (approvalViewMode === "approved") return true;
    const reqId = String(detailedRequest.id);
    return (
      Boolean((detailedRequest as any).isHistory) ||
      allCompletedRequests.some((c) => String(c.id) === reqId)
    );
  }, [detailedRequest, approvalViewMode, allCompletedRequests]);

  const pendingSyncRequests = useMemo(
    () => allCompletedRequests.filter((r) => r.pending_sync),
    [allCompletedRequests]
  );

  // Filtered requests with safe string matching
  const filteredApprovals = useMemo(() => {
    const q = (searchTerm || "").trim().toLowerCase();
    return pendingApprovals.filter((req) => {
      const matchesSearch = !q || (
        String(req.description || "").toLowerCase().includes(q) ||
        String(req.department || "").toLowerCase().includes(q) ||
        String(req.requester_name || "").toLowerCase().includes(q) ||
        String(req.id || "").toLowerCase().includes(q)
      );

      const stNorm = String(req.status || "").toUpperCase().replace(" ", "_");
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "WAITING_APPROVAL" && (stNorm === "WAITING_APPROVAL" || stNorm === "PENDING" || stNorm === "PENDING_APPROVAL"));

      const reqAmount = Number(req.amount) || 0;
      const matchesTier =
        tierFilter === "ALL" ||
        (tierFilter === "SENIOR" && reqAmount >= 10000) ||
        (tierFilter === "STANDARD" && reqAmount < 10000);

      return matchesSearch && matchesStatus && matchesTier;
    });
  }, [pendingApprovals, searchTerm, statusFilter, tierFilter]);

  const filteredPendingSync = useMemo(() => {
    const q = (searchTerm || "").trim().toLowerCase();
    return pendingSyncRequests.filter((req) => {
      return !q || (
        String(req.description || "").toLowerCase().includes(q) ||
        String(req.department || "").toLowerCase().includes(q) ||
        String(req.requester_name || "").toLowerCase().includes(q) ||
        String(req.vendor || "").toLowerCase().includes(q) ||
        String(req.id || "").toLowerCase().includes(q)
      );
    });
  }, [pendingSyncRequests, searchTerm]);

  const filteredApproved = useMemo(() => {
    const q = (searchTerm || "").trim().toLowerCase();
    return syncedApprovedRequests.filter((req) => {
      return !q || (
        String(req.description || "").toLowerCase().includes(q) ||
        String(req.department || "").toLowerCase().includes(q) ||
        String(req.requester_name || "").toLowerCase().includes(q) ||
        String(req.vendor || "").toLowerCase().includes(q) ||
        String(req.id || "").toLowerCase().includes(q)
      );
    });
  }, [syncedApprovedRequests, searchTerm]);

  // Paginated lists
  const currentList =
    approvalViewMode === "pending"
      ? filteredApprovals
      : approvalViewMode === "pending_sync"
      ? filteredPendingSync
      : filteredApproved;
  const totalPages = Math.max(1, Math.ceil(currentList.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedApprovals = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filteredApprovals.slice(startIndex, startIndex + pageSize);
  }, [filteredApprovals, safePage, pageSize]);

  const paginatedPendingSync = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filteredPendingSync.slice(startIndex, startIndex + pageSize);
  }, [filteredPendingSync, safePage, pageSize]);

  const paginatedApproved = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filteredApproved.slice(startIndex, startIndex + pageSize);
  }, [filteredApproved, safePage, pageSize]);

  const totalPendingAmount = useMemo(
    () => pendingApprovals.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0),
    [pendingApprovals]
  );
  const totalApprovedAmount = useMemo(
    () => syncedApprovedRequests.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0),
    [syncedApprovedRequests]
  );
  const totalPendingSyncAmount = useMemo(
    () => pendingSyncRequests.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0),
    [pendingSyncRequests]
  );

  // Selected requests info and handlers for bulk actions
  const selectedRequests = useMemo(() => {
    return pendingApprovals.filter((r) => selectedIds.includes(String(r.id)));
  }, [pendingApprovals, selectedIds]);

  const totalSelectedAmount = useMemo(() => {
    return selectedRequests.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [selectedRequests]);

  const currentPagePendingIds = useMemo(() => {
    return paginatedApprovals.map((r) => String(r.id));
  }, [paginatedApprovals]);

  const isAllCurrentPageSelected = useMemo(() => {
    if (currentPagePendingIds.length === 0) return false;
    return currentPagePendingIds.every((id) => selectedIds.includes(id));
  }, [currentPagePendingIds, selectedIds]);

  const isSomeCurrentPageSelected = useMemo(() => {
    return currentPagePendingIds.some((id) => selectedIds.includes(id)) && !isAllCurrentPageSelected;
  }, [currentPagePendingIds, selectedIds, isAllCurrentPageSelected]);

  const handleToggleSelectAllCurrentPage = useCallback(() => {
    if (isAllCurrentPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentPagePendingIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPagePendingIds])));
    }
  }, [isAllCurrentPageSelected, currentPagePendingIds]);

  const handleToggleSelectRow = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    const allFilteredIds = filteredApprovals.map((r) => String(r.id));
    setSelectedIds(allFilteredIds);
  }, [filteredApprovals]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const activeLineItems = useMemo(() => {
    if (!activeRequest) return [];
    let items = activeRequest.items || (activeRequest as any).line_items || [];
    if (typeof items === "string") {
      try {
        items = JSON.parse(items);
      } catch {
        items = [];
      }
    }
    return Array.isArray(items) ? (items as PurchaseRequestLineItem[]) : [];
  }, [activeRequest]);

  const isServerDisconnected = !isAdminOnline || isApprovalsError;
  const isRefreshingAny = isFetchingApprovals || isFetchingHistory;

  const { data: highApprovers } = useApproverRoleMembers("HIGH_LEVEL_APPROVER");
  const { data: lowApprovers } = useApproverRoleMembers("LOW_LEVEL_APPROVER");
  const executiveCount = Array.isArray(highApprovers) ? highApprovers.length : 0;
  const managerCount = Array.isArray(lowApprovers) ? lowApprovers.length : 0;

  return (
    <div className="mx-auto w-full max-w-[1600px] flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 lg:p-8 min-h-screen bg-background">
      {/* Page header */}
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Administration</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${isAdminOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              {isAdminOnline ? "Live" : "Offline"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Purchase approvals and approver delegation, synced with the Administration portal.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsAssignApproversOpen(true)}
            disabled={!isAdminOnline}
            className="h-10 sm:h-9 rounded-xl gap-2 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
            title={!isAdminOnline ? "Administration portal is offline. Connect to assign approvers." : "Assign approvers"}
          >
            {isAdminOnline ? <UserCheck className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            Assign approver
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(getEnv("VITE_ADMIN_PORTAL_URL", "http://localhost:5174") + "/purchasing/requests", "_blank")}
            disabled={isServerDisconnected}
            className="h-10 sm:h-9 rounded-xl gap-2 cursor-pointer"
          >
            Admin portal
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isRefreshingAny}
            className="h-10 sm:h-9 rounded-xl gap-2 cursor-pointer"
            title={`Last synced: ${lastSyncedAt.toLocaleTimeString()}`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingAny ? "animate-spin" : ""}`} />
            Refresh
            <span className="text-xs text-muted-foreground tabular-nums">
              {lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </Button>
        </div>
      </header>

      {isServerDisconnected && (
        <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <WifiOff className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Administration service unreachable</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Showing the last loaded data. Actions are queued and sent when the service reconnects.</p>
            </div>
          </div>
          <Button size="sm" onClick={refreshAll} disabled={isRefreshingAny} className="h-10 sm:h-9 rounded-xl bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shrink-0 cursor-pointer">
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingAny ? "animate-spin" : ""}`} />
            Retry
          </Button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <WidgetErrorBoundary widgetName="Pending Approvals">
          <KpiCard
            label="Pending review"
            tone="amber"
            icon={<Clock className="h-4 w-4" />}
            loading={isApprovalsLoading && !isServerDisconnected}
            value={pendingApprovals.length}
            hint={`${formatMoney(totalPendingAmount)} awaiting sign-off`}
          />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary widgetName="Approved Decisions">
          <KpiCard
            label="Approved decisions"
            tone="emerald"
            icon={<CheckCircle2 className="h-4 w-4" />}
            loading={isHistoryLoading && !isServerDisconnected}
            value={syncedApprovedRequests.length}
            hint={
              pendingSyncRequests.length > 0
                ? `${pendingSyncRequests.length} waiting reconnect (${formatMoney(totalPendingSyncAmount)})`
                : `${formatMoney(totalApprovedAmount)} approved`
            }
          />
        </WidgetErrorBoundary>
        <div className="col-span-2 lg:col-span-1">
          <WidgetErrorBoundary widgetName="Governance & RBAC">
            <KpiCard
              label="Approver delegation"
              tone="indigo"
              icon={<ShieldCheck className="h-4 w-4" />}
              value={executiveCount + managerCount}
              hint={`${executiveCount} executive · ${managerCount} manager`}
              onClick={() => setIsAssignApproversOpen(true)}
            />
          </WidgetErrorBoundary>
        </div>
      </div>

      {/* Main Approvals Table Section */}
      <WidgetErrorBoundary widgetName="Approvals Pipeline" onReset={refetchApprovals}>
        <div className="space-y-3 outline-none">
          {/* Controls Bar: Search, Filters & View Mode */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-lg shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setApprovalViewMode("pending");
                  setSelectedIds([]);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  approvalViewMode === "pending"
                    ? "bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-300 shadow-2xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
                }`}
              >
                <span>Pending Review</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  approvalViewMode === "pending"
                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                    : "bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300"
                }`}>
                  {pendingApprovals.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setApprovalViewMode("pending_sync");
                  setSelectedIds([]);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  approvalViewMode === "pending_sync"
                    ? "bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-300 shadow-2xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
                }`}
              >
                <span>Waiting Reconnect</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  approvalViewMode === "pending_sync"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : pendingSyncRequests.length > 0
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 animate-pulse"
                    : "bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300"
                }`}>
                  {pendingSyncRequests.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setApprovalViewMode("approved");
                  setSelectedIds([]);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  approvalViewMode === "approved"
                    ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
                }`}
              >
                <span>Approved History</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  approvalViewMode === "approved"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300"
                }`}>
                  {syncedApprovedRequests.length}
                </span>
              </button>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full md:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={"Search ID, description, requester..."}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={`h-8 pl-8 text-xs bg-slate-50/60 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-lg w-full ${
                    isServerDisconnected ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-zinc-900" : ""
                  }`}
                />
              </div>

              {approvalViewMode === "pending" && (
                <>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className={`h-8 text-xs bg-slate-50/60 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 text-slate-700 dark:text-zinc-300 font-medium ${
                      isServerDisconnected ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-zinc-900" : "cursor-pointer"
                    }`}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="WAITING_APPROVAL">Waiting Approval</option>
                  </select>

                  <select
                    value={tierFilter}
                    onChange={(e) => {
                      setTierFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className={`h-8 text-xs bg-slate-50/60 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 text-slate-700 dark:text-zinc-300 font-medium ${
                      isServerDisconnected ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-zinc-900" : "cursor-pointer"
                    }`}
                  >
                    <option value="ALL">All Tiers</option>
                    <option value="STANDARD">&lt; $10k Manager</option>
                    <option value="SENIOR">&ge; $10k Executive</option>
                  </select>
                </>
              )}
            </div>
          </div>

          {/* Bulk Selection Action Toolbar Banner */}
          {approvalViewMode === "pending" && selectedIds.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:px-4 bg-indigo-50/90 dark:bg-indigo-950/70 border border-indigo-200/90 dark:border-indigo-800/80 rounded-xl shadow-2xs animate-in fade-in slide-in-from-top-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse" />
                  <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                    {selectedIds.length} request{selectedIds.length > 1 ? "s" : ""} selected
                  </span>
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 font-mono">
                    (Total Amount: {formatUsd(totalSelectedAmount)})
                  </span>
                </div>

                {filteredApprovals.length > paginatedApprovals.length && selectedIds.length < filteredApprovals.length && (
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline font-semibold cursor-pointer"
                  >
                    Select all {filteredApprovals.length} filtered requests
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setBulkActionType("APPROVE");
                    setIsBulkDialogOpen(true);
                  }}
                  className="h-7.5 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs gap-1.5 cursor-pointer active:scale-98"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve Selected ({selectedIds.length})</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setBulkActionType("REJECT");
                    setIsBulkDialogOpen(true);
                  }}
                  className="h-7.5 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 rounded-lg gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reject Selected ({selectedIds.length})</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClearSelection}
                  className="h-7.5 px-2 text-xs text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs overflow-hidden">
            {(isApprovalsLoading || isHistoryLoading) && !isServerDisconnected ? (
              /* Skeletons view while loading */
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-zinc-800/60 border-b border-slate-200/80 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold">
                      {approvalViewMode === "pending" && (
                        <th className="py-3 px-3 w-[40px] text-center"></th>
                      )}
                      <th className="py-3 px-4 w-[110px]">ID / Date</th>
                      <th className="py-3 px-4 w-[170px]">Requester</th>
                      <th className="py-3 px-4 min-w-[280px]">Item Description & Purpose</th>
                      <th className="py-3 px-4 w-[90px] text-center">Priority</th>
                      <th className="py-3 px-4 w-[130px] text-center">Tier</th>
                      <th className="py-3 px-4 w-[70px] text-center">Qty</th>
                      <th className="py-3 px-4 w-[150px]">Payment Method</th>
                      <th className="py-3 px-4 w-[150px]">Level 1 Approver</th>
                      <th className="py-3 px-4 w-[150px] text-right">Total (After Tax)</th>
                      <th className="py-3 px-4 w-[160px] text-center">Status</th>
                      <th className="py-3 px-4 w-[190px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <tr key={i} className="hover:bg-slate-50/40 dark:hover:bg-zinc-800/30">
                        {approvalViewMode === "pending" && (
                          <td className="py-3.5 px-3 text-center"><Skeleton className="h-4 w-4 mx-auto rounded" /></td>
                        )}
                        <td className="py-3.5 px-4"><Skeleton className="h-4 w-16 rounded" /></td>
                        <td className="py-3.5 px-4"><Skeleton className="h-4 w-28 rounded" /></td>
                        <td className="py-3.5 px-4"><Skeleton className="h-4 w-52 rounded" /></td>
                        <td className="py-3.5 px-4 text-center"><Skeleton className="h-4 w-14 mx-auto rounded" /></td>
                        <td className="py-3.5 px-4 text-center"><Skeleton className="h-4 w-16 mx-auto rounded" /></td>
                        <td className="py-3.5 px-4 text-center"><Skeleton className="h-4 w-6 mx-auto rounded" /></td>
                        <td className="py-3.5 px-4"><Skeleton className="h-4 w-24 rounded" /></td>
                        <td className="py-3.5 px-4"><Skeleton className="h-4 w-24 rounded" /></td>
                        <td className="py-3.5 px-4 text-right"><Skeleton className="h-4 w-20 ml-auto rounded" /></td>
                        <td className="py-3.5 px-4 text-center"><Skeleton className="h-5 w-24 mx-auto rounded-full" /></td>
                        <td className="py-3.5 px-4 text-right"><Skeleton className="h-7 w-28 ml-auto rounded-lg" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : currentList.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-full w-fit mx-auto text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  {approvalViewMode === "pending"
                    ? "No Pending Approvals"
                    : approvalViewMode === "pending_sync"
                    ? "No Records Waiting Reconnect"
                    : "No Synchronized Approved History"}
                </h4>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  {approvalViewMode === "pending"
                    ? "All executive purchase requests have been reviewed and processed."
                    : approvalViewMode === "pending_sync"
                    ? "All approved requests are currently in sync with the live Administration Portal."
                    : "No approved requests matched the current search criteria."}
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-zinc-800/60 border-b border-slate-200/80 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold">
                      {approvalViewMode === "pending" && (
                        <th className="py-3 px-3 w-[40px] text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isAllCurrentPageSelected ? true : isSomeCurrentPageSelected ? "indeterminate" : false}
                            onCheckedChange={handleToggleSelectAllCurrentPage}
                            aria-label="Select all requests on current page"
                          />
                        </th>
                      )}
                      <th className="py-3 px-4 w-[110px] whitespace-nowrap">ID / Date</th>
                      <th className="py-3 px-4 w-[170px] whitespace-nowrap">Requester</th>
                      <th className="py-3 px-4 min-w-[280px]">Item Description & Purpose</th>
                      <th className="py-3 px-4 w-[90px] text-center whitespace-nowrap">Priority</th>
                      <th className="py-3 px-4 w-[130px] text-center whitespace-nowrap">Tier</th>
                      <th className="py-3 px-4 w-[70px] text-center whitespace-nowrap">Qty</th>
                      <th className="py-3 px-4 w-[150px] whitespace-nowrap">Payment Method</th>
                      <th className="py-3 px-4 w-[150px] whitespace-nowrap">Level 1 Approver</th>
                      <th className="py-3 px-4 w-[150px] text-right whitespace-nowrap">Total (After Tax)</th>
                      <th className="py-3 px-4 w-[160px] text-center whitespace-nowrap">Status</th>
                      <th className="py-3 px-4 w-[190px] text-right whitespace-nowrap">
                        {approvalViewMode === "pending" ? "Actions" : "Record Info"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {approvalViewMode === "pending" ? (
                      paginatedApprovals.map((req) => {
                        const isRowSelected = selectedIds.includes(String(req.id));
                        return (
                          <tr
                            key={req.id}
                            onClick={() => setDetailedRequest(req)}
                            className={`hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group ${
                              isRowSelected ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-l-2 border-indigo-600 dark:border-indigo-400" : ""
                            }`}
                          >
                            <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isRowSelected}
                                onCheckedChange={() => handleToggleSelectRow(String(req.id))}
                                aria-label={`Select request #${req.id}`}
                              />
                            </td>
                            <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">#{req.id}</span>
                              <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                                {req.created_at ? new Date(req.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "-"}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-medium text-slate-800 dark:text-zinc-200 block truncate max-w-[150px]">
                                {req.requester_name}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">
                                {req.department}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-medium text-slate-900 dark:text-zinc-100 block group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                                {req.description}
                              </span>
                              {req.gl_code && (
                                <span className="text-[10px] text-slate-400 font-mono">GL: {req.gl_code}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 font-medium ${
                                  req.priority === "Urgent" || req.priority === "High"
                                    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                                    : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300"
                                }`}
                              >
                                {req.priority || "Normal"}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-2 py-0.5 font-medium ${
                                  (Number(req.amount) || 0) >= 10000
                                    ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 font-semibold"
                                    : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                                }`}
                              >
                                {(Number(req.amount) || 0) >= 10000 ? "≥ $10k Exec" : "< $10k Mgr"}
                              </Badge>
                            </td>
                            {renderRequestMetaCells(req)}
                            {renderRequestAmountCell(req)}
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60 uppercase">
                                {req.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedRequest(req);
                                    setActionType("APPROVE");
                                  }}
                                  className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs font-medium gap-1 cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedRequest(req);
                                    setActionType("REJECT");
                                  }}
                                  className="h-7 px-2.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 rounded-lg font-medium cursor-pointer"
                                >
                                  Reject
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : approvalViewMode === "pending_sync" ? (
                      paginatedPendingSync.map((req) => (
                        <tr
                          key={req.id}
                          onClick={() => setDetailedRequest(req.rawReq || (req as any))}
                          className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group"
                        >
                          <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">#{req.id}</span>
                            <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                              {req.approved_at ? new Date(req.approved_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "-"}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-medium text-slate-800 dark:text-zinc-200 block truncate max-w-[150px]">
                              {req.requester_name}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">
                              {req.department}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-900 dark:text-zinc-100 block line-clamp-1">
                              {req.description}
                            </span>
                            {req.vendor && (
                              <span className="text-[10px] text-slate-500 font-medium">Vendor: {req.vendor}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300">
                              Normal
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.5 font-medium ${
                                (Number(req.amount) || 0) >= 10000
                                  ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300"
                                  : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                              }`}
                            >
                              {(Number(req.amount) || 0) >= 10000 ? "≥ $10k Exec" : "< $10k Mgr"}
                            </Badge>
                          </td>
                          {renderRequestMetaCells(req)}
                            {renderRequestAmountCell(req)}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 uppercase">
                              <Clock className="w-2.5 h-2.5 animate-spin text-amber-600" />
                              {req.status || "APPROVED"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium italic">
                              {req.note || "Waiting Reconnection"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      paginatedApproved.map((req) => (
                        <tr
                          key={req.id}
                          onClick={() => setDetailedRequest({ ...(req.rawReq || (req as any)), isHistory: true })}
                          className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group"
                        >
                          <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                            <span className={req.status === "REJECTED" || req.status === "CANCELLED" || req.status === "DECLINED" ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-emerald-600 dark:text-emerald-400 font-semibold"}>
                              #{req.id}
                            </span>
                            <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                              {req.approved_at ? new Date(req.approved_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "-"}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-medium text-slate-800 dark:text-zinc-200 block truncate max-w-[150px]">
                              {req.requester_name}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">
                              {req.department}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-900 dark:text-zinc-100 block line-clamp-1">
                              {req.description}
                            </span>
                            {req.vendor && (
                              <span className="text-[10px] text-slate-500 font-medium">Vendor: {req.vendor}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300">
                              Normal
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.5 font-medium ${
                                (Number(req.amount) || 0) >= 10000
                                  ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300"
                                  : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                              }`}
                            >
                              {(Number(req.amount) || 0) >= 10000 ? "≥ $10k Exec" : "< $10k Mgr"}
                            </Badge>
                          </td>
                          {renderRequestMetaCells(req)}
                            {renderRequestAmountCell(req)}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {req.status === "REJECTED" || req.status === "CANCELLED" || req.status === "DECLINED" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/60 uppercase">
                                <X className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
                                {req.status}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60 uppercase">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                {req.status}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className="text-[11px] text-slate-500 font-medium italic">
                              {req.note || ""}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t border-slate-100 dark:border-zinc-800 text-xs">
                <span className="text-slate-500">
                  Showing {(safePage - 1) * pageSize + 1} - {Math.min(safePage * pageSize, currentList.length)} of {currentList.length} items
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={safePage === 1}
                    className="h-7 w-7 p-0 rounded-lg cursor-pointer"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="h-7 w-7 p-0 rounded-lg cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <span className="px-2 font-medium text-slate-700 dark:text-zinc-300">
                    Page {safePage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="h-7 w-7 p-0 rounded-lg cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safePage === totalPages}
                    className="h-7 w-7 p-0 rounded-lg cursor-pointer"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </WidgetErrorBoundary>

      {/* Action Dialog: Approve or Reject Single Request */}
      <Dialog
        open={Boolean(selectedRequest && actionType)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRequest(null);
            setActionType(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  actionType === "APPROVE"
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                    : "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                }`}
              >
                {actionType === "APPROVE" ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  {actionType === "APPROVE" ? "Confirm Purchase Approval" : "Reject Purchase Request"}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Purchase Request #{selectedRequest?.id} • ${(Number(selectedRequest?.amount) || 0).toLocaleString()}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Requester:</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{selectedRequest?.requester_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Department:</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{selectedRequest?.department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Description:</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200 text-right max-w-[260px] truncate">{selectedRequest?.description}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Amount:</span>
                <div className="text-right">
                  <span className="font-bold text-slate-900 dark:text-zinc-100">
                    {formatUsd(selectedCurrencyInfo.usdAmount)}
                  </span>
                  {selectedCurrencyInfo.isConverted && selectedCurrencyInfo.origAmount !== null && selectedCurrencyInfo.origCurrency && (
                    <span className="text-xs font-normal text-muted-foreground ml-1.5 font-mono">
                      ({formatForeignCurrency(selectedCurrencyInfo.origAmount, selectedCurrencyInfo.origCurrency)})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Executive Note / Reason (Optional)
              </label>
              <Textarea
                placeholder={actionType === "APPROVE" ? "e.g., Approved per Q3 capital expenditure budget..." : "e.g., Please provide alternate quote from preferred supplier..."}
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                className="text-xs rounded-xl min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedRequest(null);
                setActionType(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleActionSubmit}
              disabled={approvalMutation.isPending}
              className={`text-xs font-medium h-9 px-4 rounded-xl gap-1.5 text-white cursor-pointer ${
                actionType === "APPROVE"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {approvalMutation.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : actionType === "APPROVE" ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <X className="w-3.5 h-3.5" />
              )}
              {approvalMutation.isPending ? "Processing..." : actionType === "APPROVE" ? "Approve Request" : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Dialog: Approve or Reject Multiple Requests */}
      <Dialog
        open={isBulkDialogOpen && Boolean(bulkActionType) && selectedIds.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setIsBulkDialogOpen(false);
            setBulkActionType(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[540px] rounded-2xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  bulkActionType === "APPROVE"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                }`}
              >
                {bulkActionType === "APPROVE" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <X className="w-5 h-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  {bulkActionType === "APPROVE"
                    ? `Confirm Bulk Approval (${selectedIds.length} Requests)`
                    : `Confirm Bulk Rejection (${selectedIds.length} Requests)`}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Total combined value: <span className="font-semibold text-slate-900 dark:text-zinc-100">{formatUsd(totalSelectedAmount)}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-zinc-900/80 rounded-xl border border-slate-200/80 dark:border-zinc-800 space-y-2">
              <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400 font-medium">
                <span>Selected Requests ({selectedRequests.length})</span>
                <span>Amount (USD)</span>
              </div>
              <div className="divide-y divide-slate-200/60 dark:divide-zinc-800 max-h-[160px] overflow-y-auto pr-1">
                {selectedRequests.map((req) => {
                  const cInfo = getRequestCurrencyInfo(req);
                  return (
                    <div key={req.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            #{req.id}
                          </span>
                          <span className="font-medium text-slate-800 dark:text-zinc-200 truncate">
                            {req.requester_name || "Staff Member"}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate">
                            ({req.department || "Operations"})
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {req.description || "Purchase request"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">
                          {formatUsd(cInfo.usdAmount)}
                        </span>
                        {cInfo.isConverted && cInfo.origAmount !== null && cInfo.origCurrency && (
                          <span className="block text-[10px] text-muted-foreground font-mono">
                            ({formatForeignCurrency(cInfo.origAmount, cInfo.origCurrency)})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1.5">
                {bulkActionType === "APPROVE" ? "Executive Approval Note (Optional)" : "Rejection Reason (Recommended)"}
              </label>
              <Textarea
                placeholder={
                  bulkActionType === "APPROVE"
                    ? "Add an optional audit sign-off note for these purchase requests..."
                    : "State the reason for rejecting these purchase requests..."
                }
                value={bulkActionNote}
                onChange={(e) => setBulkActionNote(e.target.value)}
                className="text-xs min-h-[75px] bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-zinc-800 gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsBulkDialogOpen(false);
                setBulkActionType(null);
              }}
              disabled={bulkApprovalMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleBulkSubmit}
              disabled={bulkApprovalMutation.isPending}
              className={`text-xs font-semibold h-9 px-5 rounded-xl gap-2 text-white cursor-pointer ${
                bulkActionType === "APPROVE"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {bulkApprovalMutation.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : bulkActionType === "APPROVE" ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <X className="w-3.5 h-3.5" />
              )}
              <span>
                {bulkApprovalMutation.isPending
                  ? "Processing..."
                  : bulkActionType === "APPROVE"
                  ? `Approve ${selectedIds.length} Requests`
                  : `Reject ${selectedIds.length} Requests`}
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detailed Request Modal */}
      <Dialog
        open={Boolean(detailedRequest)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailedRequest(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-lg text-indigo-600 dark:text-indigo-400">
                  Request #{activeRequest?.id}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-2 py-0.5 ${
                    activeRequest?.status === "APPROVED" || activeRequest?.status === "COMPLETED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : activeRequest?.status === "REJECTED"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {activeRequest?.status}
                </Badge>
              </div>
            </div>
            <DialogDescription className="text-xs mt-1">
              Created on {activeRequest?.created_at ? new Date(activeRequest.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : "-"} by {activeRequest?.requester_name} ({activeRequest?.department})
            </DialogDescription>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="text-xs text-muted-foreground">Loading request details...</span>
            </div>
          ) : (
            <div className="space-y-4 py-2 text-xs">
              {/* Product Info & Specifications */}
              <div className="p-3.5 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-2">
                <h4 className="font-semibold text-slate-800 dark:text-zinc-200 text-xs">Item Description & Purpose</h4>
                <p className="text-slate-600 dark:text-zinc-400">{activeRequest?.description || "No description provided."}</p>
                {activeRequest?.product_info?.specs && (
                  <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-zinc-800">
                    <span className="text-[11px] text-muted-foreground font-medium">Specs:</span>
                    <p className="text-slate-700 dark:text-zinc-300 mt-0.5 whitespace-pre-wrap">{activeRequest.product_info.specs}</p>
                  </div>
                )}
              </div>

              {/* Key facts: quantity, requested date, payment method, approvals */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                <div>
                  <span className="block text-[11px] text-muted-foreground font-medium">Quantity</span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200">
                    {activeLineItems.length > 0
                      ? activeLineItems.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0)
                      : Number(activeRequest?.quantity) || 1}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground font-medium">Requested Date</span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200">
                    {formatShortDate(activeRequest?.request_date || activeRequest?.created_at)}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground font-medium">Payment Method</span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 break-words">
                    {getPaymentMethodLabel(activeRequest)}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground font-medium">Level 1 Approved By</span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 break-words">
                    {describeApprovalLevel(activeRequest?.level_1_approver_name, activeRequest?.level_1_approved_at)}
                  </span>
                </div>
                {(activeRequest?.requires_second_level || activeRequest?.level_2_approver_name) && (
                  <div className="col-span-2">
                    <span className="block text-[11px] text-muted-foreground font-medium">Level 2 Approved By</span>
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 break-words">
                      {describeApprovalLevel(activeRequest?.level_2_approver_name, activeRequest?.level_2_approved_at)}
                    </span>
                  </div>
                )}
              </div>

              {/* Line Items Table */}
              {activeLineItems.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-semibold text-slate-800 dark:text-zinc-200 text-xs">Line Items</h4>
                  <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-50/80 dark:bg-zinc-800/60 text-slate-500 font-semibold border-b border-slate-200/80 dark:border-zinc-800">
                        <tr>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3 text-center w-16">Qty</th>
                          <th className="py-2 px-3 text-right w-24">Unit Price</th>
                          <th className="py-2 px-3 text-right w-24">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                        {activeLineItems.map((it, idx) => {
                          const pInfo = getItemPriceInfo(it, activeCurrencyInfo, idx, activeRequest?.quote_data?.items);
                          return (
                            <tr key={it.id || idx}>
                              <td className="py-2 px-3 font-medium text-slate-800 dark:text-zinc-200">{it.description || it.item_name || it.product_name || `Item #${idx + 1}`}</td>
                              <td className="py-2 px-3 text-center text-muted-foreground">{it.quantity || 1}</td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-zinc-300">
                                <div>{formatUsd(pInfo.usdUnitPrice)}</div>
                                {pInfo.isConverted && pInfo.origUnitPrice !== null && pInfo.origCurrency && (
                                  <div className="text-[10px] text-muted-foreground">({formatForeignCurrency(pInfo.origUnitPrice, pInfo.origCurrency)})</div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900 dark:text-zinc-100">
                                <div>{formatUsd(pInfo.usdTotal)}</div>
                                {pInfo.isConverted && pInfo.origTotal !== null && pInfo.origCurrency && (
                                  <div className="text-[10px] text-muted-foreground font-normal">({formatForeignCurrency(pInfo.origTotal, pInfo.origCurrency)})</div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Total & Multi-Currency Summary */}
              <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-indigo-950 dark:text-indigo-200">Total Amount</span>
                  <span className="text-sm font-semibold font-mono text-indigo-900 dark:text-indigo-100">
                    {formatUsd(activeTaxInfo.subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Tax ({activeTaxInfo.ratePercent}%
                    {activeTaxInfo.source === "estimate" ? " est." : activeTaxInfo.source === "invoice" ? " actual" : ""})
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">{formatUsd(activeTaxInfo.tax)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-indigo-100 dark:border-indigo-900/60">
                  <span className="text-xs font-semibold text-indigo-950 dark:text-indigo-200">Total After Tax</span>
                  <span className="text-base font-bold font-mono text-indigo-900 dark:text-indigo-100">
                    {formatUsd(activeTaxInfo.total)}
                  </span>
                </div>
                {activeCurrencyInfo.isConverted && activeCurrencyInfo.exchangeRate && (
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      Exchange Rate: 1 {activeCurrencyInfo.origCurrency} = {activeCurrencyInfo.exchangeRate.toFixed(4)} USD
                    </span>
                    {activeCurrencyInfo.origAmount !== null && activeCurrencyInfo.origCurrency && (
                      <span className="font-mono">
                        ({formatForeignCurrency(activeCurrencyInfo.origAmount, activeCurrencyInfo.origCurrency)})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-1 flex-col-reverse gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setDetailedRequest(null)}
              className="h-9 min-w-[7.5rem] rounded-xl px-4 text-xs font-semibold cursor-pointer"
            >
              Close
            </Button>
            {activeRequest && isRequestActionable(activeRequest.status, isDetailedInApproveHistory) && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    const req = activeRequest;
                    setDetailedRequest(null);
                    setSelectedRequest(req);
                    setActionType("REJECT");
                  }}
                  className="h-9 min-w-[7.5rem] rounded-xl border-rose-200 px-4 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                  Reject Request
                </Button>
                <Button
                  onClick={() => {
                    const req = activeRequest;
                    setDetailedRequest(null);
                    setSelectedRequest(req);
                    setActionType("APPROVE");
                  }}
                  className="h-9 min-w-[7.5rem] gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" /> Approve Request
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Approvers PBAC Modal */}
      {isAssignApproversOpen && (
        <AssignApproversModal
          isOpen={isAssignApproversOpen}
          onClose={() => setIsAssignApproversOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
            queryClient.invalidateQueries({ queryKey: ["completedApprovalsHistory"] });
          }}
        />
      )}
    </div>
  );
}
