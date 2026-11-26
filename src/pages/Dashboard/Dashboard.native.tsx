import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/lib/AuthContext";
import { apiClient } from "@/services/apiClient";
import { useCeoRealtimeStream } from "@/hooks/useCeoRealtimeStream";
import MobileShell from "@/components/AppShell/MobileShell.native";
import {
  NativeSystemsStrip,
  NativeRevenueExpenseCard,
  NativeBankBalancesCard,
  NativeAccountDistributionCard,
  NativeRecentTransactionsCard,
  formatMoney,
  type SystemServerItem,
} from "@/components/Dashboard/FinancialWidgets.native";

interface SummaryData {
  assets: number;
  liabilities: number;
  equity: number;
  netIncome: number;
}

interface PurchaseRequest {
  id: string;
  department: string;
  amount: number;
  status: string;
  description: string;
  priority: string;
  requester_name: string;
  created_at: string;
  pending_sync?: boolean;
}

interface CeoEvent {
  id: string;
  event_type: string;
  source: string;
  entity_id: string;
  created_at: string;
}

interface AuditLog {
  id: number;
  action: string;
  target_entity: string;
  requested_by: string;
  source_application: string;
  target_application: string;
  result: string;
  created_at: string;
}

interface MessageHubStatusResponse {
  status?: string;
  servers?: SystemServerItem[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<Record<string, undefined>>>();
  const { isConnected, triggerManualSync } = useCeoRealtimeStream();

  const [activeTab, setActiveTab] = useState<"financials" | "events">("financials");
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: rawApprovals = [],
    isLoading: isApprovalsLoading,
    refetch: refetchApprovals,
  } = useQuery<PurchaseRequest[]>({
    queryKey: ["admin", "pendingApprovals"],
    queryFn: ({ signal }) => apiClient.get<PurchaseRequest[]>("/api/v1/ceo/approvals/pending", { signal }),
    retry: false,
  });

  const pendingApprovals = useMemo(
    () => (Array.isArray(rawApprovals) ? rawApprovals : []),
    [rawApprovals]
  );

  const {
    data: rawCompletedHistory = [],
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery<PurchaseRequest[]>({
    queryKey: ["admin", "completedApprovalsHistory"],
    queryFn: ({ signal }) => apiClient.get<PurchaseRequest[]>("/api/v1/ceo/approvals/history", { signal }),
    retry: false,
  });

  const syncedApprovedRequests = useMemo(
    () => (Array.isArray(rawCompletedHistory) ? rawCompletedHistory.filter((r) => !r.pending_sync) : []),
    [rawCompletedHistory]
  );
  const pendingSyncRequests = useMemo(
    () => (Array.isArray(rawCompletedHistory) ? rawCompletedHistory.filter((r) => Boolean(r.pending_sync)) : []),
    [rawCompletedHistory]
  );

  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useQuery<SummaryData>({
    queryKey: ["summaryMetrics"],
    queryFn: () => apiClient.get<SummaryData>("/api/dashboard/summary"),
  });

  const {
    data: events = [],
    isLoading: isEventsLoading,
    refetch: refetchEvents,
  } = useQuery<CeoEvent[]>({
    queryKey: ["ceoEvents"],
    queryFn: () => apiClient.get<CeoEvent[]>("/api/v1/ceo/events"),
  });

  const {
    data: auditLogs = [],
    isLoading: isAuditLoading,
    refetch: refetchAudit,
  } = useQuery<AuditLog[]>({
    queryKey: ["ceoAuditLogs"],
    queryFn: () => apiClient.get<AuditLog[]>("/api/v1/ceo/audit-logs"),
  });

  const { data: hubStatus, refetch: refetchHub } = useQuery<MessageHubStatusResponse>({
    queryKey: ["message-hub-live-status"],
    queryFn: () => apiClient.get<MessageHubStatusResponse>("/api/message-hub/status"),
    retry: false,
  });

  const hubServers = hubStatus?.servers ?? [];

  const totalPendingAmount = useMemo(
    () => pendingApprovals.reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0),
    [pendingApprovals]
  );
  const totalApprovedAmount = useMemo(
    () => syncedApprovedRequests.reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0),
    [syncedApprovedRequests]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    triggerManualSync();
    await Promise.all([
      refetchApprovals(),
      refetchHistory(),
      refetchSummary(),
      refetchEvents(),
      refetchAudit(),
      refetchHub(),
    ]);
    setRefreshing(false);
  };

  return (
    <MobileShell
      title="Executive Overview"
      subtitle={`Welcome, ${user?.full_name || "Chief Executive Officer"}`}
      isLive={isConnected}
      onRefresh={onRefresh}
      isRefreshing={refreshing}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} />
        }
      >
        {/* 2x2 KPI Grid matching Web Dashboard */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiTop}>
              <Text style={styles.kpiLabel}>Liquid assets</Text>
              <View style={[styles.kpiIcon, { backgroundColor: "#ecfdf5" }]}>
                <MaterialCommunityIcons name="credit-card-outline" size={16} color="#059669" />
              </View>
            </View>
            {isSummaryLoading ? (
              <ActivityIndicator size="small" color="#059669" style={styles.kpiLoader} />
            ) : (
              <>
                <Text style={styles.kpiValue}>{formatMoney(summary?.assets)}</Text>
                <Text style={styles.kpiHint}>Cash position</Text>
              </>
            )}
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiTop}>
              <Text style={styles.kpiLabel}>Net income</Text>
              <View style={[styles.kpiIcon, { backgroundColor: "#eff6ff" }]}>
                <MaterialCommunityIcons name="trending-up" size={16} color="#2563eb" />
              </View>
            </View>
            {isSummaryLoading ? (
              <ActivityIndicator size="small" color="#2563eb" style={styles.kpiLoader} />
            ) : (
              <>
                <Text style={styles.kpiValue}>{formatMoney(summary?.netIncome)}</Text>
                <Text style={styles.kpiHint}>General ledger</Text>
              </>
            )}
          </View>

          <TouchableOpacity
            style={styles.kpiCard}
            activeOpacity={0.75}
            onPress={() => navigation.navigate("Administration")}
          >
            <View style={styles.kpiTop}>
              <Text style={styles.kpiLabel}>Pending approvals</Text>
              <View style={[styles.kpiIcon, { backgroundColor: "#fffbeb" }]}>
                <MaterialCommunityIcons name="clock-outline" size={16} color="#d97706" />
              </View>
            </View>
            {isApprovalsLoading ? (
              <ActivityIndicator size="small" color="#d97706" style={styles.kpiLoader} />
            ) : (
              <>
                <Text style={styles.kpiValue}>{pendingApprovals.length}</Text>
                <Text style={styles.kpiHint} numberOfLines={1}>
                  {formatMoney(totalPendingAmount)} awaiting →
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kpiCard}
            activeOpacity={0.75}
            onPress={() => navigation.navigate("Administration")}
          >
            <View style={styles.kpiTop}>
              <Text style={styles.kpiLabel}>Approved decisions</Text>
              <View style={[styles.kpiIcon, { backgroundColor: "#ecfdf5" }]}>
                <MaterialCommunityIcons name="check-circle-outline" size={16} color="#059669" />
              </View>
            </View>
            {isHistoryLoading ? (
              <ActivityIndicator size="small" color="#059669" style={styles.kpiLoader} />
            ) : (
              <>
                <Text style={styles.kpiValue}>{syncedApprovedRequests.length}</Text>
                <Text style={styles.kpiHint} numberOfLines={1}>
                  {pendingSyncRequests.length > 0
                    ? `${pendingSyncRequests.length} waiting reconnect`
                    : `${formatMoney(totalApprovedAmount)} approved →`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Connected Systems Strip */}
        <NativeSystemsStrip servers={hubServers} />

        {/* Main Tabs: Financials & Audit trail */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "financials" && styles.tabBtnActive]}
            onPress={() => setActiveTab("financials")}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons
              name="trending-up"
              size={15}
              color={activeTab === "financials" ? "#2563eb" : "#64748b"}
            />
            <Text style={[styles.tabText, activeTab === "financials" && styles.tabTextActive]}>
              Financials
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "events" && styles.tabBtnActive]}
            onPress={() => setActiveTab("events")}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons
              name="pulse"
              size={15}
              color={activeTab === "events" ? "#2563eb" : "#64748b"}
            />
            <Text style={[styles.tabText, activeTab === "events" && styles.tabTextActive]}>
              Audit trail ({events.length + auditLogs.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "financials" ? (
          <View style={styles.sectionStack}>
            {/* Financial Reporting Timeline Selector */}
            <View style={styles.periodCard}>
              <Text style={styles.periodTitle}>Reporting Timeline</Text>
              <View style={styles.periodPills}>
                {(["monthly", "quarterly", "yearly"] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                    onPress={() => setPeriod(p)}
                  >
                    <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <NativeRevenueExpenseCard period={period} />
            <NativeBankBalancesCard />
            <NativeAccountDistributionCard />
            <NativeRecentTransactionsCard />
          </View>
        ) : (
          <View style={styles.auditCard}>
            <View style={styles.auditHeader}>
              <MaterialCommunityIcons name="pulse" size={16} color="#4f46e5" />
              <Text style={styles.auditTitle}>Immutable System Audit Trail</Text>
            </View>
            <Text style={styles.auditSub}>
              Synchronized operational telemetry, approver actions, and cross-portal event records.
            </Text>

            {isAuditLoading || isEventsLoading ? (
              <ActivityIndicator style={{ paddingVertical: 24 }} color="#2563eb" />
            ) : auditLogs.length === 0 ? (
              <Text style={styles.emptyText}>No executive audit logs recorded yet.</Text>
            ) : (
              <View style={styles.auditList}>
                {auditLogs.map((log, idx) => (
                  <View
                    key={log.id}
                    style={[styles.auditRow, idx === auditLogs.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    <View style={styles.auditTopRow}>
                      <Text style={styles.auditAction}>{log.action}</Text>
                      <View style={styles.resultBadge}>
                        <Text style={styles.resultText}>{log.result}</Text>
                      </View>
                    </View>
                    <Text style={styles.auditTarget}>Target: {log.target_entity}</Text>
                    <Text style={styles.auditMeta}>
                      Triggered by {log.requested_by} ({log.source_application} → {log.target_application})
                    </Text>
                    <Text style={styles.auditTime}>
                      {new Date(log.created_at).toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: 14,
    paddingBottom: 32,
    gap: 14,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCard: {
    width: "48.5%",
    flexGrow: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  kpiTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748b",
    flex: 1,
  },
  kpiIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiLoader: {
    marginTop: 14,
    alignSelf: "flex-start",
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 10,
  },
  kpiHint: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 3,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: "#ffffff",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  tabTextActive: {
    color: "#0f172a",
  },
  sectionStack: {
    gap: 12,
  },
  periodCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    gap: 8,
  },
  periodTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  periodPills: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 3,
    gap: 2,
  },
  periodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  periodBtnActive: {
    backgroundColor: "#ffffff",
  },
  periodText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "capitalize",
  },
  periodTextActive: {
    color: "#4338ca",
  },
  auditCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
  },
  auditHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  auditTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  auditSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    paddingVertical: 20,
  },
  auditList: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  auditRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 3,
  },
  auditTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  auditAction: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  resultBadge: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  resultText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
  },
  auditTarget: {
    fontSize: 12,
    color: "#475569",
  },
  auditMeta: {
    fontSize: 11,
    color: "#64748b",
  },
  auditTime: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 2,
  },
});
