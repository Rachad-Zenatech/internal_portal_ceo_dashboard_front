import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { apiClient } from "@/services/apiClient";
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
  Zap,
  Check,
  X,
  Server,
  Search,
  FileSpreadsheet,
  FileText,
  Building2,
  User,
  Calendar,
  Layers,
  ChevronRight,
  Download,
  Eye
} from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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

export interface PurchaseRequestAttachment {
  filename: string;
  file_url: string;
  file_type?: "excel" | "pdf" | "image" | "file";
  file_size?: string;
}

export interface PurchaseRequestLineItem {
  part_number?: string;
  description: string;
  quantity: number;
  unit_price?: number;
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
  attachments?: PurchaseRequestAttachment[];
  line_items?: PurchaseRequestLineItem[];
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
  
  // Selected request for action modal
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [detailedRequest, setDetailedRequest] = useState<PurchaseRequest | null>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(null);
  const [actionNote, setActionNote] = useState("");

  // Queries
  const { data: portals = [], refetch: refetchPortals } = useQuery<PortalStatus[]>({
    queryKey: ["portalsStatus"],
    queryFn: () => apiClient.get<PortalStatus[]>("/api/v1/ceo/portals-status"),
    refetchInterval: 15000,
  });

  const { data: rawApprovals = [], isLoading: isApprovalsLoading, refetch: refetchApprovals } = useQuery<PurchaseRequest[]>({
    queryKey: ["pendingApprovals"],
    queryFn: () => apiClient.get<PurchaseRequest[]>("/api/v1/ceo/approvals/pending"),
    refetchInterval: 10000,
  });

  const pendingApprovals = useMemo(() => {
    return rawApprovals || [];
  }, [rawApprovals]);

  const { data: summary } = useQuery<SummaryData>({
    queryKey: ["summaryMetrics"],
    queryFn: () => apiClient.get<SummaryData>("/api/dashboard/summary"),
  });

  const { data: events = [], refetch: refetchEvents } = useQuery<CeoEvent[]>({
    queryKey: ["ceoEvents"],
    queryFn: () => apiClient.get<CeoEvent[]>("/api/v1/ceo/events"),
    refetchInterval: 10000,
  });

  const { data: auditLogs = [], refetch: refetchAudit } = useQuery<AuditLog[]>({
    queryKey: ["ceoAuditLogs"],
    queryFn: () => apiClient.get<AuditLog[]>("/api/v1/ceo/audit-logs"),
    refetchInterval: 10000,
  });

  // Execute Action Mutation
  const actionMutation = useMutation({
    mutationFn: async ({ requestId, action, note }: { requestId: string; action: string; note: string }) => {
      return apiClient.post(`/api/v1/ceo/approvals/${requestId}/action`, { action, note });
    },
    onSuccess: (_, variables) => {
      const verb = variables.action === "APPROVE" ? "approved" : "rejected";
      toast.success(`Purchase Request #${variables.requestId} successfully ${verb}!`, {
        description: `Synchronous command forwarded to Admin Portal and logged to central audit trail.`,
      });
      setSelectedRequest(null);
      setActionType(null);
      setActionNote("");
      queryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
      queryClient.invalidateQueries({ queryKey: ["ceoAuditLogs"] });
      queryClient.invalidateQueries({ queryKey: ["ceoEvents"] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || "Could not complete request";
      toast.error(`Action failed: ${msg}`);
    }
  });

  const handleOpenAction = (req: PurchaseRequest, type: "APPROVE" | "REJECT") => {
    setSelectedRequest(req);
    setActionType(type);
    setActionNote(type === "APPROVE" ? "Executive approval granted." : "Requires additional review and budget adjustment.");
  };

  const handleConfirmAction = () => {
    if (!selectedRequest || !actionType) return;
    actionMutation.mutate({
      requestId: selectedRequest.id,
      action: actionType,
      note: actionNote
    });
  };

  const refreshAll = () => {
    refetchPortals();
    refetchApprovals();
    refetchEvents();
    refetchAudit();
    queryClient.invalidateQueries({ queryKey: ["summaryMetrics"] });
    toast.info("Refreshed all executive data feeds");
  };

  const [approvalViewMode, setApprovalViewMode] = useState<"pending" | "approved">("pending");

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
            description: reqData.title || reqData.description || poData.item || `Executive Approved Request #${id}`,
            status: "APPROVED",
            approved_at: log.created_at,
            note: log.details?.note || "Executive approval granted.",
            vendor: poData.vendor || "Verified Vendor",
            rawReq: {
              id,
              department: reqData.department || "Executive Operations",
              requester_name: reqData.requester || log.requested_by || "Staff Requester",
              amount: Number(reqData.amount || poData.amount || 0),
              description: reqData.title || reqData.description || poData.item || `Executive Approved Request #${id}`,
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
      const matchesSearch =
        (req.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.department || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.requester_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.id.includes(searchTerm);
      
      const stNorm = (req.status || "").toUpperCase().replace(" ", "_");
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "WAITING_APPROVAL" && (stNorm === "WAITING_APPROVAL" || stNorm === "PENDING")) ||
        (statusFilter === "NEW" && stNorm === "NEW") ||
        (statusFilter === "UNDER_REVIEW" && stNorm === "UNDER_REVIEW");

      return matchesSearch && matchesStatus;
    });
  }, [pendingApprovals, searchTerm, statusFilter]);

  const filteredApproved = useMemo(() => {
    return approvedRequests.filter((req) => {
      return (
        (req.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.department || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.requester_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.vendor || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.id.includes(searchTerm)
      );
    });
  }, [approvedRequests, searchTerm]);

  const totalPendingAmount = pendingApprovals.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalApprovedAmount = approvedRequests.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 max-w-[1600px] mx-auto bg-slate-50/50 min-h-screen">
      {/* Top Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Executive Command Center
            </h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium px-2.5 py-0.5">
              Enterprise Hub
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back, <span className="font-semibold text-slate-800">{user?.full_name || "Chief Executive Officer"}</span>. Real-time multi-portal orchestration, synchronized delegation, and organizational telemetry.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            className="text-slate-600 hover:text-slate-900 border-slate-200 shadow-sm flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Sync All Feeds
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2"
            onClick={() => window.open(getEnv("VITE_ADMIN_PORTAL_URL", "http://localhost:5174") + "/purchasing/requests", "_blank")}
          >
            <ExternalLink className="h-4 w-4" />
            Open Admin Portal
          </Button>
        </div>
      </div>

      {/* Multi-Portal Ecosystem Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {portals.map((portal) => (
          <Card key={portal.code} className="border border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${portal.status === 'online' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900">{portal.name}</span>
                    <span className="text-xs text-slate-400">:{portal.port}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate max-w-[150px]">{portal.domain}</p>
                </div>
              </div>
              <div className="text-right">
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 ${
                    portal.status === 'online'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {portal.status}
                </Badge>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">{portal.latency_ms}ms</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Executive KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Treasury Card */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Treasury & Bank</span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900">
                ${(summary?.assets || 1450000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-600 font-medium">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>+2.4% vs last month</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Net Income */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly Net Income</span>
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900">
                ${(summary?.netIncome || 370000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-blue-600 font-medium">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>+5.4% operating margin</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Approvals</span>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{pendingApprovals.length}</span>
                <span className="text-sm font-semibold text-amber-700">
                  (${totalPendingAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Requires CEO sign-off</p>
            </div>
          </CardContent>
        </Card>

        {/* CEO Approved Requests Metric */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CEO Approved Decisions</span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-600">{approvedRequests.length}</span>
                <span className="text-sm font-semibold text-emerald-700">
                  (${totalApprovedAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Approved & synced to audit trail</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Container */}
      <Tabs defaultValue="approvals" className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <TabsList className="bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="approvals" className="gap-2 rounded-lg font-medium text-xs sm:text-sm">
              <ShieldCheck className="h-4 w-4" />
              Executive Approvals ({pendingApprovals.length} pending / {approvedRequests.length} approved)
            </TabsTrigger>
            <TabsTrigger value="financials" className="gap-2 rounded-lg font-medium text-xs sm:text-sm">
              <TrendingUp className="h-4 w-4" />
              Financial & Operations
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-2 rounded-lg font-medium text-xs sm:text-sm">
              <Activity className="h-4 w-4" />
              Event Stream & Audit ({events.length + auditLogs.length})
            </TabsTrigger>
          </TabsList>

          <Badge variant="outline" className="hidden sm:flex bg-slate-50 text-slate-600 border-slate-200">
            Auth Level: Executive Super Admin
          </Badge>
        </div>

        {/* TAB 1: EXECUTIVE APPROVALS CENTER */}
        <TabsContent value="approvals" className="space-y-4">
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                    <button
                      onClick={() => setApprovalViewMode("pending")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        approvalViewMode === "pending"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                      <span>Pending Approvals ({pendingApprovals.length})</span>
                    </button>
                    <button
                      onClick={() => setApprovalViewMode("approved")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        approvalViewMode === "approved"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Approved by CEO ({approvedRequests.length})</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-48 sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Search requests..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 text-xs h-8 bg-slate-50"
                    />
                  </div>
                  {approvalViewMode === "pending" && (
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                      {(["ALL", "WAITING_APPROVAL", "UNDER_REVIEW", "NEW"] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setStatusFilter(filter)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                            statusFilter === filter
                              ? "bg-white text-slate-900 shadow-sm font-semibold"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {filter === "ALL" ? "All" : filter.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {approvalViewMode === "pending" ? (
                isApprovalsLoading ? (
                  <div className="p-8 text-center text-slate-400">Loading pending requests...</div>
                ) : filteredApprovals.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-slate-800 text-sm">No Pending Approvals</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      All purchase requests matching the active filter are up to date.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600 font-medium text-xs border-b border-slate-100">
                        <tr>
                          <th className="py-3 px-4">Request ID</th>
                          <th className="py-3 px-4">Department / Requester</th>
                          <th className="py-3 px-4">Amount</th>
                          <th className="py-3 px-4">Description</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Executive Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredApprovals.map((req) => (
                          <tr
                            key={req.id}
                            className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                            onClick={() => setDetailedRequest(req)}
                          >
                            <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                              <div className="flex items-center gap-1.5 text-blue-600 group-hover:underline">
                                <span>#{req.id}</span>
                                <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-medium text-slate-800">{req.department || "Operations"}</div>
                              <div className="text-xs text-slate-400">{req.requester_name || "Staff"}</div>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              ${(req.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                              {req.description || "Purchase Order Request"}
                            </td>
                            <td className="py-3.5 px-4">
                              <Badge
                                variant="outline"
                                className={`text-[11px] font-semibold px-2 py-0.5 ${
                                  (req.status || "").toUpperCase().includes("WAITING")
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : (req.status || "").toUpperCase().includes("REVIEW")
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-slate-50 text-slate-700 border-slate-200"
                                }`}
                              >
                                {req.status || "WAITING_APPROVAL"}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-slate-700 border-slate-200 hover:bg-slate-100 text-xs h-8 px-2.5"
                                onClick={() => setDetailedRequest(req)}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1 text-slate-500" />
                                Details
                              </Button>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3"
                                onClick={() => handleOpenAction(req, "APPROVE")}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Approve
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                /* APPROVED BY CEO VIEW */
                filteredApproved.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-slate-800 text-sm">No Approved Requests Found</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      No purchase requests have been approved by the CEO yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-emerald-50/70 text-emerald-950 font-medium text-xs border-b border-emerald-100">
                        <tr>
                          <th className="py-3 px-4">Request ID</th>
                          <th className="py-3 px-4">Department / Requester</th>
                          <th className="py-3 px-4">Approved Amount</th>
                          <th className="py-3 px-4">Description / Scope</th>
                          <th className="py-3 px-4">Approval Decision & Date</th>
                          <th className="py-3 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredApproved.map((req) => (
                          <tr
                            key={req.id}
                            className="hover:bg-emerald-50/30 transition-colors cursor-pointer group"
                            onClick={() => setDetailedRequest(req.rawReq || req)}
                          >
                            <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                              <div className="flex items-center gap-1.5 text-emerald-700 font-bold group-hover:underline">
                                <span>#{req.id}</span>
                                <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-slate-900">{req.department}</div>
                              <div className="text-xs text-slate-500">{req.requester_name}</div>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-emerald-700">
                              ${req.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                              {req.description}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="text-xs font-medium text-slate-700 truncate max-w-xs">{req.note}</div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {new Date(req.approved_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[11px] px-2.5 py-0.5">
                                <Check className="h-3 w-3 mr-1" />
                                Approved
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: FINANCIAL & OPERATIONAL OVERVIEW */}
        <TabsContent value="financials" className="space-y-6">
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-600">Reporting View:</span>
            <div className="flex items-center gap-1.5">
              {(["monthly", "quarterly", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    period === p
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RevenueExpenseChart period={period} />
            <AccountTypeDonut />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <BankBalancesChart />
            </div>
            <div className="lg:col-span-2">
              <RecentTransactionsTable />
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: CONNECTED SYSTEMS INFRASTRUCTURE */}
        <TabsContent value="portals" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {portals.map((p) => (
              <Card key={p.code} className="border border-slate-200 shadow-sm bg-white hover:border-slate-300 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl ${p.status === 'online' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        <Server className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                          {p.name}
                          <span className="text-xs text-slate-400 font-mono">:{p.port}</span>
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500 mt-0.5">
                          {p.domain}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-bold px-2.5 py-1 ${
                        p.status === 'online'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {p.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-400">Response Latency:</span>
                      <div className="font-semibold text-slate-800 mt-0.5">{p.latency_ms} ms</div>
                    </div>
                    <div>
                      <span className="text-slate-400">HTTP Status:</span>
                      <div className="font-semibold text-slate-800 mt-0.5">{p.status_code || 200} OK</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 4: EVENT AUDIT STREAM */}
        <TabsContent value="events" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Live Event Stream */}
            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      Live Central Event Stream
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Real-time webhook and synchronization payloads
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600">
                    {events.length} Events
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                {events.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">No events recorded in this session.</div>
                ) : (
                  events.map((evt) => (
                    <div key={evt.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-blue-50 text-blue-600 mt-0.5">
                        <Activity className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-slate-900">{evt.event_type}</span>
                          <span className="text-[11px] text-slate-400">
                            {evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : ""}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Source: <span className="font-medium text-slate-800 uppercase">{evt.source}</span> | Entity: <span className="font-mono">{evt.entity_id}</span>
                        </div>
                        {evt.data && (
                          <div className="mt-2 text-[11px] font-mono bg-white p-2 rounded border border-slate-100 text-slate-600 max-h-20 overflow-y-auto">
                            {JSON.stringify(evt.data)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Audit Logs */}
            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Cross-Portal Audit Trail
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Compliance and cross-system decision audit logs
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600">
                    {auditLogs.length} Records
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                {auditLogs.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">No audit logs recorded yet.</div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-start gap-3">
                      <div className={`p-2 rounded-lg mt-0.5 ${log.result === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-slate-900">{log.action}</span>
                          <Badge variant="outline" className={`text-[10px] ${log.result === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {log.result}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Entity: <span className="font-mono font-medium">{log.target_entity}</span> | Target App: <span className="font-medium text-slate-800 uppercase">{log.target_application}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ========================================================= */}
      {/* FULL PURCHASE REQUEST DETAILS & ATTACHMENTS MODAL         */}
      {/* ========================================================= */}
      <Dialog open={!!detailedRequest} onOpenChange={(open) => !open && setDetailedRequest(null)}>
        <DialogContent className="sm:max-w-2xl bg-white max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-xl font-bold text-slate-900">
                      Request #{detailedRequest?.id}
                    </DialogTitle>
                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 font-semibold text-xs">
                      {detailedRequest?.department || "Operations"}
                    </Badge>
                  </div>
                  <DialogDescription className="text-xs text-slate-500 mt-0.5">
                    Executive purchase inspection and procurement audit trail.
                  </DialogDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold px-2.5 py-1 ${
                    (detailedRequest?.status || "").toUpperCase().includes("WAITING")
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}
                >
                  {detailedRequest?.status || "WAITING_APPROVAL"}
                </Badge>
                <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 font-semibold text-xs px-2.5 py-1">
                  {detailedRequest?.priority || "Normal"} Priority
                </Badge>
              </div>
            </div>
          </DialogHeader>

          {detailedRequest && (
            <div className="space-y-5 py-3 text-xs">
              {/* Financial Hero Header */}
              <div className="p-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Amount Requested</span>
                  <div className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-0.5">
                    ${(detailedRequest.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Decision Authority</span>
                  <div className="font-bold text-blue-700 text-xs mt-0.5 flex items-center gap-1 justify-end">
                    <ShieldCheck className="h-4 w-4" /> Executive CEO
                  </div>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Requester:</span>
                  <div className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                    <User className="h-3.5 w-3.5 text-blue-600" />
                    {detailedRequest.requester_name || "Alvin Tsang"}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Department:</span>
                  <div className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                    {detailedRequest.department || "Operations"}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Vendor / Supplier:</span>
                  <div className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Layers className="h-3.5 w-3.5 text-emerald-600" />
                    {detailedRequest.vendor || "Corporate Vendor"}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Submission Date:</span>
                  <div className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    {detailedRequest.created_at ? new Date(detailedRequest.created_at).toLocaleDateString() : new Date().toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Source Portal:</span>
                  <div className="font-semibold font-mono text-blue-600 mt-0.5">
                    Admin Portal
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Delegation:</span>
                  <div className="font-semibold text-emerald-700 mt-0.5">
                    Direct 2-Way Sync
                  </div>
                </div>
              </div>

              {/* Description & Business Justification */}
              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1.5">
                  Business Justification & Scope
                </h4>
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-slate-700 text-xs leading-relaxed">
                  {detailedRequest.description || "Executive procurement requisition awaiting authorized approval."}
                </div>
              </div>

              {/* Direct Product / Item Web Link */}
              {detailedRequest.item_url && (
                <div>
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1.5">
                    Direct Product / Item Web Link
                  </h4>
                  <a
                    href={detailedRequest.item_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-blue-50/80 hover:bg-blue-100/70 border border-blue-200 rounded-xl text-blue-700 font-medium transition-colors group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <ExternalLink className="h-4 w-4 shrink-0 text-blue-600" />
                      <span className="truncate text-xs">{detailedRequest.item_url}</span>
                    </div>
                    <span className="text-[11px] font-semibold flex items-center gap-1 shrink-0 ml-2 group-hover:underline">
                      Open in Store <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </a>
                </div>
              )}

              {/* Line Items Breakdown */}
              {detailedRequest.line_items && detailedRequest.line_items.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1.5">
                    Line Items & Parts Breakdown ({detailedRequest.line_items.length})
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Part #</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3 text-center">Qty</th>
                          <th className="py-2.5 px-3 text-right">Unit Price</th>
                          <th className="py-2.5 px-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailedRequest.line_items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-3 font-mono text-slate-500">{item.part_number || `ITEM-${idx + 1}`}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">
                              {item.item_url ? (
                                <a
                                  href={item.item_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  {item.description}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                item.description
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-semibold text-slate-700">x{item.quantity}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600">
                              ${(item.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              ${((item.unit_price || 0) * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Attached Excel Spreadsheets & Quote Documents */}
              {detailedRequest.attachments && detailedRequest.attachments.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1.5">
                    Attached Spreadsheets & Quotes ({detailedRequest.attachments.length})
                  </h4>
                  <div className="space-y-2">
                    {detailedRequest.attachments.map((att, idx) => {
                      const isExcel = att.file_type === "excel" || att.filename.endsWith(".xlsx") || att.filename.endsWith(".xls") || att.filename.endsWith(".csv");
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2.5 rounded-lg ${isExcel ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              {isExcel ? <FileSpreadsheet className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 text-xs truncate max-w-sm">
                                {att.filename}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {isExcel ? "EXCEL SPREADSHEET (.xlsx)" : "PDF DOCUMENT"} • {att.file_size || "128 KB"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={att.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Sheet
                            </a>
                            <a
                              href={att.file_url}
                              download={att.filename}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="border-t border-slate-100 pt-4 flex items-center justify-between sm:justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailedRequest(null)}
            >
              Close
            </Button>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs h-9 px-4 font-semibold"
                onClick={() => {
                  if (detailedRequest) {
                    const req = detailedRequest;
                    setDetailedRequest(null);
                    handleOpenAction(req, "REJECT");
                  }
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Reject Request
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-4 font-semibold shadow-sm"
                onClick={() => {
                  if (detailedRequest) {
                    const req = detailedRequest;
                    setDetailedRequest(null);
                    handleOpenAction(req, "APPROVE");
                  }
                }}
              >
                <Check className="h-4 w-4 mr-1" />
                Approve Request
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ACTION CONFIRMATION MODAL */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className={`p-1.5 rounded-lg ${actionType === 'APPROVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {actionType === 'APPROVE' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </span>
              Confirm Executive {actionType === "APPROVE" ? "Approval" : "Rejection"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              This action will dispatch a synchronous command to Admin Portal API and update the central audit log.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Request ID:</span>
                  <span className="font-mono font-semibold text-slate-900">#{selectedRequest.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Department:</span>
                  <span className="font-medium text-slate-800">{selectedRequest.department || "Operations"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Description:</span>
                  <span className="font-medium text-slate-800 truncate max-w-[240px]">{selectedRequest.description || "Purchase Request"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount:</span>
                  <span className="font-bold text-slate-900">${(selectedRequest.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Executive Note / Justification</label>
                <Textarea
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder="Enter reason or approval comments..."
                  className="text-xs h-20 bg-white"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setSelectedRequest(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className={actionType === "APPROVE" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"}
              onClick={handleConfirmAction}
              disabled={actionMutation.isPending}
            >
              {actionMutation.isPending ? "Executing..." : `Confirm ${actionType}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}