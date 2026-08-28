import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  NativeCard,
  NativeCardContent,
  NativeBadge,
  SafeAreaView,
} from "@/components/native";
import {
  Modal,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { useNavigation } from "@react-navigation/native";

const PAGE_SIZE = 50;

interface AuditLogItem {
  id: string | number;
  created_at: string;
  actor_name?: string;
  actor_email?: string;
  action: string;
  entity_type?: string;
  target_entity?: string;
  result?: string;
  details?: any;
}

interface LoginActivityItem {
  id?: string | number;
  created_at: string;
  user_full_name?: string;
  email: string;
  success: boolean;
  failure_reason?: string;
  ip_address?: string;
}

export default function AuditLog() {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<"audit" | "logins">("audit");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Fetch Audit Logs
  const {
    data: auditLogs = [],
    isLoading: isAuditLoading,
    refetch: refetchAudit,
  } = useQuery<AuditLogItem[]>({
    queryKey: ["auditLogs-native"],
    queryFn: () => apiClient.get<AuditLogItem[]>("/api/audit-logs"),
    refetchInterval: 20000,
  });

  // 2. Fetch Login Activities
  const {
    data: loginActivities = [],
    isLoading: isLoginsLoading,
    refetch: refetchLogins,
  } = useQuery<LoginActivityItem[]>({
    queryKey: ["loginActivities-native"],
    queryFn: () => apiClient.get<LoginActivityItem[]>("/api/login-activities"),
    refetchInterval: 20000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchAudit(), refetchLogins()]);
    setRefreshing(false);
  };

  // Filter Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (log.actor_name || "").toLowerCase().includes(q) ||
        (log.actor_email || "").toLowerCase().includes(q) ||
        (log.action || "").toLowerCase().includes(q) ||
        (log.entity_type || "").toLowerCase().includes(q) ||
        (log.target_entity || "").toLowerCase().includes(q);

      const matchesAction =
        selectedActionFilter === "ALL" ||
        (log.action || "").toUpperCase().includes(selectedActionFilter.toUpperCase());

      return matchesSearch && matchesAction;
    });
  }, [auditLogs, searchQuery, selectedActionFilter]);

  // Filter Login Activities
  const filteredLogins = useMemo(() => {
    return loginActivities.filter((log) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        (log.user_full_name || "").toLowerCase().includes(q) ||
        (log.email || "").toLowerCase().includes(q) ||
        (log.ip_address || "").toLowerCase().includes(q) ||
        (log.failure_reason || "").toLowerCase().includes(q)
      );
    });
  }, [loginActivities, searchQuery]);

  const activeListLength = activeTab === "audit" ? filteredAuditLogs.length : filteredLogins.length;
  const totalPages = Math.max(1, Math.ceil(activeListLength / PAGE_SIZE));

  const paginatedAuditLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAuditLogs.slice(start, start + PAGE_SIZE);
  }, [filteredAuditLogs, currentPage]);

  const paginatedLogins = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLogins.slice(start, start + PAGE_SIZE);
  }, [filteredLogins, currentPage]);

  const getActionColor = (action: string) => {
    const a = action.toUpperCase();
    if (a.includes("APPROVE") || a.includes("CREATE")) return "#16a34a";
    if (a.includes("REJECT") || a.includes("DELETE")) return "#dc2626";
    if (a.includes("UPDATE") || a.includes("ASSIGN")) return "#2563eb";
    return "#64748b";
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Nav Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate("Dashboard")}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.navTitleContainer}>
          <Text style={styles.navTitle}>System Audit Trail</Text>
          <Text style={styles.navSubtitle}>Governance & Security Logs</Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} />
        }
      >
        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "audit" && styles.tabButtonActive]}
            onPress={() => {
              setActiveTab("audit");
              setCurrentPage(1);
            }}
          >
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={16}
              color={activeTab === "audit" ? "#2563eb" : "#64748b"}
            />
            <Text style={[styles.tabButtonText, activeTab === "audit" && styles.tabButtonTextActive]}>
              Audit Logs ({auditLogs.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === "logins" && styles.tabButtonActive]}
            onPress={() => {
              setActiveTab("logins");
              setCurrentPage(1);
            }}
          >
            <MaterialCommunityIcons
              name="account-key-outline"
              size={16}
              color={activeTab === "logins" ? "#2563eb" : "#64748b"}
            />
            <Text style={[styles.tabButtonText, activeTab === "logins" && styles.tabButtonTextActive]}>
              Login Security ({loginActivities.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={
              activeTab === "audit"
                ? "Search actor, action, entity ID..."
                : "Search email, IP address, user..."
            }
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={(t) => {
              setSearchQuery(t);
              setCurrentPage(1);
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips for Audit Tab */}
        {activeTab === "audit" && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {["ALL", "APPROVE", "REJECT", "CREATE", "UPDATE", "ROLE", "LOGIN"].map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterChip,
                  selectedActionFilter === f && styles.filterChipActive,
                ]}
                onPress={() => {
                  setSelectedActionFilter(f);
                  setCurrentPage(1);
                }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedActionFilter === f && styles.filterChipTextActive,
                  ]}
                >
                  {f === "ALL" ? "All Actions" : f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Pagination Top Bar */}
        <View style={styles.paginationBar}>
          <Text style={styles.paginationText}>
            Showing {activeTab === "audit" ? paginatedAuditLogs.length : paginatedLogins.length} of {activeListLength} • 50 items/page
          </Text>
          <View style={styles.paginationButtons}>
            <TouchableOpacity
              style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
              disabled={currentPage === 1}
              onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <Ionicons name="chevron-back" size={16} color={currentPage === 1 ? "#cbd5e1" : "#0f172a"} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
              disabled={currentPage >= totalPages}
              onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <Ionicons name="chevron-forward" size={16} color={currentPage >= totalPages ? "#cbd5e1" : "#0f172a"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Audit Tab List */}
        {activeTab === "audit" ? (
          isAuditLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Loading audit logs...</Text>
            </View>
          ) : paginatedAuditLogs.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="shield-alert-outline" size={40} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No matching audit logs</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your search or action filter.</Text>
            </View>
          ) : (
            paginatedAuditLogs.map((log) => {
              const actionColor = getActionColor(log.action);
              return (
                <TouchableOpacity
                  key={log.id}
                  activeOpacity={0.7}
                  onPress={() => setSelectedLog(log)}
                >
                  <NativeCard style={styles.logCard}>
                    <NativeCardContent style={styles.logCardContent}>
                      <View style={styles.logTopRow}>
                        <View style={styles.actionBadgeRow}>
                          <View
                            style={[
                              styles.actionDot,
                              { backgroundColor: actionColor },
                            ]}
                          />
                          <Text style={[styles.actionText, { color: actionColor }]}>
                            {log.action}
                          </Text>
                        </View>
                        <Text style={styles.logTime}>
                          {log.created_at
                            ? new Date(log.created_at).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </Text>
                      </View>

                      <View style={styles.logActorRow}>
                        <Ionicons name="person-circle-outline" size={16} color="#64748b" />
                        <Text style={styles.logActorName}>
                          {log.actor_name || "System"}
                        </Text>
                        {log.actor_email ? (
                          <Text style={styles.logActorEmail} numberOfLines={1}>
                            ({log.actor_email})
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.logEntityRow}>
                        {log.entity_type ? (
                          <NativeBadge variant="outline" style={styles.entityBadge}>
                            <Text style={styles.entityBadgeText}>{log.entity_type}</Text>
                          </NativeBadge>
                        ) : null}
                        {log.target_entity ? (
                          <Text style={styles.targetEntityText} numberOfLines={1}>
                            Target: {log.target_entity}
                          </Text>
                        ) : null}
                        <View style={{ flex: 1 }} />
                        <Text style={styles.inspectText}>Inspect Details →</Text>
                      </View>
                    </NativeCardContent>
                  </NativeCard>
                </TouchableOpacity>
              );
            })
          )
        ) : (
          /* Login Activities List */
          isLoginsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Loading login events...</Text>
            </View>
          ) : paginatedLogins.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="account-search-outline" size={40} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No login records found</Text>
            </View>
          ) : (
            paginatedLogins.map((login, idx) => (
              <NativeCard key={login.id || idx} style={styles.logCard}>
                <NativeCardContent style={styles.logCardContent}>
                  <View style={styles.logTopRow}>
                    <View style={styles.actionBadgeRow}>
                      <Ionicons
                        name={login.success ? "checkmark-circle" : "close-circle"}
                        size={18}
                        color={login.success ? "#16a34a" : "#dc2626"}
                      />
                      <Text
                        style={[
                          styles.actionText,
                          { color: login.success ? "#16a34a" : "#dc2626" },
                        ]}
                      >
                        {login.success ? "Authentication Success" : "Authentication Failed"}
                      </Text>
                    </View>
                    <Text style={styles.logTime}>
                      {login.created_at
                        ? new Date(login.created_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </Text>
                  </View>

                  <View style={styles.logActorRow}>
                    <Ionicons name="mail-outline" size={16} color="#64748b" />
                    <Text style={styles.logActorName}>{login.email}</Text>
                    {login.user_full_name ? (
                      <Text style={styles.logActorEmail}>• {login.user_full_name}</Text>
                    ) : null}
                  </View>

                  <View style={styles.logEntityRow}>
                    <Text style={styles.ipText}>IP: {login.ip_address || "Internal"}</Text>
                    {login.failure_reason ? (
                      <Text style={styles.failureReasonText} numberOfLines={1}>
                        Reason: {login.failure_reason}
                      </Text>
                    ) : null}
                  </View>
                </NativeCardContent>
              </NativeCard>
            ))
          )
        )}

        {/* Pagination Footer */}
        {activeListLength > 0 && (
          <View style={styles.paginationFooter}>
            <TouchableOpacity
              style={[styles.footerPageBtn, currentPage === 1 && styles.pageBtnDisabled]}
              disabled={currentPage === 1}
              onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <Ionicons name="chevron-back" size={16} color="#2563eb" />
              <Text style={styles.footerPageBtnText}>Previous</Text>
            </TouchableOpacity>

            <Text style={styles.footerPageIndicator}>
              Page {currentPage} of {totalPages}
            </Text>

            <TouchableOpacity
              style={[styles.footerPageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
              disabled={currentPage >= totalPages}
              onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <Text style={styles.footerPageBtnText}>Next</Text>
              <Ionicons name="chevron-forward" size={16} color="#2563eb" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ========================================================= */}
      {/* AUDIT LOG DETAILS / JSON INSPECTOR MODAL                   */}
      {/* ========================================================= */}
      <Modal
        visible={selectedLog !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedLog(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconBox}>
                  <MaterialCommunityIcons name="code-json" size={24} color="#2563eb" />
                </View>
                <View style={styles.modalHeaderTitles}>
                  <Text style={styles.modalLogAction} numberOfLines={1}>
                    {selectedLog?.action}
                  </Text>
                  <Text style={styles.modalSub}>
                    {selectedLog?.created_at ? new Date(selectedLog.created_at).toLocaleString() : "-"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedLog(null)}
              >
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Actor:</Text>
                <Text style={styles.detailValue}>
                  {selectedLog?.actor_name || "System"} ({selectedLog?.actor_email || "N/A"})
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Target Entity:</Text>
                <Text style={styles.detailValue}>
                  {selectedLog?.entity_type} #{selectedLog?.target_entity || "-"}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Result Status:</Text>
                <Text
                  style={[
                    styles.detailValue,
                    { color: selectedLog?.result === "SUCCESS" ? "#16a34a" : "#2563eb" },
                  ]}
                >
                  {selectedLog?.result || "COMPLETED"}
                </Text>
              </View>

              <Text style={styles.payloadTitle}>Full Audit Payload & Context:</Text>
              <View style={styles.jsonCodeBox}>
                <Text style={styles.jsonCodeText}>
                  {JSON.stringify(selectedLog?.details || selectedLog, null, 2)}
                </Text>
              </View>
            </ScrollView>
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
  },
  backButton: {
    padding: 6,
  },
  navTitleContainer: {
    alignItems: "center",
  },
  navTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  navSubtitle: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "500",
  },
  refreshButton: {
    padding: 6,
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: "#ffffff",
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  tabButtonTextActive: {
    color: "#2563eb",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
  },
  chipsScroll: {
    flexDirection: "row",
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  filterChipTextActive: {
    color: "#2563eb",
  },
  paginationBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  paginationText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  paginationButtons: {
    flexDirection: "row",
    gap: 6,
  },
  pageBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  logCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 8,
  },
  logCardContent: {
    padding: 12,
    gap: 6,
  },
  logTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  logTime: {
    fontSize: 10,
    color: "#94a3b8",
  },
  logActorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  logActorName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  logActorEmail: {
    fontSize: 11,
    color: "#64748b",
  },
  logEntityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  entityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  entityBadgeText: {
    fontSize: 9,
    fontWeight: "600",
  },
  targetEntityText: {
    fontSize: 11,
    color: "#64748b",
    maxWidth: 140,
  },
  inspectText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2563eb",
  },
  ipText: {
    fontSize: 11,
    color: "#64748b",
    fontFamily: "monospace",
  },
  failureReasonText: {
    fontSize: 11,
    color: "#dc2626",
    fontStyle: "italic",
    marginLeft: 8,
  },
  paginationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 10,
  },
  footerPageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  footerPageBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563eb",
  },
  footerPageIndicator: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
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
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 14,
    marginBottom: 14,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  modalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderTitles: {
    flex: 1,
  },
  modalLogAction: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalSub: {
    fontSize: 11,
    color: "#64748b",
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    gap: 10,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  detailLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "700",
  },
  payloadTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginTop: 8,
  },
  jsonCodeBox: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  jsonCodeText: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "#38bdf8",
    lineHeight: 16,
  },
});
