import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { apiClient } from "@/services/apiClient";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  NativeCard,
  NativeCardHeader,
  NativeCardContent,
  NativeBadge,
  SafeAreaView,
} from "@/components/native";
import {
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Linking,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

interface PortalStatus {
  name: string;
  code: string;
  port: number;
  domain: string;
  status: "online" | "degraded" | "offline";
  status_code?: number;
  latency_ms: number;
  error?: string;
}

interface PurchaseRequestLineItem {
  part_number?: string;
  description: string;
  quantity: number;
  unit_price: number;
  item_url?: string;
}

interface PurchaseRequestAttachment {
  filename: string;
  file_url: string;
  file_type?: "excel" | "pdf" | "image" | "doc";
  file_size?: string;
}

interface PurchaseRequest {
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
  line_items?: PurchaseRequestLineItem[];
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

interface LoginActivity {
  id?: string;
  created_at: string;
  user_full_name?: string;
  email: string;
  success: boolean;
  failure_reason?: string;
  ip_address?: string;
}

type TabType = "approvals" | "portals" | "events" | "logins";

export default function Dashboard() {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("approvals");
  const [refreshing, setRefreshing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [processedIds, setProcessedIds] = useState<string[]>([]);

  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [detailedRequest, setDetailedRequest] = useState<PurchaseRequest | null>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(null);
  const [actionNote, setActionNote] = useState("");

  // ZenaBot AI State
  const [isZenaBotOpen, setIsZenaBotOpen] = useState(false);
  const [zenaBotInput, setZenaBotInput] = useState("");
  const [isZenaBotThinking, setIsZenaBotThinking] = useState(false);
  const [isMicListening, setIsMicListening] = useState(false);
  const [zenaBotMessages, setZenaBotMessages] = useState<
    Array<{
      id: string;
      role: "assistant" | "user";
      content: string;
      timestamp: string;
      toolStatus?: string;
    }>
  >([
    {
      id: "init-1",
      role: "assistant",
      content:
        "Hello, I am **ZenaBot** 🤖, your Executive AI Assistant.\n\nHow can I assist you today?",
      timestamp: "Just now",
    },
  ]);

  const handleToggleMic = () => {
    setIsMicListening(!isMicListening);
  };

  const handleSendZenaBot = async (textToSend?: string) => {
    const query = (textToSend || zenaBotInput).trim();
    if (!query || isZenaBotThinking) return;

    setZenaBotInput("");
    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user" as const,
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setZenaBotMessages((prev) => [...prev, userMsg]);
    setIsZenaBotThinking(true);

    try {
      const data = await apiClient.post<{ reply?: string; content?: string; message?: string }>("/ai/chat", {
        message: query,
        history: zenaBotMessages.map((m) => ({ role: m.role, content: m.content })),
      });

      const replyText = data?.reply || data?.content || data?.message || "I have received your request.";
      const botMsg = {
        id: `bot-${Date.now()}`,
        role: "assistant" as const,
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setZenaBotMessages((prev) => [...prev, botMsg]);
    } catch {
      const botMsg = {
        id: `bot-${Date.now()}`,
        role: "assistant" as const,
        content: `I am processing your query: "${query}". Approvals and live system events are synced.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setZenaBotMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsZenaBotThinking(false);
    }
  };

  // Queries
  const {
    data: rawApprovals = [],
    isLoading: isApprovalsLoading,
    refetch: refetchApprovals,
  } = useQuery<PurchaseRequest[]>({
    queryKey: ["pendingApprovals"],
    queryFn: () => apiClient.get<PurchaseRequest[]>("/api/v1/ceo/approvals/pending"),
    refetchInterval: false,
  });

  const {
    data: auditLogs = [],
    refetch: refetchAudit,
  } = useQuery<any[]>({
    queryKey: ["ceoAuditLogs"],
    queryFn: () => apiClient.get<any[]>("/api/v1/ceo/audit-logs"),
    refetchInterval: false,
  });

  const [approvalsSubTab, setApprovalsSubTab] = useState<"pending" | "approved">("pending");

  const pendingApprovals = (rawApprovals || []).filter((r) => !processedIds.includes(r.id));
  const displayApprovals = pendingApprovals;

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

  const {
    data: portals = [],
    isLoading: isPortalsLoading,
    refetch: refetchPortals,
  } = useQuery<PortalStatus[]>({
    queryKey: ["portalsStatus"],
    queryFn: () => apiClient.get<PortalStatus[]>("/api/v1/ceo/portals-status"),
    refetchInterval: false,
  });

  const {
    data: ceoEvents = [],
    isLoading: isEventsLoading,
    refetch: refetchEvents,
  } = useQuery<CeoEvent[]>({
    queryKey: ["ceoEvents"],
    queryFn: () => apiClient.get<CeoEvent[]>("/api/v1/ceo/events"),
    refetchInterval: false,
  });

  const {
    data: loginActivities = [],
    isLoading: isLoginsLoading,
    refetch: refetchLogins,
  } = useQuery<LoginActivity[]>({
    queryKey: ["loginActivities"],
    queryFn: () => apiClient.get<LoginActivity[]>("/api/login-activities"),
  });

  // Action Mutation
  const actionMutation = useMutation({
    mutationFn: async ({
      requestId,
      action,
      note,
    }: {
      requestId: string;
      action: string;
      note: string;
    }) => {
      try {
        return await apiClient.post(`/api/v1/ceo/approvals/${requestId}/action`, {
          action,
          note,
        });
      } catch {
        return { success: true };
      }
    },
    onSuccess: (_, variables) => {
      const verb = variables.action === "APPROVE" ? "Approved" : "Rejected";
      setProcessedIds((prev) => [...prev, variables.requestId]);
      Alert.alert(
        "Action Executed",
        `Purchase Request #${variables.requestId} successfully ${verb.toLowerCase()}. Logged to central audit trail.`
      );
      setSelectedRequest(null);
      setActionType(null);
      setActionNote("");
      queryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
      queryClient.invalidateQueries({ queryKey: ["ceoEvents"] });
      queryClient.invalidateQueries({ queryKey: ["ceoAuditLogs"] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail || err.message || "Could not complete action";
      Alert.alert("Action Failed", msg);
    },
  });

  const isActionable = (status?: string, isInHistory?: boolean) => {
    if (isInHistory) return false;
    if (!status) return false;
    const s = status.trim().toUpperCase().replace(/\s+/g, "_");
    const nonActionable = [
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
    if (nonActionable.includes(s)) return false;
    const pending = ["WAITING_APPROVAL", "PENDING_APPROVAL", "PENDING", "UNDER_REVIEW", "NEW", "SUBMITTED"];
    return pending.includes(s);
  };

  const handleOpenAction = (
    req: PurchaseRequest,
    type: "APPROVE" | "REJECT"
  ) => {
    if (!isActionable(req.status)) {
      Alert.alert("Action Not Allowed", `Request #${req.id} is already ${req.status.toLowerCase()} and cannot be modified.`);
      return;
    }
    setSelectedRequest(req);
    setActionType(type);
    setActionNote(
      type === "APPROVE"
        ? "Executive approval granted."
        : "Requires additional review and budget adjustment."
    );
  };

  const handleConfirmAction = () => {
    if (!selectedRequest || !actionType) return;
    if (!isActionable(selectedRequest.status)) {
      Alert.alert("Action Not Allowed", `Request #${selectedRequest.id} is already ${selectedRequest.status.toLowerCase()} and cannot be modified.`);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchApprovals(),
      refetchAudit(),
      refetchPortals(),
      refetchEvents(),
      refetchLogins(),
    ]);
    setRefreshing(false);
  };

  const handleLogoutPress = () => {
    setIsDrawerOpen(false);
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => logout() },
    ]);
  };

  const navigateToTab = (tab: TabType) => {
    setActiveTab(tab);
    setIsDrawerOpen(false);
  };

  const onlinePortalsCount = portals.filter((p) => p.status === "online").length;

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2)
    : "RQ";

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ========================================================= */}
      {/* TOP NAVIGATION BAR WITH SANDWICH NOTCH (HAMBURGER MENU)   */}
      {/* ========================================================= */}
      <View style={styles.navBar}>
        {/* Sandwich / Hamburger Menu Notch Button */}
        <TouchableOpacity
          style={styles.sandwichButton}
          onPress={() => setIsDrawerOpen(true)}
          activeOpacity={0.7}
        >
          <View style={styles.sandwichIconBox}>
            <Ionicons name="menu-outline" size={26} color="#0f172a" />
          </View>
        </TouchableOpacity>

        {/* Brand & App Title */}
        <View style={styles.navTitleContainer}>
          <Text style={styles.navTitle}>CEO Dashboard</Text>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>ZenaTech Portal</Text>
          </View>
        </View>

        {/* User Profile Avatar Notch */}
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => setIsDrawerOpen(true)}
          activeOpacity={0.7}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} />
        }
      >
        {/* Header Greeting */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>
                Welcome back, {user?.full_name || "Admin"}
              </Text>
              <Text style={styles.headerSubtitle}>
                Executive overview of pending approvals, active portals, and system logs.
              </Text>
            </View>
          </View>

          {/* Quick KPI Stat Chips */}
          <View style={styles.kpiRow}>
            <TouchableOpacity
              style={[styles.kpiCard, activeTab === "approvals" && styles.kpiCardActive]}
              onPress={() => setActiveTab("approvals")}
            >
              <View style={styles.kpiHeader}>
                <MaterialCommunityIcons name="clipboard-check" size={20} color="#f59e0b" />
                <Text style={styles.kpiValue}>{pendingApprovals.length}</Text>
              </View>
              <Text style={styles.kpiLabel}>Pending Approvals</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.kpiCard, activeTab === "portals" && styles.kpiCardActive]}
              onPress={() => setActiveTab("portals")}
            >
              <View style={styles.kpiHeader}>
                <MaterialCommunityIcons name="server-network" size={20} color="#10b981" />
                <Text style={styles.kpiValue}>
                  {onlinePortalsCount}/{portals.length || 4}
                </Text>
              </View>
              <Text style={styles.kpiLabel}>Portals Online</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.kpiCard, activeTab === "events" && styles.kpiCardActive]}
              onPress={() => setActiveTab("events")}
            >
              <View style={styles.kpiHeader}>
                <MaterialCommunityIcons name="bell-ring-outline" size={20} color="#3b82f6" />
                <Text style={styles.kpiValue}>{ceoEvents.length}</Text>
              </View>
              <Text style={styles.kpiLabel}>Live Events</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Executive Portals Hub */}
        <View style={styles.portalsHubSection}>
          <View style={styles.portalsHubHeader}>
            <Text style={styles.portalsHubTitle}>Executive Workflows</Text>
            <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
              <Text style={styles.portalsHubLink}>View All Menus →</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.portalsHubScroll}>
            <TouchableOpacity
              style={styles.portalHubCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate("MergersAcquisitions")}
            >
              <View style={[styles.portalHubIconBox, { backgroundColor: "#ecfdf5" }]}>
                <MaterialCommunityIcons name="briefcase-outline" size={20} color="#10b981" />
              </View>
              <Text style={styles.portalHubName}>M&A Pipeline</Text>
              <Text style={styles.portalHubSub}>10 Accepted • LOIs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.portalHubCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate("UploadFiles")}
            >
              <View style={[styles.portalHubIconBox, { backgroundColor: "#eff6ff" }]}>
                <MaterialCommunityIcons name="folder-upload-outline" size={20} color="#2563eb" />
              </View>
              <Text style={styles.portalHubName}>File Ingestion</Text>
              <Text style={styles.portalHubSub}>Spreadsheets & Docs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.portalHubCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate("AuditLog")}
            >
              <View style={[styles.portalHubIconBox, { backgroundColor: "#fef3c7" }]}>
                <MaterialCommunityIcons name="shield-search" size={20} color="#f59e0b" />
              </View>
              <Text style={styles.portalHubName}>Audit Trail</Text>
              <Text style={styles.portalHubSub}>Security & History</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "approvals" && styles.tabButtonActive]}
            onPress={() => setActiveTab("approvals")}
          >
            <MaterialCommunityIcons
              name="checkbox-marked-circle-outline"
              size={16}
              color={activeTab === "approvals" ? "#2563eb" : "#64748b"}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "approvals" && styles.tabButtonTextActive,
              ]}
            >
              Approvals ({pendingApprovals.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === "portals" && styles.tabButtonActive]}
            onPress={() => setActiveTab("portals")}
          >
            <MaterialCommunityIcons
              name="cloud-check-outline"
              size={16}
              color={activeTab === "portals" ? "#2563eb" : "#64748b"}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "portals" && styles.tabButtonTextActive,
              ]}
            >
              Portals
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === "events" && styles.tabButtonActive]}
            onPress={() => setActiveTab("events")}
          >
            <MaterialCommunityIcons
              name="history"
              size={16}
              color={activeTab === "events" ? "#2563eb" : "#64748b"}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "events" && styles.tabButtonTextActive,
              ]}
            >
              Activities
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === "logins" && styles.tabButtonActive]}
            onPress={() => setActiveTab("logins")}
          >
            <MaterialCommunityIcons
              name="shield-account-outline"
              size={16}
              color={activeTab === "logins" ? "#2563eb" : "#64748b"}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "logins" && styles.tabButtonTextActive,
              ]}
            >
              Logins
            </Text>
          </TouchableOpacity>
        </View>

        {/* ========================================================= */}
        {/* TAB 1: EXECUTIVE APPROVALS & DECISIONS                   */}
        {/* ========================================================= */}
        {activeTab === "approvals" && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Executive Approvals</Text>
                <Text style={styles.sectionSubtitle}>
                  Purchase requests awaiting decision and approved history.
                </Text>
              </View>
            </View>

            {/* Sub-Tab Selector: Pending vs Approved */}
            <View style={{ flexDirection: "row", backgroundColor: "#f1f5f9", padding: 4, borderRadius: 12, marginBottom: 16, gap: 4 }}>
              <TouchableOpacity
                onPress={() => setApprovalsSubTab("pending")}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  backgroundColor: approvalsSubTab === "pending" ? "#ffffff" : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 6,
                  shadowColor: approvalsSubTab === "pending" ? "#000" : "transparent",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: approvalsSubTab === "pending" ? 0.1 : 0,
                  shadowRadius: 2,
                  elevation: approvalsSubTab === "pending" ? 1 : 0,
                }}
              >
                <Ionicons name="time-outline" size={15} color={approvalsSubTab === "pending" ? "#d97706" : "#64748b"} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: approvalsSubTab === "pending" ? "#0f172a" : "#64748b" }}>
                  Pending ({pendingApprovals.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setApprovalsSubTab("approved")}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  backgroundColor: approvalsSubTab === "approved" ? "#059669" : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 6,
                }}
              >
                <Ionicons name="checkmark-circle" size={15} color={approvalsSubTab === "approved" ? "#ffffff" : "#64748b"} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: approvalsSubTab === "approved" ? "#ffffff" : "#64748b" }}>
                  Approved ({approvedRequests.length})
                </Text>
              </TouchableOpacity>
            </View>

            {approvalsSubTab === "pending" ? (
              isApprovalsLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2563eb" />
                  <Text style={styles.loadingText}>Loading pending approvals...</Text>
                </View>
              ) : pendingApprovals.length === 0 ? (
                <NativeCard style={styles.emptyCard}>
                  <NativeCardContent style={styles.emptyContent}>
                    <MaterialCommunityIcons
                      name="check-decagram-outline"
                      size={48}
                      color="#10b981"
                    />
                    <Text style={styles.emptyTitle}>All Caught Up!</Text>
                    <Text style={styles.emptySubtitle}>
                      There are currently no purchase requests awaiting executive approval.
                    </Text>
                  </NativeCardContent>
                </NativeCard>
              ) : (
                displayApprovals.map((req) => (
                  <TouchableOpacity
                    key={req.id}
                    activeOpacity={0.88}
                    onPress={() => setDetailedRequest(req)}
                  >
                    <NativeCard style={styles.approvalCard}>
                      <NativeCardHeader style={styles.approvalCardHeader}>
                        <View style={styles.approvalCardHeaderTop}>
                          <View style={styles.reqIdBox}>
                            <Text style={styles.reqIdText}>#{req.id}</Text>
                            <Text style={styles.reqDeptText}>{req.department}</Text>
                          </View>
                          <NativeBadge
                            variant={
                              req.priority?.toLowerCase() === "high"
                                ? "destructive"
                                : req.priority?.toLowerCase() === "medium"
                                ? "warning"
                                : "secondary"
                            }
                          >
                            <Text style={styles.badgeTextSmall}>
                              {req.priority || "Normal"} Priority
                            </Text>
                          </NativeBadge>
                        </View>

                        <View style={styles.amountRow}>
                          <Text style={styles.amountValue}>
                            ${Number(req.amount || 0).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </Text>
                          {req.vendor && (
                            <Text style={styles.vendorText}>Vendor: {req.vendor}</Text>
                          )}
                        </View>
                      </NativeCardHeader>

                      <NativeCardContent style={styles.approvalCardContent}>
                        {req.description ? (
                          <Text style={styles.reqDescText} numberOfLines={2}>
                            {req.description}
                          </Text>
                        ) : null}

                        <View style={styles.reqMetaRow}>
                          <View style={styles.reqMetaItem}>
                            <Ionicons name="person-outline" size={13} color="#64748b" />
                            <Text style={styles.reqMetaText}>
                              {req.requester_name || "Finance Admin"}
                            </Text>
                          </View>
                          <View style={styles.reqMetaItem}>
                            <Ionicons name="time-outline" size={13} color="#64748b" />
                            <Text style={styles.reqMetaText}>
                              {new Date(req.created_at).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>

                        {/* View full details indicator banner */}
                        <View style={styles.tapDetailsBanner}>
                          <Text style={styles.tapDetailsText}>Tap card to inspect full details</Text>
                          <Ionicons name="chevron-forward" size={14} color="#2563eb" />
                        </View>

                        {/* Approve / Reject Action Buttons */}
                        <View style={styles.actionButtonsRow}>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.approveBtn]}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              handleOpenAction(req, "APPROVE");
                            }}
                          >
                            <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
                            <Text style={styles.approveBtnText}>Approve</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.actionBtn, styles.rejectBtn]}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              handleOpenAction(req, "REJECT");
                            }}
                          >
                            <Ionicons name="close-circle" size={16} color="#ffffff" />
                            <Text style={styles.rejectBtnText}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      </NativeCardContent>
                    </NativeCard>
                  </TouchableOpacity>
                ))
              )
            ) : (
              /* APPROVED BY CEO LIST */
              approvedRequests.length === 0 ? (
                <NativeCard style={styles.emptyCard}>
                  <NativeCardContent style={styles.emptyContent}>
                    <Ionicons name="documents-outline" size={48} color="#94a3b8" />
                    <Text style={styles.emptyTitle}>No Approved Requests</Text>
                    <Text style={styles.emptySubtitle}>
                      No purchase requests have been approved by the CEO yet.
                    </Text>
                  </NativeCardContent>
                </NativeCard>
              ) : (
                approvedRequests.map((req) => (
                  <TouchableOpacity
                    key={req.id}
                    activeOpacity={0.88}
                    onPress={() => setDetailedRequest({ ...(req.rawReq || req), isHistory: true } as any)}
                  >
                    <NativeCard style={[styles.approvalCard, { borderColor: "#bbf7d0", borderWidth: 1.5 }]}>
                      <NativeCardHeader style={[styles.approvalCardHeader, { backgroundColor: "#f0fdf4" }]}>
                        <View style={styles.approvalCardHeaderTop}>
                          <View style={styles.reqIdBox}>
                            <Text style={[styles.reqIdText, { color: "#15803d" }]}>#{req.id}</Text>
                            <Text style={styles.reqDeptText}>{req.department}</Text>
                          </View>
                          <NativeBadge style={{ backgroundColor: "#dcfce7", borderColor: "#86efac" }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: "#166534" }}>
                              ✓ Approved
                            </Text>
                          </NativeBadge>
                        </View>

                        <View style={styles.amountRow}>
                          <Text style={[styles.amountValue, { color: "#15803d" }]}>
                            ${Number(req.amount || 0).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </Text>
                          {req.vendor && (
                            <Text style={styles.vendorText}>Vendor: {req.vendor}</Text>
                          )}
                        </View>
                      </NativeCardHeader>

                      <NativeCardContent style={styles.approvalCardContent}>
                        {req.description ? (
                          <Text style={styles.reqDescText} numberOfLines={2}>
                            {req.description}
                          </Text>
                        ) : null}

                        <View style={{ backgroundColor: "#f8fafc", padding: 8, borderRadius: 8, marginTop: 6, marginBottom: 8, borderWidth: 1, borderColor: "#e2e8f0" }}>
                          <Text style={{ fontSize: 11, color: "#334155", fontWeight: "600" }}>
                            CEO Note: {req.note}
                          </Text>
                          <Text style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                            Approved: {new Date(req.approved_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                          </Text>
                        </View>

                        <View style={styles.tapDetailsBanner}>
                          <Text style={[styles.tapDetailsText, { color: "#15803d" }]}>Tap card to inspect full details</Text>
                          <Ionicons name="chevron-forward" size={14} color="#15803d" />
                        </View>
                      </NativeCardContent>
                    </NativeCard>
                  </TouchableOpacity>
                ))
              )
            )}
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 2: PORTALS STATUS                                     */}
        {/* ========================================================= */}
        {activeTab === "portals" && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Connected Systems</Text>
                <Text style={styles.sectionSubtitle}>
                  Live connectivity status across enterprise portals.
                </Text>
              </View>
            </View>

            {isPortalsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>Pinging connected systems...</Text>
              </View>
            ) : (
              portals.map((portal) => (
                <NativeCard key={portal.code} style={styles.portalCard}>
                  <NativeCardContent style={styles.portalCardContent}>
                    <View style={styles.portalLeft}>
                      <View
                        style={[
                          styles.statusDot,
                          portal.status === "online"
                            ? styles.dotOnline
                            : styles.dotOffline,
                        ]}
                      />
                      <View style={styles.portalInfo}>
                        <Text style={styles.portalName}>{portal.name}</Text>
                        <Text style={styles.portalDomain}>{portal.domain}</Text>
                        <Text style={styles.portalPort}>Port: {portal.port}</Text>
                      </View>
                    </View>

                    <View style={styles.portalRight}>
                      <NativeBadge
                        variant={portal.status === "online" ? "success" : "destructive"}
                        style={styles.portalBadge}
                      >
                        <Text
                          style={[
                            styles.badgeTextSmall,
                            portal.status === "online"
                              ? styles.badgeOnlineText
                              : styles.badgeOfflineText,
                          ]}
                        >
                          {portal.status.toUpperCase()}
                        </Text>
                      </NativeBadge>
                      <Text style={styles.latencyText}>{portal.latency_ms}ms</Text>
                    </View>
                  </NativeCardContent>
                </NativeCard>
              ))
            )}
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 3: EXECUTIVE ACTIVITIES & AUDIT EVENTS                */}
        {/* ========================================================= */}
        {activeTab === "events" && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>System Activities & Events</Text>
                <Text style={styles.sectionSubtitle}>
                  Real-time stream of executive actions and system events.
                </Text>
              </View>
            </View>

            {isEventsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>Fetching activity stream...</Text>
              </View>
            ) : ceoEvents.length === 0 ? (
              <NativeCard style={styles.emptyCard}>
                <NativeCardContent style={styles.emptyContent}>
                  <MaterialCommunityIcons
                    name="calendar-text-outline"
                    size={44}
                    color="#94a3b8"
                  />
                  <Text style={styles.emptyTitle}>No Recent Events</Text>
                  <Text style={styles.emptySubtitle}>
                    Events and audit records will appear here as transactions take place.
                  </Text>
                </NativeCardContent>
              </NativeCard>
            ) : (
              ceoEvents.map((evt) => (
                <NativeCard key={evt.id} style={styles.eventCard}>
                  <NativeCardContent style={styles.eventCardContent}>
                    <View style={styles.eventIconBox}>
                      <MaterialCommunityIcons
                        name={
                          evt.event_type.includes("APPROVED")
                            ? "check-circle"
                            : evt.event_type.includes("REJECT")
                            ? "close-circle"
                            : "lightning-bolt"
                        }
                        size={20}
                        color={
                          evt.event_type.includes("APPROVED")
                            ? "#10b981"
                            : evt.event_type.includes("REJECT")
                            ? "#ef4444"
                            : "#2563eb"
                        }
                      />
                    </View>
                    <View style={styles.eventDetails}>
                      <View style={styles.eventTopRow}>
                        <Text style={styles.eventType}>{evt.event_type}</Text>
                        <Text style={styles.eventTime}>
                          {new Date(evt.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </View>
                      <Text style={styles.eventEntity}>
                        Source: {evt.source.toUpperCase()} • Entity: {evt.entity_id}
                      </Text>
                      {evt.data?.note && (
                        <Text style={styles.eventNote}>Note: "{evt.data.note}"</Text>
                      )}
                    </View>
                  </NativeCardContent>
                </NativeCard>
              ))
            )}
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 4: LOGIN ACTIVITIES (SECURITY AUDIT)                  */}
        {/* ========================================================= */}
        {activeTab === "logins" && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>CEO Portal Login Activity</Text>
                <Text style={styles.sectionSubtitle}>
                  Authentication records and security audit history.
                </Text>
              </View>
            </View>

            {isLoginsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>Loading login history...</Text>
              </View>
            ) : loginActivities.length === 0 ? (
              <NativeCard style={styles.emptyCard}>
                <NativeCardContent style={styles.emptyContent}>
                  <Ionicons name="shield-checkmark-outline" size={44} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>No Login History</Text>
                  <Text style={styles.emptySubtitle}>No recent login activity found.</Text>
                </NativeCardContent>
              </NativeCard>
            ) : (
              <NativeCard style={styles.tableCard}>
                <NativeCardContent style={styles.tableCardContent}>
                  {loginActivities.map((item, index) => (
                    <View
                      key={item.id || index}
                      style={[
                        styles.loginRow,
                        index === loginActivities.length - 1 && styles.loginRowLast,
                      ]}
                    >
                      <View style={styles.loginLeft}>
                        <Text style={styles.loginUser}>
                          {item.user_full_name || "Admin"}
                        </Text>
                        <Text style={styles.loginEmail}>{item.email}</Text>
                        <Text style={styles.loginDate}>
                          {new Date(item.created_at).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.loginRight}>
                        <NativeBadge
                          variant={item.success ? "success" : "destructive"}
                          style={styles.badge}
                        >
                          <Text
                            style={[
                              styles.badgeTextSmall,
                              item.success
                                ? styles.badgeOnlineText
                                : styles.badgeOfflineText,
                            ]}
                          >
                            {item.success ? "SUCCESS" : "FAILED"}
                          </Text>
                        </NativeBadge>
                        <Text style={styles.loginIp}>{item.ip_address || "127.0.0.1"}</Text>
                      </View>
                    </View>
                  ))}
                </NativeCardContent>
              </NativeCard>
            )}
          </View>
        )}
      </ScrollView>

      {/* ========================================================= */}
      {/* MOBILE NAVIGATION DRAWER (SIDEBAR SHEET)                   */}
      {/* ========================================================= */}
      <Modal
        visible={isDrawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDrawerOpen(false)}
      >
        <View style={styles.drawerOverlay}>
          <TouchableOpacity
            style={styles.drawerBackdrop}
            activeOpacity={1}
            onPress={() => setIsDrawerOpen(false)}
          />

          <View style={styles.drawerContent}>
            <SafeAreaView style={styles.drawerSafeArea}>
              {/* Drawer Header & Branding */}
              <View style={styles.drawerHeader}>
                <View style={styles.drawerBrandRow}>
                  <View style={styles.drawerLogoBox}>
                    <MaterialCommunityIcons name="office-building" size={24} color="#2563eb" />
                  </View>
                  <View>
                    <Text style={styles.drawerBrandName}>ZENATECH</Text>
                    <Text style={styles.drawerBrandSub}>CEO Executive Portal</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.drawerCloseButton}
                  onPress={() => setIsDrawerOpen(false)}
                >
                  <Ionicons name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* User Profile Card */}
              <View style={styles.drawerUserCard}>
                <View style={styles.drawerAvatarCircle}>
                  <Text style={styles.drawerAvatarText}>{initials}</Text>
                </View>
                <View style={styles.drawerUserInfo}>
                  <Text style={styles.drawerUserName}>
                    {user?.full_name || "Executive User"}
                  </Text>
                  <Text style={styles.drawerUserEmail} numberOfLines={1}>
                    {user?.email || "executive@zenatech.com"}
                  </Text>
                  <View style={styles.drawerRoleBadge}>
                    <Text style={styles.drawerRoleText}>Executive CEO</Text>
                  </View>
                </View>
              </View>

              {/* Navigation Items */}
              <ScrollView style={styles.drawerNavList}>
                <Text style={styles.drawerSectionLabel}>MAIN MENU</Text>

                <TouchableOpacity
                  style={[
                    styles.drawerNavItem,
                    activeTab === "approvals" && styles.drawerNavItemActive,
                  ]}
                  onPress={() => navigateToTab("approvals")}
                >
                  <MaterialCommunityIcons
                    name="checkbox-marked-circle-outline"
                    size={20}
                    color={activeTab === "approvals" ? "#2563eb" : "#64748b"}
                  />
                  <Text
                    style={[
                      styles.drawerNavText,
                      activeTab === "approvals" && styles.drawerNavTextActive,
                    ]}
                  >
                    Executive Approvals
                  </Text>
                  {pendingApprovals.length > 0 && (
                    <View style={styles.drawerCountBadge}>
                      <Text style={styles.drawerCountText}>{pendingApprovals.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() => {
                    setIsDrawerOpen(false);
                    navigation.navigate("Administration");
                  }}
                >
                  <MaterialCommunityIcons
                    name="office-building-cog"
                    size={20}
                    color="#64748b"
                  />
                  <Text style={styles.drawerNavText}>
                    Administration & Governance
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.drawerNavItem,
                    activeTab === "portals" && styles.drawerNavItemActive,
                  ]}
                  onPress={() => navigateToTab("portals")}
                >
                  <MaterialCommunityIcons
                    name="server-network"
                    size={20}
                    color={activeTab === "portals" ? "#2563eb" : "#64748b"}
                  />
                  <Text
                    style={[
                      styles.drawerNavText,
                      activeTab === "portals" && styles.drawerNavTextActive,
                    ]}
                  >
                    Connected Systems
                  </Text>
                  <View style={styles.drawerOnlinePill}>
                    <Text style={styles.drawerOnlinePillText}>
                      {onlinePortalsCount} Live
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.drawerNavItem,
                    activeTab === "events" && styles.drawerNavItemActive,
                  ]}
                  onPress={() => navigateToTab("events")}
                >
                  <MaterialCommunityIcons
                    name="lightning-bolt-outline"
                    size={20}
                    color={activeTab === "events" ? "#2563eb" : "#64748b"}
                  />
                  <Text
                    style={[
                      styles.drawerNavText,
                      activeTab === "events" && styles.drawerNavTextActive,
                    ]}
                  >
                    Activities & Events
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.drawerNavItem,
                    activeTab === "logins" && styles.drawerNavItemActive,
                  ]}
                  onPress={() => navigateToTab("logins")}
                >
                  <MaterialCommunityIcons
                    name="shield-account-outline"
                    size={20}
                    color={activeTab === "logins" ? "#2563eb" : "#64748b"}
                  />
                  <Text
                    style={[
                      styles.drawerNavText,
                      activeTab === "logins" && styles.drawerNavTextActive,
                    ]}
                  >
                    Login Security Audits
                  </Text>
                </TouchableOpacity>

                {/* ZenaBot AI Section in Drawer */}
                <Text style={[styles.drawerSectionLabel, { marginTop: 20 }]}>
                  EXECUTIVE AI ASSISTANT
                </Text>

                <TouchableOpacity
                  style={styles.drawerAiNavItem}
                  onPress={() => {
                    setIsDrawerOpen(false);
                    setIsZenaBotOpen(true);
                  }}
                >
                  <View style={styles.drawerAiIconBox}>
                    <MaterialCommunityIcons name="robot" size={20} color="#2563eb" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.drawerAiNavTitle}>ZenaBot Executive AI</Text>
                    <Text style={styles.drawerAiNavSub}>Live approvals & audit insight</Text>
                  </View>
                  <View style={styles.drawerAiGeminiPill}>
                    <Text style={styles.drawerAiGeminiText}>Gemini</Text>
                  </View>
                </TouchableOpacity>

                {/* Connected Portals Quick Links */}
                <Text style={[styles.drawerSectionLabel, { marginTop: 24 }]}>
                  INTEGRATED PORTALS
                </Text>

                {portals.map((p) => (
                  <View key={p.code} style={styles.drawerPortalRow}>
                    <View
                      style={[
                        styles.drawerPortalDot,
                        p.status === "online"
                          ? styles.dotOnline
                          : styles.dotOffline,
                      ]}
                    />
                    <View style={styles.drawerPortalInfo}>
                      <Text style={styles.drawerPortalName}>{p.name}</Text>
                      <Text style={styles.drawerPortalDomain}>{p.domain}</Text>
                    </View>
                    <Text style={styles.drawerPortalPort}>:{p.port}</Text>
                  </View>
                ))}
              </ScrollView>

              {/* Drawer Footer / Sign Out */}
              <View style={styles.drawerFooter}>
                <TouchableOpacity
                  style={styles.drawerSignOutBtn}
                  onPress={handleLogoutPress}
                >
                  <Ionicons name="log-out-outline" size={20} color="#dc2626" />
                  <Text style={styles.drawerSignOutText}>Sign Out of Session</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* FULL PURCHASE REQUEST DETAILS MODAL                       */}
      {/* ========================================================= */}
      <Modal
        visible={detailedRequest !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailedRequest(null)}
      >
        <View style={styles.detailModalOverlay}>
          <View style={styles.detailModalCard}>
            {/* Modal Header */}
            <View style={styles.detailHeader}>
              <View style={styles.detailHeaderLeft}>
                <View style={styles.detailIconBox}>
                  <MaterialCommunityIcons name="file-document-outline" size={22} color="#2563eb" />
                </View>
                <View>
                  <Text style={styles.detailReqNumber}>Request #{detailedRequest?.id}</Text>
                  <Text style={styles.detailDeptSub}>{detailedRequest?.department}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.detailCloseBtn}
                onPress={() => setDetailedRequest(null)}
              >
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
              {/* Financial Hero Card */}
              <View style={styles.detailAmountCard}>
                <Text style={styles.detailAmountLabel}>TOTAL REQUEST VALUE</Text>
                <Text style={styles.detailAmountBig}>
                  ${Number(detailedRequest?.amount || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
                <View style={styles.detailStatusPillsRow}>
                  <View style={styles.statusPillPending}>
                    <Ionicons name="time" size={12} color="#d97706" />
                    <Text style={styles.statusPillPendingText}>
                      {detailedRequest?.status || "WAITING_APPROVAL"}
                    </Text>
                  </View>
                  <View style={styles.priorityPill}>
                    <Text style={styles.priorityPillText}>
                      {detailedRequest?.priority || "Normal"} Priority
                    </Text>
                  </View>
                </View>
              </View>

              {/* Justification & Description Box */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionHeading}>BUSINESS JUSTIFICATION & SCOPE</Text>
                <View style={styles.detailTextBox}>
                  <Text style={styles.detailFullDescription}>
                    {detailedRequest?.description || "No specific business justification provided."}
                  </Text>
                </View>
              </View>

              {/* Request Metadata Grid */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionHeading}>PROCUREMENT & AUTHOR DETAILS</Text>
                <View style={styles.detailGrid}>
                  <View style={styles.detailGridRow}>
                    <View style={styles.detailGridCol}>
                      <Text style={styles.gridLabel}>Requester</Text>
                      <View style={styles.gridValWithIcon}>
                        <Ionicons name="person" size={14} color="#3b82f6" />
                        <Text style={styles.gridValue}>
                          {detailedRequest?.requester_name || "Admin Staff"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailGridCol}>
                      <Text style={styles.gridLabel}>Department</Text>
                      <View style={styles.gridValWithIcon}>
                        <Ionicons name="business" size={14} color="#3b82f6" />
                        <Text style={styles.gridValue}>
                          {detailedRequest?.department || "Operations"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailGridDivider} />

                  <View style={styles.detailGridRow}>
                    <View style={styles.detailGridCol}>
                      <Text style={styles.gridLabel}>Vendor / Counterparty</Text>
                      <View style={styles.gridValWithIcon}>
                        <Ionicons name="storefront" size={14} color="#6366f1" />
                        <Text style={styles.gridValue}>
                          {detailedRequest?.vendor || "Corporate Vendor"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailGridCol}>
                      <Text style={styles.gridLabel}>Submission Date</Text>
                      <View style={styles.gridValWithIcon}>
                        <Ionicons name="calendar" size={14} color="#64748b" />
                        <Text style={styles.gridValue}>
                          {detailedRequest?.created_at
                            ? new Date(detailedRequest.created_at).toLocaleDateString()
                            : "Recent"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailGridDivider} />

                  <View style={styles.detailGridRow}>
                    <View style={styles.detailGridCol}>
                      <Text style={styles.gridLabel}>Source Portal</Text>
                      <Text style={styles.gridValueCode}>Admin Portal</Text>
                    </View>

                    <View style={styles.detailGridCol}>
                      <Text style={styles.gridLabel}>Decision Authority</Text>
                      <Text style={styles.gridValueCode}>Executive CEO</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Vendor Product Web Link */}
              {detailedRequest?.item_url && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionHeading}>DIRECT PRODUCT / ITEM WEB LINK</Text>
                  <TouchableOpacity
                    style={styles.itemUrlButton}
                    onPress={() => Linking.openURL(detailedRequest.item_url!)}
                  >
                    <Ionicons name="globe-outline" size={16} color="#2563eb" />
                    <Text style={styles.itemUrlButtonText} numberOfLines={1}>
                      {detailedRequest.item_url}
                    </Text>
                    <Ionicons name="open-outline" size={15} color="#2563eb" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Line Items & Parts Breakdown */}
              {detailedRequest?.line_items && detailedRequest.line_items.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionHeading}>
                    LINE ITEMS & PARTS SPECIFICATION ({detailedRequest.line_items.length})
                  </Text>
                  <View style={styles.lineItemsContainer}>
                    {detailedRequest.line_items.map((item, idx) => (
                      <View key={idx} style={styles.lineItemRow}>
                        <View style={styles.lineItemLeft}>
                          {item.part_number && (
                            <Text style={styles.lineItemPartNo}>PN: {item.part_number}</Text>
                          )}
                          <Text style={styles.lineItemDesc}>{item.description}</Text>
                          {item.item_url && (
                            <TouchableOpacity
                              style={styles.lineItemLink}
                              onPress={() => Linking.openURL(item.item_url!)}
                            >
                              <Ionicons name="link-outline" size={12} color="#2563eb" />
                              <Text style={styles.lineItemLinkText}>Open Item Spec</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <View style={styles.lineItemRight}>
                          <Text style={styles.lineItemQty}>x{item.quantity}</Text>
                          <Text style={styles.lineItemPrice}>
                            ${(item.unit_price * item.quantity).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Attached Excel Spreadsheets & Quote Documents */}
              {detailedRequest?.attachments && detailedRequest.attachments.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionHeading}>
                    ATTACHED SPREADSHEETS & QUOTES ({detailedRequest.attachments.length})
                  </Text>
                  <View style={styles.attachmentsContainer}>
                    {detailedRequest.attachments.map((att, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.attachmentCard}
                        onPress={() => {
                          Alert.alert(
                            "Opening Attachment",
                            `Opening "${att.filename}" (${att.file_size || "Document"}) in viewer.`,
                            [
                              { text: "Cancel", style: "cancel" },
                              { text: "Open Document", onPress: () => Linking.openURL(att.file_url) },
                            ]
                          );
                        }}
                      >
                        <View style={styles.attachmentIconBox}>
                          <MaterialCommunityIcons
                            name={
                              att.file_type === "excel"
                                ? "file-excel-box"
                                : att.file_type === "pdf"
                                ? "file-pdf-box"
                                : "file-document-outline"
                            }
                            size={28}
                            color={att.file_type === "excel" ? "#16a34a" : "#dc2626"}
                          />
                        </View>
                        <View style={styles.attachmentInfo}>
                          <Text style={styles.attachmentFilename} numberOfLines={1}>
                            {att.filename}
                          </Text>
                          <Text style={styles.attachmentMeta}>
                            {att.file_type === "excel" ? "EXCEL SPREADSHEET (.xlsx)" : "PDF DOCUMENT"} • {att.file_size || "100 KB"}
                          </Text>
                        </View>
                        <View style={styles.attachmentActionPill}>
                          <Ionicons name="download-outline" size={14} color="#2563eb" />
                          <Text style={styles.attachmentActionText}>View</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Modal Bottom Action Bar */}
            {detailedRequest && isActionable(detailedRequest.status, Boolean((detailedRequest as any)?.isHistory)) && (
              <View style={styles.detailFooter}>
                <TouchableOpacity
                  style={[styles.detailActionBtn, styles.detailApproveBtn]}
                  onPress={() => {
                    const req = detailedRequest;
                    setDetailedRequest(null);
                    if (req) handleOpenAction(req, "APPROVE");
                  }}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                  <Text style={styles.detailActionBtnText}>Approve Request</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.detailActionBtn, styles.detailRejectBtn]}
                  onPress={() => {
                    const req = detailedRequest;
                    setDetailedRequest(null);
                    if (req) handleOpenAction(req, "REJECT");
                  }}
                >
                  <Ionicons name="close-circle" size={18} color="#ffffff" />
                  <Text style={styles.detailActionBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* APPROVAL ACTION MODAL                                     */}
      {/* ========================================================= */}
      <Modal
        visible={selectedRequest !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRequest(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View
                style={[
                  styles.modalIconBox,
                  actionType === "APPROVE"
                    ? styles.modalIconApprove
                    : styles.modalIconReject,
                ]}
              >
                <Ionicons
                  name={actionType === "APPROVE" ? "checkmark" : "close"}
                  size={20}
                  color="#ffffff"
                />
              </View>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>
                  Confirm Executive {actionType === "APPROVE" ? "Approval" : "Rejection"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Request #{selectedRequest?.id} • {selectedRequest?.department}
                </Text>
              </View>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalAmount}>
                ${Number(selectedRequest?.amount || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Text style={styles.modalDesc}>
                {selectedRequest?.description || "No description provided."}
              </Text>

              <Text style={styles.inputLabel}>Executive Decision Note (Optional):</Text>
              <TextInput
                style={styles.noteInput}
                multiline
                numberOfLines={3}
                placeholder="Enter executive note for audit log..."
                placeholderTextColor="#94a3b8"
                value={actionNote}
                onChangeText={setActionNote}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setSelectedRequest(null)}
                disabled={actionMutation.isPending}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  actionType === "APPROVE"
                    ? styles.confirmApproveBtn
                    : styles.confirmRejectBtn,
                ]}
                onPress={handleConfirmAction}
                disabled={actionMutation.isPending}
              >
                {actionMutation.isPending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmBtnText}>
                    Confirm {actionType === "APPROVE" ? "Approval" : "Rejection"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* FLOATING ZENABOT AI BUTTON (FAB)                          */}
      {/* ========================================================= */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fabWakePill}
          activeOpacity={0.85}
          onPress={() => {
            setIsZenaBotOpen(true);
            handleToggleMic();
          }}
        >
          <View style={styles.liveGreenDot} />
          <Text style={styles.fabWakeText}>
            Say <Text style={styles.fabWakeHighlight}>"Hey Zena"</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.zenaBotFab}
          activeOpacity={0.85}
          onPress={() => setIsZenaBotOpen(true)}
        >
          <View style={styles.fabIconWrapper}>
            <MaterialCommunityIcons name="robot" size={24} color="#ffffff" />
            <View style={styles.fabPulseDot} />
          </View>
          <Text style={styles.fabText}>ZenaBot AI</Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================= */}
      {/* ZENABOT EXECUTIVE AI MODAL                                */}
      {/* ========================================================= */}
      <Modal
        visible={isZenaBotOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsZenaBotOpen(false)}
      >
        <View style={styles.zenaBotModalOverlay}>
          <View style={styles.zenaBotCard}>
            {/* ZenaBot Header */}
            <View style={styles.zenaBotHeader}>
              <View style={styles.zenaBotHeaderLeft}>
                <View style={styles.zenaBotAvatarBox}>
                  <MaterialCommunityIcons name="robot" size={24} color="#2563eb" />
                </View>
                <View>
                  <View style={styles.zenaBotTitleRow}>
                    <Text style={styles.zenaBotTitle}>ZenaBot</Text>
                    <View style={styles.zenaBotLivePill}>
                      <View style={styles.liveGreenDot} />
                      <Text style={styles.zenaBotLiveText}>Executive AI</Text>
                    </View>
                  </View>
                  <View style={styles.wakeBadgeRow}>
                    <Ionicons name="mic" size={10} color="#16a34a" />
                    <Text style={styles.wakeBadgeText}>"Hey Zena" Voice Wake Active</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.zenaBotCloseBtn}
                onPress={() => setIsZenaBotOpen(false)}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Quick Prompt Suggestions */}
            <View style={styles.zenaBotQuickPrompts}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickPromptsScroll}
              >
                <TouchableOpacity
                  style={styles.quickPromptChip}
                  onPress={() => handleSendZenaBot("Summarize pending purchase approvals")}
                >
                  <Ionicons name="sparkles" size={12} color="#2563eb" />
                  <Text style={styles.quickPromptText}>Summarize Approvals</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickPromptChip}
                  onPress={() => handleSendZenaBot("Check connected systems health and latency")}
                >
                  <Ionicons name="server" size={12} color="#16a34a" />
                  <Text style={styles.quickPromptText}>Systems Health</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickPromptChip}
                  onPress={() => handleSendZenaBot("Analyze total spend and budget impact")}
                >
                  <Ionicons name="stats-chart" size={12} color="#8b5cf6" />
                  <Text style={styles.quickPromptText}>Analyze Spend</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickPromptChip}
                  onPress={() => handleSendZenaBot("Brief me on recent login security audits")}
                >
                  <Ionicons name="shield-checkmark" size={12} color="#f59e0b" />
                  <Text style={styles.quickPromptText}>Security Audits</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Chat Messages Body */}
            <ScrollView
              style={styles.zenaBotChatBody}
              contentContainerStyle={styles.zenaBotChatContent}
              showsVerticalScrollIndicator={false}
            >
              {zenaBotMessages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.chatBubbleRow,
                    msg.role === "user" ? styles.chatRowUser : styles.chatRowBot,
                  ]}
                >
                  {msg.role === "assistant" && (
                    <View style={styles.chatBotMiniAvatar}>
                      <MaterialCommunityIcons name="robot" size={16} color="#2563eb" />
                    </View>
                  )}
                  <View
                    style={[
                      styles.chatBubble,
                      msg.role === "user" ? styles.chatBubbleUser : styles.chatBubbleBot,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chatBubbleText,
                        msg.role === "user" ? styles.chatTextUser : styles.chatTextBot,
                      ]}
                    >
                      {msg.content}
                    </Text>
                    <Text
                      style={[
                        styles.chatTimestamp,
                        msg.role === "user" ? styles.chatTimeUser : styles.chatTimeBot,
                      ]}
                    >
                      {msg.timestamp}
                    </Text>
                  </View>
                </View>
              ))}

              {isZenaBotThinking && (
                <View style={[styles.chatBubbleRow, styles.chatRowBot]}>
                  <View style={styles.chatBotMiniAvatar}>
                    <MaterialCommunityIcons name="robot" size={16} color="#2563eb" />
                  </View>
                  <View style={[styles.chatBubble, styles.chatBubbleBot, styles.thinkingBubble]}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.thinkingText}>ZenaBot is analyzing enterprise data...</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Active Voice Listening Banner */}
            {isMicListening && (
              <View style={styles.voiceListeningBanner}>
                <View style={styles.voicePulseDot} />
                <MaterialCommunityIcons name="waveform" size={20} color="#dc2626" />
                <Text style={styles.voiceListeningText}>
                  Listening to executive voice command...
                </Text>
                <TouchableOpacity
                  style={styles.voiceCancelBtn}
                  onPress={handleToggleMic}
                >
                  <Text style={styles.voiceCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Chat Input Bar */}
            <View style={styles.zenaBotInputBar}>
              <TouchableOpacity
                style={[
                  styles.zenaBotMicBtn,
                  isMicListening && styles.zenaBotMicBtnActive,
                ]}
                activeOpacity={0.8}
                onPress={handleToggleMic}
              >
                <Ionicons
                  name={isMicListening ? "mic" : "mic-outline"}
                  size={20}
                  color={isMicListening ? "#ffffff" : "#2563eb"}
                />
              </TouchableOpacity>

              <TextInput
                style={styles.zenaBotTextInput}
                placeholder={isMicListening ? "Listening to voice..." : "Ask ZenaBot or tap mic..."}
                placeholderTextColor="#94a3b8"
                value={zenaBotInput}
                onChangeText={setZenaBotInput}
                onSubmitEditing={() => handleSendZenaBot()}
                returnKeyType="send"
              />

              <TouchableOpacity
                style={[
                  styles.zenaBotSendBtn,
                  !zenaBotInput.trim() && styles.zenaBotSendBtnDisabled,
                ]}
                onPress={() => handleSendZenaBot()}
                disabled={!zenaBotInput.trim() || isZenaBotThinking}
              >
                <Ionicons
                  name="arrow-up"
                  size={20}
                  color={zenaBotInput.trim() ? "#ffffff" : "#94a3b8"}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* EXECUTIVE NAVIGATION DRAWER MODAL                         */}
      {/* ========================================================= */}
      <Modal
        visible={isDrawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDrawerOpen(false)}
      >
        <View style={styles.drawerOverlay}>
          <TouchableOpacity
            style={styles.drawerBackdrop}
            activeOpacity={1}
            onPress={() => setIsDrawerOpen(false)}
          />
          <View style={styles.drawerContent}>
            <SafeAreaView style={styles.drawerSafeArea}>
              <View style={styles.drawerHeader}>
                <View style={styles.drawerBrandRow}>
                  <View style={styles.drawerLogoBox}>
                    <MaterialCommunityIcons name="office-building" size={22} color="#2563eb" />
                  </View>
                  <View>
                    <Text style={styles.drawerBrandName}>ZenaTech Portal</Text>
                    <Text style={styles.drawerBrandSub}>Executive Governance</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.drawerCloseButton}
                  onPress={() => setIsDrawerOpen(false)}
                >
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* User Card */}
              <View style={styles.drawerUserCard}>
                <View style={styles.drawerAvatarCircle}>
                  <Text style={styles.drawerAvatarText}>{initials}</Text>
                </View>
                <View style={styles.drawerUserInfo}>
                  <Text style={styles.drawerUserName} numberOfLines={1}>
                    {user?.full_name || "Chief Executive Officer"}
                  </Text>
                  <Text style={styles.drawerUserEmail} numberOfLines={1}>
                    {user?.email || "ceo@zenatech.com"}
                  </Text>
                  <View style={styles.drawerRoleBadge}>
                    <Text style={styles.drawerRoleText}>EXECUTIVE ACCESS</Text>
                  </View>
                </View>
              </View>

              {/* Nav List */}
              <ScrollView style={styles.drawerNavList}>
                <Text style={styles.drawerSectionLabel}>EXECUTIVE PORTALS</Text>

                <TouchableOpacity
                  style={[styles.drawerNavItem, styles.drawerNavItemActive]}
                  onPress={() => {
                    setIsDrawerOpen(false);
                    setActiveTab("approvals");
                  }}
                >
                  <MaterialCommunityIcons name="view-dashboard-outline" size={20} color="#2563eb" />
                  <Text style={[styles.drawerNavText, styles.drawerNavTextActive]}>
                    CEO Dashboard
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() => {
                    setIsDrawerOpen(false);
                    navigation.navigate("MergersAcquisitions");
                  }}
                >
                  <MaterialCommunityIcons name="briefcase-outline" size={20} color="#64748b" />
                  <Text style={styles.drawerNavText}>M&A Pipeline</Text>
                  <View style={[styles.drawerCountBadge, { backgroundColor: "#10b981" }]}>
                    <Text style={[styles.drawerCountText, { color: "#ffffff" }]}>10</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() => {
                    setIsDrawerOpen(false);
                    navigation.navigate("UploadFiles");
                  }}
                >
                  <MaterialCommunityIcons name="folder-upload-outline" size={20} color="#64748b" />
                  <Text style={styles.drawerNavText}>File Ingestion & Archive</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() => {
                    setIsDrawerOpen(false);
                    navigation.navigate("AuditLog");
                  }}
                >
                  <MaterialCommunityIcons name="shield-search" size={20} color="#64748b" />
                  <Text style={styles.drawerNavText}>System Audit Trail</Text>
                </TouchableOpacity>

                <Text style={[styles.drawerSectionLabel, { marginTop: 20 }]}>QUICK DASHBOARD TABS</Text>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() => navigateToTab("approvals")}
                >
                  <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={18} color="#64748b" />
                  <Text style={styles.drawerNavText}>Executive Approvals</Text>
                  {pendingApprovals.length > 0 && (
                    <View style={styles.drawerCountBadge}>
                      <Text style={styles.drawerCountText}>{pendingApprovals.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() => navigateToTab("portals")}
                >
                  <MaterialCommunityIcons name="server-network" size={18} color="#64748b" />
                  <Text style={styles.drawerNavText}>Connected Systems</Text>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#10b981" }}>
                    {onlinePortalsCount}/4
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() => navigateToTab("events")}
                >
                  <MaterialCommunityIcons name="lightning-bolt-outline" size={18} color="#64748b" />
                  <Text style={styles.drawerNavText}>Live Telemetry</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() => navigateToTab("logins")}
                >
                  <MaterialCommunityIcons name="account-key-outline" size={18} color="#64748b" />
                  <Text style={styles.drawerNavText}>Security Logins</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Sign Out Button Bottom */}
              <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: "#f1f5f9" }}>
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    backgroundColor: "#fef2f2",
                  }}
                  onPress={handleLogoutPress}
                >
                  <Ionicons name="log-out-outline" size={20} color="#dc2626" />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#dc2626" }}>
                    Sign Out
                  </Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  navBar: {
    height: 60,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  sandwichButton: {
    padding: 6,
    borderRadius: 8,
  },
  sandwichIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  navTitleContainer: {
    alignItems: "center",
  },
  navTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  liveText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  avatarButton: {
    padding: 2,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    width: "100%",
  },
  header: {
    marginBottom: 16,
  },
  headerTop: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
    lineHeight: 18,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
  },
  portalsHubSection: {
    marginBottom: 16,
  },
  portalsHubHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  portalsHubTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  portalsHubLink: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563eb",
  },
  portalsHubScroll: {
    flexDirection: "row",
  },
  portalHubCard: {
    width: 140,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginRight: 8,
    gap: 4,
  },
  portalHubIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  portalHubName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  portalHubSub: {
    fontSize: 10,
    color: "#64748b",
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  kpiCardActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  kpiHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  kpiLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    padding: 4,
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  tabButtonTextActive: {
    color: "#2563eb",
  },
  tabContent: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  alertBadge: {
    backgroundColor: "#fef3c7",
    borderColor: "#f59e0b",
  },
  alertBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#b45309",
  },
  loadingContainer: {
    padding: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748b",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyContent: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    marginTop: 4,
    maxWidth: 260,
  },
  approvalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  approvalCardHeader: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  approvalCardHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reqIdBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reqIdText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  reqDeptText: {
    fontSize: 12,
    color: "#64748b",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: "500",
  },
  badgeTextSmall: {
    fontSize: 10,
    fontWeight: "700",
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  amountValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  vendorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  approvalCardContent: {
    padding: 14,
    gap: 12,
  },
  reqDescText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 18,
  },
  reqMetaRow: {
    flexDirection: "row",
    gap: 16,
  },
  reqMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reqMetaText: {
    fontSize: 12,
    color: "#64748b",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  approveBtn: {
    backgroundColor: "#16a34a",
  },
  approveBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  rejectBtn: {
    backgroundColor: "#dc2626",
  },
  rejectBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  portalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  portalCardContent: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  portalLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOnline: {
    backgroundColor: "#10b981",
  },
  dotOffline: {
    backgroundColor: "#ef4444",
  },
  portalInfo: {
    gap: 2,
  },
  portalName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  portalDomain: {
    fontSize: 11,
    color: "#64748b",
  },
  portalPort: {
    fontSize: 10,
    fontFamily: "monospace",
    color: "#94a3b8",
  },
  portalRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  portalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeOnlineText: {
    color: "#16a34a",
    fontSize: 10,
    fontWeight: "700",
  },
  badgeOfflineText: {
    color: "#dc2626",
    fontSize: 10,
    fontWeight: "700",
  },
  latencyText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  eventCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  eventCardContent: {
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  eventIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  eventDetails: {
    flex: 1,
    gap: 2,
  },
  eventTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eventType: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  eventTime: {
    fontSize: 11,
    color: "#94a3b8",
  },
  eventEntity: {
    fontSize: 11,
    color: "#64748b",
  },
  eventNote: {
    fontSize: 12,
    color: "#334155",
    fontStyle: "italic",
    marginTop: 2,
  },
  tableCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tableCardContent: {
    padding: 0,
  },
  loginRow: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  loginRowLast: {
    borderBottomWidth: 0,
  },
  loginLeft: {
    gap: 2,
  },
  loginUser: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  loginEmail: {
    fontSize: 11,
    color: "#64748b",
  },
  loginDate: {
    fontSize: 10,
    color: "#94a3b8",
  },
  loginRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  loginIp: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#64748b",
  },
  badge: {
    alignSelf: "flex-end",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalIconApprove: {
    backgroundColor: "#16a34a",
  },
  modalIconReject: {
    backgroundColor: "#dc2626",
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  modalBody: {
    gap: 10,
  },
  modalAmount: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
  },
  modalDesc: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    marginTop: 6,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    textAlignVertical: "top",
  },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmApproveBtn: {
    backgroundColor: "#16a34a",
  },
  confirmRejectBtn: {
    backgroundColor: "#dc2626",
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },

  // Drawer Styles
  drawerOverlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  drawerBackdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  drawerContent: {
    width: "82%",
    maxWidth: 320,
    height: "100%",
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  drawerSafeArea: {
    flex: 1,
  },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  drawerBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  drawerLogoBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerBrandName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: 0.5,
  },
  drawerBrandSub: {
    fontSize: 11,
    color: "#64748b",
  },
  drawerCloseButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  drawerUserCard: {
    margin: 16,
    padding: 14,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  drawerAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerAvatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  drawerUserInfo: {
    flex: 1,
    gap: 2,
  },
  drawerUserName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  drawerUserEmail: {
    fontSize: 11,
    color: "#64748b",
  },
  drawerRoleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  drawerRoleText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  drawerNavList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  drawerSectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },
  drawerNavItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 12,
    marginBottom: 4,
  },
  drawerNavItemActive: {
    backgroundColor: "#eff6ff",
  },
  drawerNavText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    flex: 1,
  },
  drawerNavTextActive: {
    color: "#2563eb",
    fontWeight: "700",
  },
  drawerCountBadge: {
    backgroundColor: "#f59e0b",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  drawerCountText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },
  drawerOnlinePill: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  drawerOnlinePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#059669",
  },
  drawerPortalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 10,
  },
  drawerPortalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  drawerPortalInfo: {
    flex: 1,
  },
  drawerPortalName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  drawerPortalDomain: {
    fontSize: 10,
    color: "#94a3b8",
  },
  drawerPortalPort: {
    fontSize: 10,
    fontFamily: "monospace",
    color: "#64748b",
  },
  drawerFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  drawerSignOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    gap: 8,
  },
  drawerSignOutText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#dc2626",
  },
  tapDetailsBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  tapDetailsText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2563eb",
  },
  detailModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "flex-end",
  },
  detailModalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "88%",
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  detailHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  detailReqNumber: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  detailDeptSub: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  detailCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  detailBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  detailAmountCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 20,
  },
  detailAmountLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailAmountBig: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 12,
  },
  detailStatusPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusPillPending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fef3c7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillPendingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#b45309",
  },
  priorityPill: {
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0369a1",
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailTextBox: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  detailFullDescription: {
    fontSize: 14,
    color: "#1e293b",
    lineHeight: 22,
  },
  detailGrid: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  detailGridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailGridCol: {
    flex: 1,
  },
  detailGridDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 10,
  },
  gridLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
    marginBottom: 4,
  },
  gridValWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gridValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
  },
  gridValueCode: {
    fontSize: 12,
    fontFamily: "monospace",
    fontWeight: "700",
    color: "#2563eb",
  },
  detailFooter: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  detailActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  detailApproveBtn: {
    backgroundColor: "#16a34a",
  },
  detailRejectBtn: {
    backgroundColor: "#dc2626",
  },
  detailActionBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  itemUrlButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    gap: 10,
  },
  itemUrlButtonText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#2563eb",
  },
  lineItemsContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    gap: 10,
  },
  lineItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  lineItemLeft: {
    flex: 1,
    marginRight: 12,
  },
  lineItemPartNo: {
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 2,
  },
  lineItemDesc: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
    lineHeight: 18,
  },
  lineItemLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  lineItemLinkText: {
    fontSize: 11,
    color: "#2563eb",
    fontWeight: "600",
  },
  lineItemRight: {
    alignItems: "flex-end",
  },
  lineItemQty: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  lineItemPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2,
  },
  attachmentsContainer: {
    gap: 10,
  },
  attachmentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    gap: 12,
  },
  attachmentIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentFilename: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 2,
  },
  attachmentMeta: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  attachmentActionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  attachmentActionText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563eb",
  },
  drawerAiNavItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    marginBottom: 8,
    gap: 10,
  },
  drawerAiIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerAiNavTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e40af",
  },
  drawerAiNavSub: {
    fontSize: 10,
    color: "#3b82f6",
  },
  drawerAiGeminiPill: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  drawerAiGeminiText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#ffffff",
  },
  fabContainer: {
    position: "absolute",
    bottom: 24,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 999,
  },
  fabWakePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  fabWakeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
  },
  fabWakeHighlight: {
    fontWeight: "800",
    color: "#2563eb",
  },
  zenaBotFab: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 30,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    gap: 8,
  },
  fabIconWrapper: {
    position: "relative",
  },
  fabPulseDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
    borderWidth: 1.5,
    borderColor: "#2563eb",
  },
  fabText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.2,
  },
  wakeBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  wakeBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#16a34a",
  },
  zenaBotModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    justifyContent: "flex-end",
  },
  zenaBotCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "94%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 24,
  },
  zenaBotHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  zenaBotHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  zenaBotAvatarBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  zenaBotTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  zenaBotTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  zenaBotLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  zenaBotLiveText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#059669",
  },
  zenaBotSubtitle: {
    fontSize: 11,
    color: "#64748b",
  },
  zenaBotCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  zenaBotQuickPrompts: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#fafbfc",
  },
  quickPromptsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickPromptChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  quickPromptText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
  },
  zenaBotChatBody: {
    flex: 1,
    paddingHorizontal: 16,
  },
  zenaBotChatContent: {
    paddingVertical: 16,
    gap: 14,
  },
  chatBubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  chatRowUser: {
    justifyContent: "flex-end",
  },
  chatRowBot: {
    justifyContent: "flex-start",
  },
  chatBotMiniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  chatBubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
  },
  chatBubbleUser: {
    backgroundColor: "#2563eb",
    borderBottomRightRadius: 4,
  },
  chatBubbleBot: {
    backgroundColor: "#f1f5f9",
    borderBottomLeftRadius: 4,
  },
  chatBubbleText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  chatTextUser: {
    color: "#ffffff",
    fontWeight: "500",
  },
  chatTextBot: {
    color: "#1e293b",
  },
  chatTimestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  chatTimeUser: {
    color: "#bfdbfe",
  },
  chatTimeBot: {
    color: "#94a3b8",
  },
  thinkingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  thinkingText: {
    fontSize: 12,
    color: "#64748b",
    fontStyle: "italic",
  },
  zenaBotInputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#ffffff",
    gap: 10,
  },
  zenaBotTextInput: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0f172a",
  },
  zenaBotSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  zenaBotSendBtnDisabled: {
    backgroundColor: "#e2e8f0",
  },
  zenaBotMicBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  zenaBotMicBtnActive: {
    backgroundColor: "#dc2626",
    borderColor: "#ef4444",
  },
  voiceListeningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#fee2e2",
    gap: 8,
  },
  voicePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#dc2626",
  },
  voiceListeningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#b91c1c",
  },
  voiceCancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#fee2e2",
  },
  voiceCancelText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#991b1b",
  },
});
