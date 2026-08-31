import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { apiClient } from "@/services/apiClient";
import { useCeoRealtimeStream } from "@/hooks/useCeoRealtimeStream";
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
  Package,
  Lock,
  Building2,
  WifiOff,
} from "lucide-react";
import { AssignApproversModal } from "@/components/AssignApproversModal";
import { WidgetErrorBoundary } from "@/components/WidgetErrorBoundary";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface PortalStatus {
  name: string;
  code: string;
  port: number;
  domain: string;
  status: "online" | "degraded" | "offline";
  status_code?: number;
  latency_ms: number;
  is_local?: boolean;
}

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
}

interface PurchaseRequest {
  id: string;
  department: string;
  amount: number;
  status: string;
  description: string;
  product_name?: string;
  priority: string;
  requester_name: string;
  created_at: string;
  gl_code?: string;
  currency?: string;
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
  quote_data?: {
    vendor_name?: string;
    quote_number?: string;
    quote_date?: string;
    tax_amount?: number;
    shipping_amount?: number;
  };
  request_type?: string;
  assigned_user?: string;
  hold_reason?: string;
  approved_at?: string;
  note?: string;
  rawReq?: any;
  attachments?: Array<{
    name: string;
    url: string;
    size?: string;
  }>;
}

export default function Administration() {
  useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [approvalViewMode, setApprovalViewMode] = useState<"pending" | "approved">("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Selected request for action modal
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(null);
  const [approvalNote, setApprovalNote] = useState("");

  // Detailed view dialog state
  const [detailedRequest, setDetailedRequest] = useState<PurchaseRequest | null>(null);

  // Assign Approvers Modal state
  const [isAssignApproversOpen, setIsAssignApproversOpen] = useState(false);

  // Real-time Event Stream
  const { lastSyncedAt, triggerManualSync } = useCeoRealtimeStream();

  // Portals Status Query
  const { data: portals = [], refetch: refetchPortals, isFetching: isFetchingPortals } = useQuery<PortalStatus[]>({
    queryKey: ["portalsStatus"],
    queryFn: () => apiClient.get<PortalStatus[]>("/api/v1/ceo/portals-status"),
    staleTime: 60000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const adminPortal = useMemo(
    () => Array.isArray(portals) ? portals.find((p) => p?.code?.toUpperCase().includes("ADMIN") || p?.name?.toLowerCase().includes("admin")) : undefined,
    [portals]
  );
  const isAdminOnline = adminPortal?.status === "online";

  // Pending Approvals Query
  const {
    data: rawApprovals = [],
    isLoading: isApprovalsLoading,
    refetch: refetchApprovals,
    isFetching: isFetchingApprovals,
    isError: isApprovalsError,
  } = useQuery<PurchaseRequest[]>({
    queryKey: ["pendingApprovals"],
    queryFn: () => apiClient.get<PurchaseRequest[]>("/api/v1/ceo/approvals/pending"),
    staleTime: 60000,
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
    queryKey: ["completedApprovalsHistory"],
    queryFn: () => apiClient.get<PurchaseRequest[]>("/api/v1/ceo/approvals/history"),
    staleTime: 60000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Detail query for active selected detailed request
  const detailedRequestId = detailedRequest?.id;
  const { data: requestDetailResponse, isLoading: isDetailLoading } = useQuery({
    queryKey: ["approvalDetail", detailedRequestId],
    queryFn: async () => {
      if (!detailedRequestId) return null;
      const res = await apiClient.get<any>(`/api/v1/ceo/approvals/${detailedRequestId}`);
      return res?.request || res;
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

  // Execute Approval / Rejection Mutation
  const approvalMutation = useMutation({
    mutationFn: async ({ requestId, action, note }: { requestId: string; action: string; note: string }) => {
      return apiClient.post(`/api/v1/ceo/approvals/${requestId}/action`, {
        action,
        note,
      });
    },
    onSuccess: () => {
      toast.success(
        actionType === "APPROVE"
          ? "Purchase request approved successfully"
          : "Purchase request rejected"
      );
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

  const handleActionSubmit = () => {
    if (!selectedRequest || !actionType) return;
    approvalMutation.mutate({
      requestId: selectedRequest.id,
      action: actionType,
      note: approvalNote,
    });
  };

  const refreshAll = useCallback(() => {
    triggerManualSync();
    refetchPortals();
    refetchApprovals();
    refetchHistory();
    toast.info("Retrying connection and refreshing live feeds...");
  }, [triggerManualSync, refetchPortals, refetchApprovals, refetchHistory]);

  const approvedRequests = useMemo(() => {
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
        note: r.hold_reason || "Completed",
        vendor: r.vendor || r.product_info?.vendor || "Verified Vendor",
        rawReq: r,
      }));
    }
    return [];
  }, [rawCompletedHistory]);

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
        (statusFilter === "WAITING_APPROVAL" && (stNorm === "WAITING_APPROVAL" || stNorm === "PENDING")) ||
        (statusFilter === "NEW" && stNorm === "NEW") ||
        (statusFilter === "UNDER_REVIEW" && stNorm === "UNDER_REVIEW");

      const reqAmount = Number(req.amount) || 0;
      const matchesTier =
        tierFilter === "ALL" ||
        (tierFilter === "SENIOR" && reqAmount >= 10000) ||
        (tierFilter === "STANDARD" && reqAmount < 10000);

      return matchesSearch && matchesStatus && matchesTier;
    });
  }, [pendingApprovals, searchTerm, statusFilter, tierFilter]);

  const filteredApproved = useMemo(() => {
    const q = (searchTerm || "").trim().toLowerCase();
    return approvedRequests.filter((req) => {
      return !q || (
        String(req.description || "").toLowerCase().includes(q) ||
        String(req.department || "").toLowerCase().includes(q) ||
        String(req.requester_name || "").toLowerCase().includes(q) ||
        String(req.vendor || "").toLowerCase().includes(q) ||
        String(req.id || "").toLowerCase().includes(q)
      );
    });
  }, [approvedRequests, searchTerm]);

  // Paginated lists
  const currentList = approvalViewMode === "pending" ? filteredApprovals : filteredApproved;
  const totalPages = Math.max(1, Math.ceil(currentList.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedApprovals = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filteredApprovals.slice(startIndex, startIndex + pageSize);
  }, [filteredApprovals, safePage, pageSize]);

  const paginatedApproved = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filteredApproved.slice(startIndex, startIndex + pageSize);
  }, [filteredApproved, safePage, pageSize]);

  const totalPendingAmount = useMemo(
    () => pendingApprovals.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0),
    [pendingApprovals]
  );
  const totalApprovedAmount = useMemo(
    () => approvedRequests.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0),
    [approvedRequests]
  );

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
  const isRefreshingAny = isFetchingApprovals || isFetchingPortals || isFetchingHistory;

  return (
    <div className="w-full flex flex-col gap-4 sm:gap-5 p-4 sm:p-6 lg:p-7 min-h-screen bg-slate-50/40 dark:bg-zinc-950 transition-colors">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-3 border-b border-slate-200/80 dark:border-zinc-800/80">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Administration & Governance
            </h1>
            <span
              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                isAdminOnline
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isAdminOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              {isAdminOnline ? "Admin Portal Online (:8001)" : "Admin Portal Offline (:8001)"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Executive purchasing approval pipelines, PBAC role delegations, and synchronized administration portal governance.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 w-full lg:w-auto">
          <Button
            size="sm"
            disabled={!isAdminOnline}
            onClick={() => {
              if (!isAdminOnline) {
                toast.error("Admin Portal is disconnected. Approver assignment requires an active connection.");
                return;
              }
              setIsAssignApproversOpen(true);
            }}
            className={`text-xs font-medium h-9 px-4 rounded-xl gap-2 transition-all flex-1 sm:flex-initial justify-center ${
              isAdminOnline
                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs cursor-pointer active:scale-98"
                : "bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-800 cursor-not-allowed opacity-60"
            }`}
            title={!isAdminOnline ? "Admin Portal is offline. Connect Admin Portal to assign approvers." : "Assign Approvers"}
          >
            {isAdminOnline ? (
              <UserCheck className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400" />
            )}
            <span>Assign Approver</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isServerDisconnected}
            onClick={() => window.open(getEnv("VITE_ADMIN_PORTAL_URL", "http://localhost:5174") + "/purchasing/requests", "_blank")}
            className={`text-xs h-9 px-3 rounded-xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 gap-1.5 ${
              isServerDisconnected ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            <span className="hidden xs:inline">Open</span> Admin Portal
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isRefreshingAny}
            className="text-xs h-9 px-3.5 rounded-xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 gap-1.5 transition-all shadow-2xs cursor-pointer"
            title={`Last synced: ${lastSyncedAt.toLocaleTimeString()}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAny ? "animate-spin text-indigo-600" : ""}`} />
            <span className="hidden sm:inline">Sync Feeds</span>
          </Button>
        </div>
      </div>

      {/* Disconnected Notice Banner with Retry Connection Button */}
      {isServerDisconnected && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 shadow-2xs transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shrink-0">
              <WifiOff className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <span>Administration Service Disconnected</span>
                <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-amber-200/70 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 uppercase">
                  Offline
                </span>
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                The connection to Administration Portal (:8001) is currently unreachable. Displaying placeholder skeletons while disconnected. Navigation and other tools remain fully functional.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={refreshAll}
            disabled={isRefreshingAny}
            className="h-8 px-4 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-2xs gap-1.5 shrink-0 cursor-pointer active:scale-98"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAny ? "animate-spin" : ""}`} />
            <span>Retry Connection</span>
          </Button>
        </div>
      )}

      {/* 3 Executive Administration KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Pending Approvals Card */}
        <WidgetErrorBoundary widgetName="Pending Approvals">
          <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:shadow-xs transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Pending Review
                </span>
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5">
                {isApprovalsLoading || isServerDisconnected ? (
                  <div className="space-y-2 py-0.5">
                    <Skeleton className="h-7 w-28 rounded-lg" />
                    <Skeleton className="h-3.5 w-36 rounded" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100">
                        {pendingApprovals.length}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400">
                        (${totalPendingAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Requires executive sign-off</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>

        {/* Approved Decisions Card */}
        <WidgetErrorBoundary widgetName="Approved Decisions">
          <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:shadow-xs transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Approved Decisions
                </span>
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5">
                {isHistoryLoading || isServerDisconnected ? (
                  <div className="space-y-2 py-0.5">
                    <Skeleton className="h-7 w-28 rounded-lg" />
                    <Skeleton className="h-3.5 w-40 rounded" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {approvedRequests.length}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        (${totalApprovedAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Synchronized with Admin Portal</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>

        {/* Governance & Approver Delegation Card */}
        <WidgetErrorBoundary widgetName="Governance & RBAC">
          <Card
            onClick={() => {
              if (isAdminOnline) setIsAssignApproversOpen(true);
            }}
            className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer group"
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  Approver Delegation
                </span>
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/60 group-hover:text-indigo-600 transition-colors">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5 flex items-end justify-between gap-2">
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-purple-700 dark:text-purple-300">
                    5 Roles Active
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-purple-600 dark:text-purple-400 font-medium">
                    <span>Executive & Manager tiers</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={!isAdminOnline}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isAdminOnline) {
                      toast.error("Admin Portal is disconnected.");
                      return;
                    }
                    setIsAssignApproversOpen(true);
                  }}
                  className="h-8 px-2.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg gap-1 shadow-2xs cursor-pointer active:scale-95 shrink-0"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Assign</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>
      </div>

      {/* Main Approvals Table Section */}
      <WidgetErrorBoundary widgetName="Approvals Pipeline" onReset={refetchApprovals}>
        <div className="space-y-3 outline-none">
          {/* Mobile-Only Quick Action Bar */}
          <div className="sm:hidden flex items-center justify-between gap-2 p-3 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/60 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 block">Approver Role Delegation</span>
                <span className="text-[10px] text-muted-foreground">Assign PBAC review tiers</span>
              </div>
            </div>
            <Button
              size="sm"
              disabled={!isAdminOnline}
              onClick={() => {
                if (!isAdminOnline) {
                  toast.error("Admin Portal is disconnected.");
                  return;
                }
                setIsAssignApproversOpen(true);
              }}
              className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-2xs gap-1 cursor-pointer shrink-0"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Assign</span>
            </Button>
          </div>

          {/* Controls Bar: Search, Filters & View Mode */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-lg shrink-0">
              <button
                type="button"
                disabled={isServerDisconnected}
                onClick={() => {
                  setApprovalViewMode("pending");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  isServerDisconnected
                    ? "opacity-50 cursor-not-allowed text-slate-400"
                    : approvalViewMode === "pending"
                    ? "bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-300 shadow-2xs cursor-pointer"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 cursor-pointer"
                }`}
              >
                Pending Review ({isServerDisconnected ? "-" : pendingApprovals.length})
              </button>
              <button
                type="button"
                disabled={isServerDisconnected}
                onClick={() => {
                  setApprovalViewMode("approved");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  isServerDisconnected
                    ? "opacity-50 cursor-not-allowed text-slate-400"
                    : approvalViewMode === "approved"
                    ? "bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-300 shadow-2xs cursor-pointer"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 cursor-pointer"
                }`}
              >
                Approved History ({isServerDisconnected ? "-" : approvedRequests.length})
              </button>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full md:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={isServerDisconnected ? "Search disabled while offline..." : "Search ID, description, requester..."}
                  disabled={isServerDisconnected}
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
                    disabled={isServerDisconnected}
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
                    <option value="NEW">New</option>
                    <option value="UNDER_REVIEW">Under Review</option>
                  </select>

                  <select
                    disabled={isServerDisconnected}
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

          {/* Table Container */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs overflow-hidden">
            {isApprovalsLoading || isHistoryLoading || isServerDisconnected ? (
              /* Skeletons view while loading or disconnected */
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-zinc-800/60 border-b border-slate-200/80 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold">
                      <th className="py-3 px-4 w-[110px]">ID / Date</th>
                      <th className="py-3 px-4 w-[170px]">Requester</th>
                      <th className="py-3 px-4 min-w-[280px]">Item Description & Purpose</th>
                      <th className="py-3 px-4 w-[90px] text-center">Priority</th>
                      <th className="py-3 px-4 w-[130px] text-center">Tier</th>
                      <th className="py-3 px-4 w-[130px] text-right">Amount</th>
                      <th className="py-3 px-4 w-[160px] text-center">Status</th>
                      <th className="py-3 px-4 w-[190px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <tr key={i} className="hover:bg-slate-50/40 dark:hover:bg-zinc-800/30">
                        <td className="py-3.5 px-4"><Skeleton className="h-4 w-16 rounded" /></td>
                        <td className="py-3.5 px-4"><Skeleton className="h-4 w-28 rounded" /></td>
                        <td className="py-3.5 px-4"><Skeleton className="h-4 w-52 rounded" /></td>
                        <td className="py-3.5 px-4 text-center"><Skeleton className="h-4 w-14 mx-auto rounded" /></td>
                        <td className="py-3.5 px-4 text-center"><Skeleton className="h-4 w-16 mx-auto rounded" /></td>
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
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  {approvalViewMode === "pending" ? "No Pending Approvals" : "No Approved History"}
                </h4>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  {approvalViewMode === "pending"
                    ? "All executive purchase requests have been reviewed and processed."
                    : "No approved requests matched the current search criteria."}
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-zinc-800/60 border-b border-slate-200/80 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold">
                      <th className="py-3 px-4 w-[110px] whitespace-nowrap">ID / Date</th>
                      <th className="py-3 px-4 w-[170px] whitespace-nowrap">Requester</th>
                      <th className="py-3 px-4 min-w-[280px]">Item Description & Purpose</th>
                      <th className="py-3 px-4 w-[90px] text-center whitespace-nowrap">Priority</th>
                      <th className="py-3 px-4 w-[130px] text-center whitespace-nowrap">Tier</th>
                      <th className="py-3 px-4 w-[130px] text-right whitespace-nowrap">Amount</th>
                      <th className="py-3 px-4 w-[160px] text-center whitespace-nowrap">Status</th>
                      <th className="py-3 px-4 w-[190px] text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {approvalViewMode === "pending" ? (
                      paginatedApprovals.map((req) => (
                        <tr
                          key={req.id}
                          onClick={() => setDetailedRequest(req)}
                          className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group"
                        >
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
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                            ${(Number(req.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60 uppercase">
                              {req.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                disabled={!isAdminOnline}
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
                                disabled={!isAdminOnline}
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
                      ))
                    ) : (
                      paginatedApproved.map((req) => (
                        <tr
                          key={req.id}
                          onClick={() => setDetailedRequest(req.rawReq || (req as any))}
                          className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group"
                        >
                          <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">#{req.id}</span>
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
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                            ${(Number(req.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60 uppercase">
                              {req.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className="text-[11px] text-slate-500 font-medium italic">
                              {req.note || "Signed Off"}
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
            {!isServerDisconnected && totalPages > 1 && (
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

      {/* Action Dialog: Approve or Reject */}
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Amount:</span>
                <span className="font-bold text-slate-900 dark:text-zinc-100">${(Number(selectedRequest?.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
                "Processing..."
              ) : actionType === "APPROVE" ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Confirm Approval
                </>
              ) : (
                <>
                  <X className="w-3.5 h-3.5" /> Confirm Rejection
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comprehensive Request Detail Modal */}
      <Dialog
        open={Boolean(detailedRequest && !actionType)}
        onOpenChange={(open) => {
          if (!open && detailedRequest) {
            setDetailedRequest(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    <span>Purchase Request #{activeRequest?.id}</span>
                    <Badge variant="outline" className="text-[10px] px-2 py-0 uppercase">
                      {activeRequest?.status}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Requested on {activeRequest?.created_at ? new Date(activeRequest.created_at).toLocaleDateString(undefined, { dateStyle: "long" }) : "-"}
                  </DialogDescription>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-muted-foreground block">Requested Total</span>
                <span className="text-lg font-mono font-bold text-slate-900 dark:text-zinc-100">
                  ${(Number(activeRequest?.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Core details grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-100 dark:border-zinc-800">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Requester</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{activeRequest?.requester_name}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Department</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{activeRequest?.department}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Priority</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{activeRequest?.priority || "Normal"}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Spend Tier</span>
                <span className="font-semibold text-purple-700 dark:text-purple-300">
                  {(Number(activeRequest?.amount) || 0) >= 10000 ? "≥ $10k Executive" : "< $10k Manager"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">GL Code</span>
                <span className="font-mono text-slate-700 dark:text-zinc-300">{activeRequest?.gl_code || "N/A"}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Currency</span>
                <span className="font-mono text-slate-700 dark:text-zinc-300">{activeRequest?.currency || "USD"}</span>
              </div>
            </div>

            {/* Description & Business Justification */}
            <div className="space-y-1">
              <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Item Description & Justification</h5>
              <p className="p-3 rounded-xl bg-slate-50/50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 leading-relaxed">
                {activeRequest?.description}
              </p>
            </div>

            {/* Item Breakdown & Product Specification */}
            {isDetailLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-24 rounded" />
                <div className="p-3 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-2">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                </div>
              </div>
            ) : activeLineItems.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Item Breakdown ({activeLineItems.length} items)
                  </h5>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
                    Multi-Item Order
                  </Badge>
                </div>
                <div className="border border-slate-100 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                  {activeLineItems.map((it: any, idx: number) => {
                    const itQty = Number(it.quantity) || 1;
                    const itPrice = Number(it.unit_price) || 0;
                    const itTotal = Number(it.total_price) || (itQty * itPrice);
                    const itName = it.product_name || it.item_name || it.description || `Item #${idx + 1}`;
                    return (
                      <div key={idx} className="p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 dark:text-zinc-200 block truncate">
                              {itName}
                            </span>
                            {it.item_url && (
                              <a
                                href={it.item_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-0.5 text-[10px]"
                              >
                                <span>Link</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>Qty: <strong className="text-slate-700 dark:text-zinc-300">{itQty}</strong></span>
                            <span>•</span>
                            <span>Unit: <strong className="text-slate-700 dark:text-zinc-300">${itPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 font-mono font-bold text-slate-900 dark:text-zinc-100">
                          ${itTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Product Specification & Pricing
                  </h5>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300">
                    Single Item
                  </Badge>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-zinc-900/70 border border-slate-100 dark:border-zinc-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60 dark:border-zinc-800">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Product / Item Name</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                        {activeRequest?.product_name || activeRequest?.description || "Single Purchase Item"}
                      </span>
                    </div>
                    {activeRequest?.item_url && (
                      <a
                        href={activeRequest.item_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium shrink-0 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/40"
                      >
                        <span>View Product URL</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-white dark:bg-zinc-800/80 border border-slate-100 dark:border-zinc-700/60">
                      <span className="text-[10px] text-muted-foreground block">Quantity</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                        {activeRequest?.quantity ?? 1} unit{(activeRequest?.quantity ?? 1) > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-zinc-800/80 border border-slate-100 dark:border-zinc-700/60">
                      <span className="text-[10px] text-muted-foreground block">Unit Price</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                        ${((activeRequest?.unit_price !== undefined && activeRequest?.unit_price !== null && activeRequest?.unit_price > 0)
                          ? Number(activeRequest.unit_price)
                          : (Number(activeRequest?.amount) || 0) / (Number(activeRequest?.quantity) || 1)
                        ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100/80 dark:border-indigo-900/40">
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold block">Total Item Cost</span>
                      <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                        ${(Number(activeRequest?.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Vendor & Quote Metadata */}
            {activeRequest?.product_info && (
              <div className="space-y-1.5">
                <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Vendor & Specification</h5>
                <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800 grid grid-cols-2 gap-2 text-xs">
                  {activeRequest.product_info.vendor && (
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Preferred Vendor</span>
                      <span className="font-medium">{activeRequest.product_info.vendor}</span>
                    </div>
                  )}
                  {activeRequest.product_info.model && (
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Model / Part</span>
                      <span className="font-medium">{activeRequest.product_info.model}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <Button variant="ghost" size="sm" onClick={() => setDetailedRequest(null)}>
              Close
            </Button>
            {activeRequest?.status !== "APPROVED" && activeRequest?.status !== "COMPLETED" && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!isAdminOnline}
                  onClick={() => {
                    const req = activeRequest;
                    setDetailedRequest(null);
                    setSelectedRequest(req);
                    setActionType("REJECT");
                  }}
                  className="text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 rounded-xl cursor-pointer"
                >
                  Reject Request
                </Button>
                <Button
                  size="sm"
                  disabled={!isAdminOnline}
                  onClick={() => {
                    const req = activeRequest;
                    setDetailedRequest(null);
                    setSelectedRequest(req);
                    setActionType("APPROVE");
                  }}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-2xs gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Approve Request
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Approvers Modal - ONLY mounted when open */}
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
