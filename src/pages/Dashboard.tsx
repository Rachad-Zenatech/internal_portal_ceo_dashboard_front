import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { apiClient } from "@/services/apiClient";
import { useCeoRealtimeStream } from "@/hooks/useCeoRealtimeStream";
import {
  Activity,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
  Check,
  X,
  Server,
  Search,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Package,
  Layers,
} from "lucide-react";
import { AssignApproversModal } from "@/components/AssignApproversModal";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

import RevenueExpenseChart from "@/components/Dashboard/RevenueExpenseChart";
import BankBalancesChart from "@/components/Dashboard/BankBalancesChart";
import AccountTypeDonut from "@/components/Dashboard/AccountTypeDonut";
import RecentTransactionsTable from "@/components/Dashboard/RecentTransactionsTable";
import { getEnv } from "@/lib/env";

interface PortalStatus {
  name: string;
  code: string;
  port: number;
  domain: string;
  status: "online" | "degraded" | "offline";
  status_code?: number;
  latency_ms: number;
}

export interface ProductInfo {
  name?: string;
  price?: string | number;
  currency?: string;
  brand?: string;
  vendor?: string;
  category?: string;
  description?: string;
}

export interface PurchaseRequestAttachment {
  filename?: string;
  file_name?: string;
  file_url?: string;
  url?: string;
  file_type?: "excel" | "pdf" | "image" | "file" | string;
  file_size?: string;
}

export interface PurchaseRequestLineItem {
  part_number?: string;
  description: string;
  quantity: number;
  unit_price?: number;
  amount?: number;
  item_url?: string;
}

export interface PurchaseRequest {
  id: string;
  department: string;
  amount: number;
  status: string;
  description?: string;
  created_at: string;
  vendor?: string;
  priority?: string;
  requester_name?: string;
  item_url?: string;
  product_info?: ProductInfo | null;
  items?: PurchaseRequestLineItem[];
  line_items?: PurchaseRequestLineItem[];
  item_mode?: string;
  quantity?: number;
  unit_price?: number;
  quote_data?: any;
  request_type?: string;
  assigned_user?: string;
  gl_code?: string;
  currency?: string;
  attachments?: PurchaseRequestAttachment[];
}

interface CeoEvent {
  id: string;
  event_type: string;
  source: string;
  entity_id: string;
  data: Record<string, any>;
  created_at: string;
}

interface AuditLog {
  id: string;
  action: string;
  source_application: string;
  target_application: string;
  target_entity: string;
  requested_by: string;
  result: string;
  details: Record<string, any>;
  created_at: string;
}

interface SummaryData {
  assets: number;
  assetsChange: number;
  liabilities: number;
  liabilitiesChange: number;
  equity: number;
  equityChange: number;
  netIncome: number;
  netIncomeChange: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [tierFilter, setTierFilter] = useState<"ALL" | "SENIOR" | "STANDARD">("ALL");
  const [approvalViewMode, setApprovalViewMode] = useState<"pending" | "approved">("pending");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selected request for action modal
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [detailedRequest, setDetailedRequest] = useState<PurchaseRequest | null>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [isAssignApproversOpen, setIsAssignApproversOpen] = useState(false);

  // Real-time Event Stream
  const { isConnected, lastSyncedAt, triggerManualSync } = useCeoRealtimeStream();

  // Queries with efficient stale-time & real-time SSE push updates
  const { data: portals = [], refetch: refetchPortals, isFetching: isFetchingPortals } = useQuery<PortalStatus[]>({
    queryKey: ["portalsStatus"],
    queryFn: () => apiClient.get<PortalStatus[]>("/api/v1/ceo/portals-status"),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: rawApprovals = [], isLoading: isApprovalsLoading, refetch: refetchApprovals, isFetching: isFetchingApprovals } = useQuery<PurchaseRequest[]>({
    queryKey: ["pendingApprovals"],
    queryFn: () => apiClient.get<PurchaseRequest[]>("/api/v1/ceo/approvals/pending"),
    staleTime: 3000,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const pendingApprovals = useMemo(() => {
    return rawApprovals || [];
  }, [rawApprovals]);

  const { data: summary } = useQuery<SummaryData>({
    queryKey: ["summaryMetrics"],
    queryFn: () => apiClient.get<SummaryData>("/api/dashboard/summary"),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: events = [], refetch: refetchEvents } = useQuery<CeoEvent[]>({
    queryKey: ["ceoEvents"],
    queryFn: () => apiClient.get<CeoEvent[]>("/api/v1/ceo/events"),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: auditLogs = [], refetch: refetchAudit } = useQuery<AuditLog[]>({
    queryKey: ["ceoAuditLogs"],
    queryFn: () => apiClient.get<AuditLog[]>("/api/v1/ceo/audit-logs"),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Detail query for active selected detailed request to load items & quotes from DB
  const { data: requestDetailResponse } = useQuery({
    queryKey: ["approvalDetail", detailedRequest?.id],
    queryFn: async () => {
      if (!detailedRequest?.id) return null;
      const res = await apiClient.get<any>(`/api/v1/ceo/approvals/${detailedRequest.id}`);
      return res?.request || res;
    },
    enabled: Boolean(detailedRequest?.id),
    staleTime: 10000,
  });

  const activeRequest = useMemo(() => {
    if (!detailedRequest) return null;
    if (requestDetailResponse && typeof requestDetailResponse === "object") {
      return { ...detailedRequest, ...requestDetailResponse };
    }
    return detailedRequest;
  }, [detailedRequest, requestDetailResponse]);

  // Action Mutation
  const actionMutation = useMutation({
    mutationFn: async ({ requestId, action, note }: { requestId: string; action: string; note: string }) => {
      return apiClient.post(`/api/v1/ceo/approvals/${requestId}/action`, { action, note });
    },
    onSuccess: (_, variables) => {
      const verb = variables.action === "APPROVE" ? "approved" : "rejected";
      toast.success(`Purchase Request #${variables.requestId} successfully ${verb}!`, {
        description: "Synchronized with Administration Portal and logged to CEO audit trail.",
      });
      setSelectedRequest(null);
      setActionType(null);
      setActionNote("");
      queryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
      queryClient.invalidateQueries({ queryKey: ["ceoAuditLogs"] });
      queryClient.invalidateQueries({ queryKey: ["ceoEvents"] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || "Could not complete action";
      toast.error(`Action failed: ${msg}`);
    },
  });

  const isActionable = (status?: string) => {
    if (!status) return true;
    const s = status.trim().toUpperCase().replace(/\s+/g, "_");
    return !["APPROVED", "REJECTED", "CANCELLED", "CANCEL", "COMPLETED"].includes(s);
  };

  const handleOpenAction = (req: PurchaseRequest, type: "APPROVE" | "REJECT") => {
    if (!isActionable(req.status)) {
      toast.error(`Request #${req.id} is already ${req.status.toLowerCase()} and cannot be approved or rejected again.`);
      return;
    }
    setSelectedRequest(req);
    setActionType(type);
    setActionNote(type === "APPROVE" ? "Executive approval granted." : "Requires additional review and budget adjustment.");
  };

  const handleConfirmAction = () => {
    if (!selectedRequest || !actionType) return;
    if (!isActionable(selectedRequest.status)) {
      toast.error(`Request #${selectedRequest.id} is already ${selectedRequest.status.toLowerCase()} and cannot be modified.`);
      setSelectedRequest(null);
      setActionType(null);
      return;
    }
    actionMutation.mutate({
      requestId: selectedRequest.id,
      action: actionType,
      note: actionNote,
    });
  };

  const refreshAll = () => {
    triggerManualSync();
    refetchPortals();
    refetchApprovals();
    refetchEvents();
    refetchAudit();
    queryClient.invalidateQueries({ queryKey: ["summaryMetrics"] });
    toast.info("Refreshed all live executive feeds");
  };

  const approvedRequests = useMemo(() => {
    const list: Array<{
      id: string;
      department: string;
      requester_name: string;
      amount: number;
      description: string;
      status: string;
      approved_at: string;
      note: string;
      vendor?: string;
      rawReq?: any;
    }> = [];

    const seenIds = new Set<string>();

    auditLogs.forEach((log) => {
      if (log.action === "PURCHASE_APPROVE" && (log.result === "SUCCESS" || log.details?.response?.success)) {
        const reqData = log.details?.response?.data?.request || {};
        const poData = log.details?.response?.data?.purchase_order || {};
        const id = String(reqData.id || log.target_entity || log.id);
        if (!seenIds.has(id)) {
          seenIds.add(id);
          list.push({
            id,
            department: reqData.department || "Executive Operations",
            requester_name: reqData.requester || log.requested_by || "Staff Requester",
            amount: Number(reqData.amount || poData.amount || 0),
            description: reqData.title || reqData.description || poData.item || `Approved Request #${id}`,
            status: "APPROVED",
            approved_at: log.created_at,
            note: log.details?.note || "Executive approval granted.",
            vendor: poData.vendor || "Verified Vendor",
            rawReq: {
              id,
              department: reqData.department || "Executive Operations",
              requester_name: reqData.requester || log.requested_by || "Staff Requester",
              amount: Number(reqData.amount || poData.amount || 0),
              description: reqData.title || reqData.description || poData.item || `Approved Request #${id}`,
              status: "APPROVED",
              created_at: log.created_at,
              vendor: poData.vendor || "Verified Vendor",
            },
          });
        }
      }
    });

    return list;
  }, [auditLogs]);

  // Filtered requests
  const filteredApprovals = useMemo(() => {
    return pendingApprovals.filter((req) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        (req.description || "").toLowerCase().includes(q) ||
        (req.department || "").toLowerCase().includes(q) ||
        (req.requester_name || "").toLowerCase().includes(q) ||
        req.id.includes(q);

      const stNorm = (req.status || "").toUpperCase().replace(" ", "_");
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "WAITING_APPROVAL" && (stNorm === "WAITING_APPROVAL" || stNorm === "PENDING")) ||
        (statusFilter === "NEW" && stNorm === "NEW") ||
        (statusFilter === "UNDER_REVIEW" && stNorm === "UNDER_REVIEW");

      const matchesTier =
        tierFilter === "ALL" ||
        (tierFilter === "SENIOR" && req.amount >= 10000) ||
        (tierFilter === "STANDARD" && req.amount < 10000);

      return matchesSearch && matchesStatus && matchesTier;
    });
  }, [pendingApprovals, searchTerm, statusFilter, tierFilter]);

  const filteredApproved = useMemo(() => {
    return approvedRequests.filter((req) => {
      const q = searchTerm.toLowerCase();
      return (
        (req.description || "").toLowerCase().includes(q) ||
        (req.department || "").toLowerCase().includes(q) ||
        (req.requester_name || "").toLowerCase().includes(q) ||
        (req.vendor || "").toLowerCase().includes(q) ||
        req.id.includes(q)
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

  const totalPendingAmount = pendingApprovals.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalApprovedAmount = approvedRequests.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const getPriorityBadge = (priority?: string) => {
    const p = (priority || "normal").toLowerCase();
    if (p === "high" || p === "urgent") {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
          Urgent
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
        Normal
      </span>
    );
  };

  const getStatusBadge = (status?: string) => {
    const st = (status || "").toUpperCase().replace(" ", "_");
    if (st === "WAITING_APPROVAL" || st === "PENDING") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-900 whitespace-nowrap">
          Pending CEO Review
        </span>
      );
    }
    if (st === "UNDER_REVIEW") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-900 whitespace-nowrap">
          Under Review
        </span>
      );
    }
    if (st === "APPROVED") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 whitespace-nowrap">
          Approved
        </span>
      );
    }
    if (st === "REJECTED") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-900 whitespace-nowrap">
          Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 whitespace-nowrap">
        {status || "New"}
      </span>
    );
  };
  // Active product info and line items for modal
  const activeProductInfo = useMemo(() => {
    if (!activeRequest) return null;
    let info = activeRequest.product_info;
    if (typeof info === "string") {
      try {
        info = JSON.parse(info);
      } catch {
        info = null;
      }
    }
    return info && typeof info === "object" && Object.keys(info).length > 0 ? (info as ProductInfo) : null;
  }, [activeRequest]);

  const activeLineItems = useMemo(() => {
    if (!activeRequest) return [];
    let items = activeRequest.items || activeRequest.line_items || [];
    if (typeof items === "string") {
      try {
        items = JSON.parse(items);
      } catch {
        items = [];
      }
    }
    return Array.isArray(items) ? (items as PurchaseRequestLineItem[]) : [];
  }, [activeRequest]);

  return (
    <div className="w-full flex flex-col gap-4 sm:gap-5 p-4 sm:p-6 lg:p-7 min-h-screen bg-slate-50/40 dark:bg-zinc-950 transition-colors">
      {/* Executive Seamless Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-zinc-800/80">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              Executive Command Center
            </h1>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
              <span>{isConnected ? "Live Connected" : "Connecting..."}</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Welcome back, <span className="font-semibold text-slate-800 dark:text-zinc-200">{user?.full_name || "Chief Executive Officer"}</span>. Unified executive governance, real-time approval pipelines, and financial telemetry.
          </p>
        </div>

        {/* Quick Action Executive Toolbar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
          <Button
            size="sm"
            onClick={() => setIsAssignApproversOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium h-9 px-3.5 rounded-xl shadow-2xs gap-1.5 transition-all"
          >
            <UserCheck className="w-4 h-4" />
            <span>Assign Approvers</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isFetchingPortals || isFetchingApprovals}
            className="text-xs h-9 px-3 rounded-xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 gap-1.5 transition-all"
            title={`Last synced: ${lastSyncedAt.toLocaleTimeString()}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(isFetchingApprovals || isFetchingPortals) ? "animate-spin text-indigo-600" : ""}`} />
            <span className="hidden sm:inline">Sync All</span>
            <span className="text-[10px] text-muted-foreground font-mono hidden md:inline">
              ({lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})
            </span>
          </Button>
        </div>
      </div>

      {/* Multi-Portal Health Ticker */}
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
            <Server className="w-3 h-3 text-slate-400" />
            Connected Systems
          </span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            All Pipelines Active
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {portals.map((portal) => {
            const isExternal = portal.code.toUpperCase().includes("ADMIN") || portal.name.toLowerCase().includes("admin") || portal.code.toUpperCase().includes("M7A") || portal.name.toLowerCase().includes("m&a");
            return (
              <div
                key={portal.code}
                onClick={() => {
                  const c = portal.code.toUpperCase();
                  const n = portal.name.toLowerCase();
                  if (c.includes("ADMIN") || n.includes("admin")) {
                    window.open(getEnv("VITE_ADMIN_PORTAL_URL", "http://localhost:5174") + "/purchasing/requests", "_blank");
                  } else if (c.includes("M7A") || c.includes("M&A") || n.includes("m&a")) {
                    window.open(getEnv("VITE_MA_PORTAL_URL", "http://localhost:5173"), "_blank");
                  } else if (c.includes("FINANCE") || n.includes("finance")) {
                    const el = document.querySelector('[value="financials"]') as HTMLElement;
                    if (el) el.click();
                  }
                }}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800/80 text-xs hover:border-indigo-300 dark:hover:border-indigo-700/60 hover:bg-slate-100/80 dark:hover:bg-zinc-800/70 hover:shadow-2xs cursor-pointer transition-all group"
                title={isExternal ? `Open ${portal.name} in new tab` : `View ${portal.name} details`}
              >
                <div className="min-w-0 pr-2 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate block text-[11px] sm:text-xs transition-colors">
                      {portal.name}
                    </span>
                    {isExternal && (
                      <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0" />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">:{portal.port}</span>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                      portal.status === "online"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300"
                    }`}
                  >
                    {portal.status}
                  </span>
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">{portal.latency_ms}ms</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4 Executive KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Treasury Card */}
        <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:shadow-xs transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                Treasury & Liquid Assets
              </span>
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100">
                ${(summary?.assets || 1450000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <ArrowUpRight className="h-3 w-3" />
                <span>+2.4% vs last month</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Net Income */}
        <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:shadow-xs transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                Monthly Net Income
              </span>
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100">
                ${(summary?.netIncome || 370000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                <ArrowUpRight className="h-3 w-3" />
                <span>+5.4% operating margin</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:shadow-xs transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                Pending Approvals
              </span>
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100">
                  {pendingApprovals.length}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400">
                  (${totalPendingAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Requires executive sign-off</p>
            </div>
          </CardContent>
        </Card>

        {/* Approved Decisions */}
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
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {approvedRequests.length}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  (${totalApprovedAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Logged to central audit trail</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Container */}
      <Tabs defaultValue="approvals" className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-2.5">
          <TabsList className="bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl h-auto flex flex-wrap">
            <TabsTrigger value="approvals" className="gap-1.5 rounded-lg text-xs sm:text-sm font-medium py-1.5 px-3">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Approvals ({pendingApprovals.length})</span>
            </TabsTrigger>
            <TabsTrigger value="financials" className="gap-1.5 rounded-lg text-xs sm:text-sm font-medium py-1.5 px-3">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Financial Overview</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-1.5 rounded-lg text-xs sm:text-sm font-medium py-1.5 px-3">
              <Activity className="h-3.5 w-3.5" />
              <span>Audit Logs ({events.length + auditLogs.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Executive Approvals Table */}
        <TabsContent value="approvals" className="space-y-3 outline-none">
          {/* Controls Bar: Search, Filters & View Mode */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
            {/* View Mode Toggle: Pending vs Approved */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => {
                  setApprovalViewMode("pending");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  approvalViewMode === "pending"
                    ? "bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-300 shadow-2xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
                }`}
              >
                Pending Review ({pendingApprovals.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setApprovalViewMode("approved");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  approvalViewMode === "approved"
                    ? "bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-300 shadow-2xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
                }`}
              >
                Approved History ({approvedRequests.length})
              </button>
            </div>

            {/* Search Input & Status Filter */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full md:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search ID, description, requester, dept..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-8 text-xs bg-slate-50/60 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-lg w-full"
                />
              </div>

              {approvalViewMode === "pending" && (
                <div className="flex items-center gap-1 shrink-0 overflow-x-auto">
                  {["ALL", "WAITING_APPROVAL", "UNDER_REVIEW", "NEW"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        setStatusFilter(st);
                        setCurrentPage(1);
                      }}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                        statusFilter === st
                          ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                          : "bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {st === "ALL" ? "All" : st.replace("_", " ")}
                    </button>
                  ))}

                  <div className="h-4 w-[1px] bg-slate-200 dark:bg-zinc-700 mx-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setTierFilter((prev) => (prev === "ALL" ? "SENIOR" : prev === "SENIOR" ? "STANDARD" : "ALL"));
                      setCurrentPage(1);
                    }}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all border ${
                      tierFilter === "SENIOR"
                        ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300"
                        : tierFilter === "STANDARD"
                        ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                        : "bg-transparent text-slate-500 border-transparent hover:bg-slate-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {tierFilter === "ALL" ? "All Tiers" : tierFilter === "SENIOR" ? "≥ $10k Tier" : "< $10k Tier"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Clean Proportional Executive Data Table */}
          <div className="w-full border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl shadow-2xs overflow-hidden">
            {isApprovalsLoading ? (
              <div className="p-12 text-center">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Loading purchasing requests...</p>
              </div>
            ) : currentList.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  {approvalViewMode === "pending" ? "All caught up!" : "No approved records found"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {approvalViewMode === "pending"
                    ? "There are no pending requests matching your current filter criteria."
                    : "No historical approved purchases match your search."}
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
                          className="hover:bg-slate-50/90 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer group"
                        >
                          {/* ID / Date */}
                          <td className="py-3 px-4 align-middle whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              #{req.id}
                            </span>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {req.created_at ? new Date(req.created_at).toLocaleDateString() : "-"}
                            </div>
                          </td>

                          {/* Requester & Dept */}
                          <td className="py-3 px-4 align-middle whitespace-nowrap">
                            <div className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[150px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {req.requester_name || "Staff Requester"}
                            </div>
                            <div className="mt-0.5">
                              <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                                {req.department || "Operations"}
                              </span>
                            </div>
                          </td>

                          {/* Description (Flexible & fills middle width) */}
                          <td className="py-3 px-4 align-middle">
                            <div className="font-medium text-slate-900 dark:text-zinc-100 leading-snug line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {req.description || `Purchase Request #${req.id}`}
                            </div>
                            {req.vendor && (
                              <span className="text-[10px] text-muted-foreground mt-0.5 block truncate">
                                Vendor: {req.vendor}
                              </span>
                            )}
                          </td>

                          {/* Priority */}
                          <td className="py-3 px-4 align-middle text-center whitespace-nowrap">
                            {getPriorityBadge(req.priority)}
                          </td>

                          {/* Tier Badge */}
                          <td className="py-3 px-4 align-middle text-center whitespace-nowrap">
                            {req.amount >= 10000 ? (
                              <span className="inline-block text-[10px] px-2 py-0.5 rounded font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                Senior (≥$10k)
                              </span>
                            ) : (
                              <span className="inline-block text-[10px] px-2 py-0.5 rounded font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                Standard (&lt;$10k)
                              </span>
                            )}
                          </td>

                          {/* Amount */}
                          <td className="py-3 px-4 align-middle text-right whitespace-nowrap">
                            <span className="font-bold text-sm text-slate-900 dark:text-zinc-100 font-mono">
                              ${req.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 align-middle text-center whitespace-nowrap">
                            {getStatusBadge(req.status)}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 align-middle text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAction(req, "REJECT");
                                }}
                                className="h-7 px-2 text-rose-600 hover:text-rose-700 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] gap-1 rounded-lg"
                              >
                                <X className="w-3 h-3" />
                                <span>Reject</span>
                              </Button>

                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAction(req, "APPROVE");
                                }}
                                className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] gap-1 rounded-lg shadow-2xs"
                              >
                                <Check className="w-3 h-3" />
                                <span>Approve</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      paginatedApproved.map((req) => (
                        <tr
                          key={req.id}
                          onClick={() => setDetailedRequest(req.rawReq || req)}
                          className="hover:bg-slate-50/90 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer group"
                        >
                          <td className="py-3 px-4 align-middle whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              #{req.id}
                            </span>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(req.approved_at).toLocaleDateString()}
                            </div>
                          </td>

                          <td className="py-3 px-4 align-middle whitespace-nowrap">
                            <div className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[150px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {req.requester_name}
                            </div>
                            <div className="mt-0.5">
                              <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                                {req.department}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 align-middle">
                            <div className="font-medium text-slate-900 dark:text-zinc-100 line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {req.description}
                            </div>
                          </td>

                          <td className="py-3 px-4 align-middle text-center whitespace-nowrap">
                            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600 dark:bg-zinc-800">
                              Normal
                            </span>
                          </td>

                          <td className="py-3 px-4 align-middle text-center whitespace-nowrap">
                            {req.amount >= 10000 ? (
                              <span className="inline-block text-[10px] px-2 py-0.5 rounded font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200">
                                Senior (≥$10k)
                              </span>
                            ) : (
                              <span className="inline-block text-[10px] px-2 py-0.5 rounded font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200">
                                Standard (&lt;$10k)
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 align-middle text-right whitespace-nowrap">
                            <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                              ${req.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>

                          <td className="py-3 px-4 align-middle text-center whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200">
                              Approved
                            </span>
                          </td>

                          <td className="py-3 px-4 align-middle text-right whitespace-nowrap">
                            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium group-hover:underline">
                              View Details &rarr;
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tidy Table Pagination Footer */}
            {currentList.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>
                    Showing {(safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, currentList.length)} of {currentList.length} items
                  </span>
                  <span className="text-slate-300 dark:text-zinc-700">•</span>
                  <div className="flex items-center gap-1">
                    <span>Rows:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-transparent font-medium border border-slate-200 dark:border-zinc-700 rounded px-1.5 py-0.5 text-xs text-slate-800 dark:text-zinc-200 outline-none"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={safePage === 1}
                    className="h-7 w-7 p-0 rounded-lg"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="h-7 w-7 p-0 rounded-lg"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>

                  <span className="px-2.5 font-medium text-slate-700 dark:text-zinc-300">
                    Page {safePage} of {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="h-7 w-7 p-0 rounded-lg"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safePage === totalPages}
                    className="h-7 w-7 p-0 rounded-lg"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Financial Overview */}
        <TabsContent value="financials" className="space-y-4 outline-none">
          {/* Period Selection */}
          <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Financial Reporting Timeline</span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg">
              {(["monthly", "quarterly", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                    period === p
                      ? "bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-300 shadow-2xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RevenueExpenseChart period={period} />
            <BankBalancesChart />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AccountTypeDonut />
            <RecentTransactionsTable />
          </div>
        </TabsContent>

        {/* Tab 3: System Audit & Events */}
        <TabsContent value="events" className="space-y-4 outline-none">
          <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl overflow-hidden shadow-2xs">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800">
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                Immutable System Audit Trail
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time synchronized ledger recording every executive authorization, cross-portal delegation, and role modification.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No executive audit logs recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-zinc-800 max-h-[500px] overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3.5 sm:p-4 hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 dark:text-zinc-100 font-mono">
                            {log.action}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                            {log.result}
                          </Badge>
                          <span className="text-muted-foreground">Target: {log.target_entity}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Triggered by <strong className="text-slate-700 dark:text-zinc-300">{log.requested_by}</strong> ({log.source_application} &rarr; {log.target_application})
                        </p>
                      </div>
                      <div className="text-right shrink-0 text-[10px] text-slate-400 font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog: Approve or Reject */}
      <Dialog open={Boolean(selectedRequest && actionType)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
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
                  Purchase Request #{selectedRequest?.id} • ${(selectedRequest?.amount || 0).toLocaleString()}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/60 text-xs space-y-1">
              <div><strong>Requester:</strong> {selectedRequest?.requester_name || "Staff"}</div>
              <div><strong>Department:</strong> {selectedRequest?.department}</div>
              <div><strong>Description:</strong> {selectedRequest?.description}</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Executive Note / Justification
              </label>
              <Textarea
                rows={3}
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Enter executive comments or approval rationale..."
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmAction}
              disabled={actionMutation.isPending}
              className={
                actionType === "APPROVE"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                  : "bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5"
              }
            >
              {actionMutation.isPending ? "Executing..." : actionType === "APPROVE" ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detailed Request Modal */}
      <Dialog open={Boolean(detailedRequest)} onOpenChange={(open) => !open && setDetailedRequest(null)}>
        <DialogContent className="w-[95vw] sm:max-w-[750px] max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          <div className="p-5 sm:p-6 border-b border-border/60 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between shrink-0">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Purchase Request #{activeRequest?.id}</span>
                {activeRequest?.priority && (
                  <Badge variant="outline" className={`text-[10px] uppercase font-bold ${
                    activeRequest.priority.toUpperCase() === "HIGH" || activeRequest.priority.toUpperCase() === "URGENT"
                      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                      : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                  }`}>
                    {activeRequest.priority}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {activeRequest?.department} • Created {activeRequest?.created_at ? new Date(activeRequest.created_at).toLocaleDateString() : ""}
              </DialogDescription>
            </div>
            <div className="text-right pr-6 sm:pr-8">
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                ${(activeRequest?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="block text-[10px] text-muted-foreground uppercase font-semibold">
                {activeRequest?.currency || "USD"} Total
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
            {/* Request Overview */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 space-y-2 border border-slate-100 dark:border-zinc-800">
              <div className="font-semibold text-slate-900 dark:text-zinc-100 flex items-center justify-between">
                <span>Description & Purpose</span>
                <span className="text-[11px] font-normal text-muted-foreground">Type: <strong className="text-slate-700 dark:text-zinc-300">{activeRequest?.request_type || "SPEND"}</strong></span>
              </div>
              <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                {activeRequest?.description || "No description provided."}
              </p>
              <div className="pt-2 flex flex-wrap gap-4 text-muted-foreground border-t border-slate-200/60 dark:border-zinc-700 text-[11px]">
                <span>Requester: <strong className="text-slate-700 dark:text-zinc-300">{activeRequest?.requester_name || "Staff Requester"}</strong></span>
                <span>Department: <strong className="text-slate-700 dark:text-zinc-300">{activeRequest?.department || "Operations"}</strong></span>
                {activeRequest?.gl_code && (
                  <span>GL Code: <strong className="text-slate-700 dark:text-zinc-300">{activeRequest.gl_code}</strong></span>
                )}
                {activeRequest?.assigned_user && (
                  <span>Assigned Approvers: <strong className="text-slate-700 dark:text-zinc-300">{activeRequest.assigned_user}</strong></span>
                )}
              </div>
            </div>

            {/* Product Page Link */}
            {activeRequest?.item_url && (
              <a
                href={activeRequest.item_url.startsWith("http") ? activeRequest.item_url : `https://${activeRequest.item_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/60 transition-colors text-xs font-medium group"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <ExternalLink className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <span className="truncate">Product Link: {activeRequest.item_url}</span>
                </div>
                <span className="text-[11px] underline shrink-0 font-semibold group-hover:text-indigo-800">Visit Store &rarr;</span>
              </a>
            )}

            {/* AI Product Analysis & Specification (Single Item) */}
            {activeProductInfo && (
              <Card className="border-indigo-100 bg-indigo-50/40 dark:border-indigo-900/50 dark:bg-indigo-950/20 shadow-xs">
                <CardHeader className="py-2.5 px-4 border-b border-indigo-100/80 dark:border-indigo-900/50">
                  <CardTitle className="text-xs font-bold flex items-center justify-between text-indigo-900 dark:text-indigo-100">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <span>AI Product Analysis & Specification</span>
                    </div>
                    {activeProductInfo.category && (
                      <Badge variant="outline" className="bg-white dark:bg-zinc-900 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px]">
                        {activeProductInfo.category}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  {activeProductInfo.name && (
                    <div className="sm:col-span-2">
                      <span className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400 block mb-0.5">Product Title</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">{activeProductInfo.name}</span>
                    </div>
                  )}
                  {activeProductInfo.price && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400 block mb-0.5">Extracted Unit Price</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        ${activeProductInfo.price} {activeProductInfo.currency || "USD"}
                      </span>
                    </div>
                  )}
                  {activeProductInfo.brand && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400 block mb-0.5">Brand</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{activeProductInfo.brand}</span>
                    </div>
                  )}
                  {activeProductInfo.vendor && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400 block mb-0.5">Vendor / Seller</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{activeProductInfo.vendor}</span>
                    </div>
                  )}
                  {Boolean(activeRequest?.quantity) && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400 block mb-0.5">Quantity</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{activeRequest?.quantity} unit{(activeRequest?.quantity ?? 1) > 1 ? "s" : ""}</span>
                    </div>
                  )}
                  {activeProductInfo.description && (
                    <div className="sm:col-span-2">
                      <span className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400 block mb-0.5">Product Details</span>
                      <p className="text-slate-600 dark:text-zinc-400 leading-relaxed text-[11px] bg-white/70 dark:bg-zinc-900/70 p-2.5 rounded-lg border border-indigo-100/70 dark:border-indigo-900/40">
                        {activeProductInfo.description}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Line Items Table for Multiple Parts */}
            {activeLineItems.length > 0 && (
              <div className="space-y-2.5">
                <div className="font-semibold text-slate-900 dark:text-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Quotation Items & Parts Breakdown ({activeLineItems.length})</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300">
                    Currency: {activeRequest?.currency || "USD"}
                  </Badge>
                </div>
                <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800 text-slate-500 font-bold text-[10px] uppercase">
                      <tr>
                        <th className="py-2.5 px-3 text-left w-8">#</th>
                        <th className="py-2.5 px-3 text-left">SKU / Part</th>
                        <th className="py-2.5 px-3 text-left">Description</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Price ({activeRequest?.currency || "USD"})</th>
                        <th className="py-2.5 px-3 text-right">Total ({activeRequest?.currency || "USD"})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {activeLineItems.map((it, idx) => {
                        const unitPrice = typeof it.unit_price === 'number' ? it.unit_price : parseFloat(String(it.unit_price || '0')) || 0;
                        const qty = typeof it.quantity === 'number' ? it.quantity : parseFloat(String(it.quantity || '1')) || 1;
                        const lineTotal = (it.amount !== undefined && it.amount !== null && it.amount > 0) ? it.amount : (unitPrice * qty);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                            <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{it.part_number || "—"}</td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900 dark:text-zinc-100">{it.description || "Line item"}</div>
                              {it.item_url && (
                                <a
                                  href={it.item_url.startsWith("http") ? it.item_url : `https://${it.item_url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:underline mt-0.5"
                                >
                                  <span>Product Link</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-semibold text-slate-800 dark:text-zinc-200">{qty}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600 dark:text-zinc-400 font-medium">
                              ${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-zinc-100">
                              ${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="bg-slate-50/70 dark:bg-zinc-900/70 border-t border-slate-200 dark:border-zinc-800 p-3 flex flex-col items-end gap-1 text-xs">
                    <div className="text-slate-900 dark:text-zinc-100 font-bold text-sm flex items-center justify-between w-56 pt-1">
                      <span>Grand Total:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">${(activeRequest?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {activeRequest?.currency || "USD"}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5 border-t border-border/60 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setDetailedRequest(null)}>
              Close
            </Button>
            {activeRequest && isActionable(activeRequest.status) && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const req = activeRequest;
                    setDetailedRequest(null);
                    handleOpenAction(req, "REJECT");
                  }}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs"
                >
                  Reject Request
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const req = activeRequest;
                    setDetailedRequest(null);
                    handleOpenAction(req, "APPROVE");
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                >
                  Approve Request
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Approvers Modal Component */}
      <AssignApproversModal
        isOpen={isAssignApproversOpen}
        onClose={() => setIsAssignApproversOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
          refetchApprovals();
        }}
      />
    </div>
  );
}