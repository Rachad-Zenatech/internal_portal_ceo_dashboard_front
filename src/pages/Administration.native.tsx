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
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { useNavigation } from "@react-navigation/native";

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
  description: string;
  quantity: number;
  unit_price: number;
  total?: number;
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
  gl_code?: string;
  currency?: string;
  item_url?: string;
  product_info?: {
    vendor?: string;
    specs?: string;
    delivery_date?: string;
    model?: string;
    warranty?: string;
  };
  items?: PurchaseRequestLineItem[];
  item_mode?: "SINGLE" | "MULTIPLE";
  quantity?: number;
  unit_price?: number;
  quote_data?: {
    vendor_name?: string;
    quote_number?: string;
    quote_date?: string;
  };
}

export default function Administration() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [detailedRequest, setDetailedRequest] = useState<PurchaseRequest | null>(null);

  // Portals Status Query
  const {
    data: portals = [],
    refetch: refetchPortals,
  } = useQuery<PortalStatus[]>({
    queryKey: ["portalsStatus"],
    queryFn: () => apiClient.get<PortalStatus[]>("/api/v1/ceo/portals-status"),
    staleTime: 30000,
    retry: false,
  });

  const adminPortal = useMemo(
    () => (Array.isArray(portals) ? portals.find((p) => p?.code?.toUpperCase().includes("ADMIN") || p?.name?.toLowerCase().includes("admin")) : undefined),
    [portals]
  );
  const isAdminOnline = adminPortal?.status === "online";

  // Pending Approvals Query
  const {
    data: rawApprovals = [],
    isLoading: isApprovalsLoading,
    refetch: refetchApprovals,
    isRefetching: isRefetchingApprovals,
  } = useQuery<PurchaseRequest[]>({
    queryKey: ["pendingApprovals"],
    queryFn: () => apiClient.get<PurchaseRequest[]>("/api/v1/ceo/approvals/pending"),
    staleTime: 30000,
    retry: false,
  });

  const pendingApprovals = useMemo(() => {
    return Array.isArray(rawApprovals) ? rawApprovals : [];
  }, [rawApprovals]);

  // Completed / Approved History Query
  const {
    data: rawCompletedHistory = [],
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
    isRefetching: isRefetchingHistory,
  } = useQuery<PurchaseRequest[]>({
    queryKey: ["completedApprovalsHistory"],
    queryFn: () => apiClient.get<PurchaseRequest[]>("/api/v1/ceo/approvals/history"),
    staleTime: 30000,
    retry: false,
  });

  const approvedRequests = useMemo(() => {
    if (Array.isArray(rawCompletedHistory) && rawCompletedHistory.length > 0) {
      return rawCompletedHistory.map((r) => ({
        id: String(r?.id || ""),
        department: r?.department || "Operations",
        requester_name: r?.requester_name || "Staff",
        amount: Number(r?.amount || 0),
        description: r?.description || (r as any)?.product_name || `Purchase Request #${r?.id}`,
        status: r?.status || "COMPLETED",
        created_at: r?.created_at || "",
        priority: r?.priority || "Normal",
        vendor: (r?.product_info as any)?.vendor || "Verified Vendor",
        product_info: r?.product_info,
        items: r?.items,
      }));
    }
    return [];
  }, [rawCompletedHistory]);

  // Detail query for active selected detailed request
  const { data: requestDetailResponse } = useQuery({
    queryKey: ["approvalDetail", detailedRequest?.id],
    queryFn: async () => {
      if (!detailedRequest?.id) return null;
      const res = await apiClient.get<any>(`/api/v1/ceo/approvals/${detailedRequest.id}`);
      return res?.request || res;
    },
    enabled: Boolean(detailedRequest?.id),
    staleTime: 10000,
    retry: false,
  });

  const activeRequest = useMemo(() => {
    if (!detailedRequest) return null;
    if (requestDetailResponse && String(requestDetailResponse.id) === String(detailedRequest.id)) {
      return { ...detailedRequest, ...requestDetailResponse };
    }
    return detailedRequest;
  }, [detailedRequest, requestDetailResponse]);

  // Execute Action Mutation
  const approvalMutation = useMutation({
    mutationFn: async ({ requestId, action, note }: { requestId: string; action: string; note: string }) => {
      return apiClient.post(`/api/v1/ceo/approvals/${requestId}/action`, {
        action,
        note: note || undefined,
      });
    },
    onSuccess: (_, variables) => {
      const verb = variables.action === "APPROVE" ? "approved" : "rejected";
      Alert.alert("Success", `Purchase Request #${variables.requestId} successfully ${verb}`);
      queryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
      queryClient.invalidateQueries({ queryKey: ["completedApprovalsHistory"] });
      setSelectedRequest(null);
      setActionNote("");
      setActionType(null);
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.message || "Failed to execute approval action.");
    },
  });

  const handleActionSubmit = () => {
    if (!selectedRequest || !actionType) return;
    approvalMutation.mutate({
      requestId: selectedRequest.id,
      action: actionType,
      note: actionNote,
    });
  };

  const isRefreshing = isRefetchingApprovals || isRefetchingHistory;

  const onRefresh = () => {
    refetchPortals();
    refetchApprovals();
    refetchHistory();
  };

  // Filtered lists
  const filteredPending = useMemo(() => {
    return pendingApprovals.filter((req) => {
      if (!req) return false;
      const q = searchTerm.toLowerCase();
      return (
        (req.description || "").toLowerCase().includes(q) ||
        (req.department || "").toLowerCase().includes(q) ||
        (req.requester_name || "").toLowerCase().includes(q) ||
        String(req.id || "").includes(q)
      );
    });
  }, [pendingApprovals, searchTerm]);

  const filteredApproved = useMemo(() => {
    return approvedRequests.filter((req) => {
      if (!req) return false;
      const q = searchTerm.toLowerCase();
      return (
        (req.description || "").toLowerCase().includes(q) ||
        (req.department || "").toLowerCase().includes(q) ||
        (req.requester_name || "").toLowerCase().includes(q) ||
        String(req.id || "").includes(q)
      );
    });
  }, [approvedRequests, searchTerm]);

  const totalPendingAmount = (Array.isArray(pendingApprovals) ? pendingApprovals : []).reduce(
    (acc, curr) => acc + (Number(curr?.amount) || 0),
    0
  );
  const totalApprovedAmount = (Array.isArray(approvedRequests) ? approvedRequests : []).reduce(
    (acc, curr) => acc + (Number(curr?.amount) || 0),
    0
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Administration</Text>
          <Text style={styles.headerSubtitle}>Purchasing Governance & PBAC</Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={isRefreshing}
        >
          <Ionicons
            name="refresh"
            size={20}
            color="#2563eb"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={["#2563eb"]} />
        }
      >
        {/* Offline Banner */}
        {!isAdminOnline && (
          <View style={styles.offlineBanner}>
            <View style={styles.offlineBannerLeft}>
              <View style={styles.offlineIconBox}>
                <Ionicons name="cloud-offline" size={18} color="#dc2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.offlineTitle}>Admin Portal (:8001) Disconnected</Text>
                <Text style={styles.offlineSubtitle}>
                  Live purchasing approvals are paused until the administration backend is online.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* KPI Cards */}
        <View style={styles.kpiRow}>
          <NativeCard style={[styles.kpiCard, { borderLeftColor: "#d97706", borderLeftWidth: 4 }]}>
            <NativeCardContent style={styles.kpiCardContent}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel}>PENDING REVIEW</Text>
                <Ionicons name="time-outline" size={16} color="#d97706" />
              </View>
              <Text style={styles.kpiValue}>{pendingApprovals.length}</Text>
              <Text style={styles.kpiSub}>
                ${totalPendingAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </Text>
            </NativeCardContent>
          </NativeCard>

          <NativeCard style={[styles.kpiCard, { borderLeftColor: "#16a34a", borderLeftWidth: 4 }]}>
            <NativeCardContent style={styles.kpiCardContent}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel}>APPROVED</Text>
                <Ionicons name="checkmark-circle-outline" size={16} color="#16a34a" />
              </View>
              <Text style={styles.kpiValue}>{approvedRequests.length}</Text>
              <Text style={styles.kpiSub}>
                ${totalApprovedAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </Text>
            </NativeCardContent>
          </NativeCard>
        </View>

        {/* Segmented Control Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "pending" && styles.tabButtonActive]}
            onPress={() => setActiveTab("pending")}
          >
            <Text style={[styles.tabButtonText, activeTab === "pending" && styles.tabButtonTextActive]}>
              Pending ({pendingApprovals.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === "approved" && styles.tabButtonActive]}
            onPress={() => setActiveTab("approved")}
          >
            <Text style={[styles.tabButtonText, activeTab === "approved" && styles.tabButtonTextActive]}>
              Approved History ({approvedRequests.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by ID, requester, department..."
            placeholderTextColor="#94a3b8"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm("")}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* List Content */}
        {activeTab === "pending" ? (
          isApprovalsLoading ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.loaderText}>Loading pending approvals...</Text>
            </View>
          ) : filteredPending.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-done-circle" size={40} color="#16a34a" />
              <Text style={styles.emptyTitle}>All Caught Up</Text>
              <Text style={styles.emptySub}>
                No pending purchase requests require executive approval at this time.
              </Text>
            </View>
          ) : (
            filteredPending.map((req) => (
              <TouchableOpacity
                key={req.id}
                style={styles.requestCard}
                onPress={() => setDetailedRequest(req)}
                activeOpacity={0.7}
              >
                <View style={styles.requestCardHeader}>
                  <View style={styles.reqIdRow}>
                    <Text style={styles.reqIdText}>#{req.id}</Text>
                    <NativeBadge variant="outline" style={styles.deptBadge}>
                      <Text style={styles.deptBadgeText}>{req.department}</Text>
                    </NativeBadge>
                  </View>
                  <Text style={styles.reqAmount}>
                    ${Number(req.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                <Text style={styles.reqDescription} numberOfLines={2}>
                  {req.description || "Purchase Request"}
                </Text>

                <View style={styles.reqFooter}>
                  <View style={styles.reqMeta}>
                    <Ionicons name="person-outline" size={12} color="#64748b" />
                    <Text style={styles.reqRequester}>{req.requester_name}</Text>
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.rejectSmallBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        setSelectedRequest(req);
                        setActionType("REJECT");
                      }}
                    >
                      <Ionicons name="close" size={14} color="#dc2626" />
                      <Text style={styles.rejectSmallText}>Reject</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.approveSmallBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        setSelectedRequest(req);
                        setActionType("APPROVE");
                      }}
                    >
                      <Ionicons name="checkmark" size={14} color="#ffffff" />
                      <Text style={styles.approveSmallText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )
        ) : (
          isHistoryLoading ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.loaderText}>Loading approved history...</Text>
            </View>
          ) : filteredApproved.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="file-tray-outline" size={40} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Approved History</Text>
              <Text style={styles.emptySub}>No completed or approved purchases found.</Text>
            </View>
          ) : (
            filteredApproved.map((req) => (
              <TouchableOpacity
                key={req.id}
                style={styles.requestCard}
                onPress={() => setDetailedRequest(req)}
                activeOpacity={0.7}
              >
                <View style={styles.requestCardHeader}>
                  <View style={styles.reqIdRow}>
                    <Text style={styles.reqIdText}>#{req.id}</Text>
                    <View style={styles.approvedPill}>
                      <Ionicons name="checkmark" size={10} color="#16a34a" />
                      <Text style={styles.approvedPillText}>APPROVED</Text>
                    </View>
                  </View>
                  <Text style={styles.reqAmount}>
                    ${Number(req.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                <Text style={styles.reqDescription} numberOfLines={2}>
                  {req.description || "Purchase Request"}
                </Text>

                <View style={styles.reqFooter}>
                  <View style={styles.reqMeta}>
                    <Ionicons name="person-outline" size={12} color="#64748b" />
                    <Text style={styles.reqRequester}>{req.requester_name} • {req.department}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Decision Action Modal */}
      <Modal
        visible={selectedRequest !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRequest(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Confirm Executive {actionType === "APPROVE" ? "Approval" : "Rejection"}
              </Text>
              <Text style={styles.modalSub}>
                Request #{selectedRequest?.id} • {selectedRequest?.department}
              </Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalAmount}>
                ${Number(selectedRequest?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
              <Text style={styles.modalDesc}>{selectedRequest?.description}</Text>

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
                disabled={approvalMutation.isPending}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  actionType === "APPROVE" ? styles.confirmBtnApprove : styles.confirmBtnReject,
                ]}
                onPress={handleActionSubmit}
                disabled={approvalMutation.isPending}
              >
                {approvalMutation.isPending ? (
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

      {/* Full Request Details Modal */}
      <Modal
        visible={activeRequest !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailedRequest(null)}
      >
        <View style={styles.detailModalOverlay}>
          <View style={styles.detailModalCard}>
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailReqNumber}>Request #{activeRequest?.id}</Text>
                <Text style={styles.detailDeptSub}>{activeRequest?.department}</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailedRequest(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailBody}>
              <View style={styles.detailHero}>
                <Text style={styles.detailHeroLabel}>TOTAL AMOUNT</Text>
                <Text style={styles.detailHeroAmount}>
                  ${Number(activeRequest?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionHeading}>DESCRIPTION & JUSTIFICATION</Text>
                <Text style={styles.detailDescriptionText}>
                  {activeRequest?.description || "No description provided."}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionHeading}>DETAILS</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailRowLabel}>Requester:</Text>
                  <Text style={styles.detailRowVal}>{activeRequest?.requester_name || "Staff"}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailRowLabel}>Priority:</Text>
                  <Text style={styles.detailRowVal}>{activeRequest?.priority || "Normal"}</Text>
                </View>
                {activeRequest?.created_at && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>Date:</Text>
                    <Text style={styles.detailRowVal}>
                      {new Date(activeRequest.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.detailFooter}>
              <TouchableOpacity
                style={styles.detailCloseBtn}
                onPress={() => setDetailedRequest(null)}
              >
                <Text style={styles.detailCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#64748b",
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
  },
  scrollBody: {
    flex: 1,
    padding: 16,
  },
  offlineBanner: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  offlineBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  offlineIconBox: {
    padding: 6,
    backgroundColor: "#fee2e2",
    borderRadius: 8,
  },
  offlineTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#991b1b",
  },
  offlineSubtitle: {
    fontSize: 11,
    color: "#b91c1c",
    marginTop: 2,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  kpiCardContent: {
    padding: 12,
  },
  kpiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3b82f6",
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  tabButtonTextActive: {
    color: "#2563eb",
    fontWeight: "700",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 10,
    marginBottom: 14,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: "#0f172a",
  },
  loaderBox: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loaderText: {
    fontSize: 12,
    color: "#64748b",
  },
  emptyCard: {
    padding: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 4,
  },
  emptySub: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  requestCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    marginBottom: 10,
  },
  requestCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reqIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reqIdText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2563eb",
    fontFamily: "monospace",
  },
  deptBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deptBadgeText: {
    fontSize: 10,
    color: "#64748b",
  },
  reqAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  reqDescription: {
    fontSize: 13,
    fontWeight: "500",
    color: "#334155",
    marginTop: 6,
    lineHeight: 18,
  },
  reqFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  reqMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reqRequester: {
    fontSize: 11,
    color: "#64748b",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  rejectSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#fee2e2",
    gap: 4,
  },
  rejectSmallText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#dc2626",
  },
  approveSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#16a34a",
    gap: 4,
  },
  approveSmallText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ffffff",
  },
  approvedPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  approvedPillText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#16a34a",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
  },
  modalHeader: {
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  modalBody: {
    gap: 8,
  },
  modalAmount: {
    fontSize: 22,
    fontWeight: "800",
    color: "#2563eb",
  },
  modalDesc: {
    fontSize: 13,
    color: "#334155",
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
    marginTop: 8,
  },
  noteInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    textAlignVertical: "top",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  confirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmBtnApprove: {
    backgroundColor: "#16a34a",
  },
  confirmBtnReject: {
    backgroundColor: "#dc2626",
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  detailModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  detailModalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "85%",
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  detailReqNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  detailDeptSub: {
    fontSize: 12,
    color: "#64748b",
  },
  detailBody: {
    paddingVertical: 14,
  },
  detailHero: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  detailHeroLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
  },
  detailHeroAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: "#2563eb",
    marginTop: 2,
  },
  detailSection: {
    marginBottom: 14,
  },
  detailSectionHeading: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 6,
  },
  detailDescriptionText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 18,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  detailRowLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  detailRowVal: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  detailFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  detailCloseBtn: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  detailCloseBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
});
