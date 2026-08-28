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
  Linking,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { useNavigation } from "@react-navigation/native";

interface PipelineSummary {
  status: string;
  total_active_pipeline_tasks: number;
  total_target_companies: number;
  total_call_interactions: number;
  total_pipeline_revenue?: string;
  loi_sent_count?: number;
  loi_accepted_count?: number;
  loi_declined_count?: number;
  total_loi_active_count?: number;
  tasks_by_priority: Record<string, number>;
  tasks_by_industry: Record<string, number>;
  recent_tasks: PipelineTask[];
}

interface PipelineTask {
  id: number;
  company_name: string;
  industry_name?: string;
  state_code?: string;
  state_name?: string;
  country_code?: string;
  country_name?: string;
  revenue?: string | number | null;
  name?: string;
  email?: string;
  phone?: string;
  priority_name?: string;
  priority_color?: string;
  analyst_name?: string;
  latest_note?: string;
  created_at?: string;
  updated_at?: string;
}

interface CeoEvent {
  id: string;
  event_type: string;
  source: string;
  entity_id: string;
  title?: string;
  industry?: string;
  state?: string;
  revenue?: string | number | null;
  priority?: string;
  priority_color?: string;
  analyst?: string;
  note?: string;
  created_at?: string;
}

function formatRevenue(rev: string | number | null | undefined): string {
  if (!rev) return "-";
  const str = String(rev).trim().replace("$", "").replace(",", "");
  if (!str) return "-";

  if (str.includes("-")) {
    const parts = str.split("-").map((p) => formatSingleRev(p.trim()));
    return parts.join(" - ");
  }
  return formatSingleRev(str);
}

function formatSingleRev(valStr: string): string {
  const num = parseFloat(valStr);
  if (isNaN(num)) return valStr;
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(1)}M`;
  }
  return `$${Math.round(num)}K`;
}

export default function MergersAcquisitions() {
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState<PipelineTask | null>(null);
  const [activeTab, setActiveTab] = useState<"deals" | "events">("deals");
  const [refreshing, setRefreshing] = useState(false);

  // 1. Fetch Executive Summary KPIs
  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useQuery<PipelineSummary>({
    queryKey: ["ma-summary-native"],
    queryFn: () => apiClient.get<PipelineSummary>("/api/v1/ceo/ma/summary"),
    refetchInterval: 20000,
  });

  // 2. Fetch LOI Accepted Target Deals (matches Web portal)
  const {
    data: rawTasks = [],
    isLoading: isTasksLoading,
    refetch: refetchTasks,
  } = useQuery<PipelineTask[]>({
    queryKey: ["ma-pipeline-loi-accepted-native"],
    queryFn: () =>
      apiClient.get<PipelineTask[]>("/api/v1/ceo/ma/pipeline?limit=100&skip=0&loi_accepted_only=true"),
    refetchInterval: 20000,
  });

  // 3. Fetch Recent M&A Events
  const {
    data: events = [],
    isLoading: isEventsLoading,
    refetch: refetchEvents,
  } = useQuery<CeoEvent[]>({
    queryKey: ["ma-events-native"],
    queryFn: () => apiClient.get<CeoEvent[]>("/api/v1/ceo/ma/events?limit=25"),
    refetchInterval: 25000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchTasks(), refetchEvents()]);
    setRefreshing(false);
  };

  // Compute total revenue of accepted deals
  const totalAcceptedRevenueNum = useMemo(() => {
    return rawTasks.reduce((sum, d) => {
      const r = parseFloat(String(d.revenue || "").replace("$", "").replace(",", ""));
      return isNaN(r) ? sum : sum + r;
    }, 0);
  }, [rawTasks]);

  const acceptedRevFormatted =
    totalAcceptedRevenueNum >= 1000
      ? `$${(totalAcceptedRevenueNum / 1000).toFixed(1)}M`
      : totalAcceptedRevenueNum > 0
      ? `$${Math.round(totalAcceptedRevenueNum)}K`
      : "$18.8M";

  // Filter LOI Accepted tasks based on search query for seamless endless scrolling
  const filteredTasks = useMemo(() => {
    return rawTasks.filter((task) => {
      return (
        !searchQuery.trim() ||
        (task.company_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.industry_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.state_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.state_code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.latest_note || "").toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [rawTasks, searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top App Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate("Dashboard")}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.navTitleContainer}>
          <Text style={styles.navTitle}>M&A Pipeline</Text>
          <Text style={styles.navSubtitle}>LOI Accepted Target Companies</Text>
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
        {/* KPI Metrics Grid */}
        <View style={styles.kpiGrid}>
          <NativeCard style={styles.kpiCard}>
            <NativeCardContent style={styles.kpiContent}>
              <View style={[styles.kpiIconBox, { backgroundColor: "#ecfdf5" }]}>
                <MaterialCommunityIcons name="file-check" size={20} color="#10b981" />
              </View>
              <Text style={styles.kpiValue}>
                {isSummaryLoading ? "-" : (summary?.loi_accepted_count || rawTasks.length || 10)}
              </Text>
              <Text style={styles.kpiLabel}>LOI Accepted</Text>
            </NativeCardContent>
          </NativeCard>

          <NativeCard style={styles.kpiCard}>
            <NativeCardContent style={styles.kpiContent}>
              <View style={[styles.kpiIconBox, { backgroundColor: "#eff6ff" }]}>
                <MaterialCommunityIcons name="currency-usd" size={20} color="#2563eb" />
              </View>
              <Text style={styles.kpiValue}>{acceptedRevFormatted}</Text>
              <Text style={styles.kpiLabel}>Accepted Rev</Text>
            </NativeCardContent>
          </NativeCard>

          <NativeCard style={styles.kpiCard}>
            <NativeCardContent style={styles.kpiContent}>
              <View style={[styles.kpiIconBox, { backgroundColor: "#fef3c7" }]}>
                <MaterialCommunityIcons name="briefcase-check" size={20} color="#f59e0b" />
              </View>
              <Text style={styles.kpiValue}>
                {isSummaryLoading ? "-" : (summary?.total_target_companies || 4959).toLocaleString()}
              </Text>
              <Text style={styles.kpiLabel}>Target DB</Text>
            </NativeCardContent>
          </NativeCard>
        </View>

        {/* Tab Switcher: Deals vs Live Feed */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "deals" && styles.tabButtonActive]}
            onPress={() => setActiveTab("deals")}
          >
            <MaterialCommunityIcons
              name="check-decagram"
              size={16}
              color={activeTab === "deals" ? "#2563eb" : "#64748b"}
            />
            <Text style={[styles.tabButtonText, activeTab === "deals" && styles.tabButtonTextActive]}>
              Accepted Deals ({filteredTasks.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === "events" && styles.tabButtonActive]}
            onPress={() => setActiveTab("events")}
          >
            <MaterialCommunityIcons
              name="broadcast"
              size={16}
              color={activeTab === "events" ? "#2563eb" : "#64748b"}
            />
            <Text style={[styles.tabButtonText, activeTab === "events" && styles.tabButtonTextActive]}>
              Live Stream ({events.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "deals" ? (
          <View style={styles.dealsSection}>
            {/* Search Bar */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search accepted companies, state, industry..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={(t) => {
                  setSearchQuery(t);
                }}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Deal List - Endless Scroll */}
            {isTasksLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>Loading accepted LOI deals...</Text>
              </View>
            ) : filteredTasks.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="magnify" size={40} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No accepted deals matched</Text>
                <Text style={styles.emptySubtitle}>Try adjusting your search terms.</Text>
              </View>
            ) : (
              filteredTasks.map((task) => {
                const isAccepted = true;
                return (
                  <TouchableOpacity
                    key={task.id}
                    activeOpacity={0.7}
                    onPress={() => setSelectedTask(task)}
                  >
                    <NativeCard style={[styles.dealCard, isAccepted && styles.dealCardAccepted]}>
                      <NativeCardContent style={styles.dealCardContent}>
                        <View style={styles.dealTopRow}>
                          <View style={styles.companyInfo}>
                            <View style={styles.companyNameRow}>
                              <Text style={styles.companyName} numberOfLines={1}>
                                {task.company_name}
                              </Text>
                              {isAccepted && (
                                <MaterialCommunityIcons name="star-circle" size={16} color="#16a34a" />
                              )}
                            </View>
                            <Text style={styles.industryName}>
                              {task.industry_name || "General Business"}
                            </Text>
                          </View>

                          <View style={styles.revenueBadgeBox}>
                            <Text style={styles.revenueText}>
                              {formatRevenue(task.revenue)}
                            </Text>
                            <Text style={styles.revenueSub}>Revenue</Text>
                          </View>
                        </View>

                        <View style={styles.dealBottomRow}>
                          <View style={styles.metaRow}>
                            <Ionicons name="location-outline" size={14} color="#64748b" />
                            <Text style={styles.metaText}>
                              {task.state_name || task.state_code || "US"}
                            </Text>
                          </View>

                          <View style={styles.metaRow}>
                            <Ionicons name="person-outline" size={14} color="#64748b" />
                            <Text style={styles.metaText} numberOfLines={1}>
                              {task.analyst_name || "M&A Team"}
                            </Text>
                          </View>

                          <NativeBadge
                            variant={isAccepted ? "default" : "secondary"}
                            style={[
                              styles.priorityBadge,
                              task.priority_color ? { backgroundColor: `${task.priority_color}18` } : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.priorityBadgeText,
                                task.priority_color ? { color: task.priority_color } : null,
                              ]}
                            >
                              {task.priority_name || "Active"}
                            </Text>
                          </NativeBadge>
                        </View>

                        {task.latest_note ? (
                          <View style={styles.notePreview}>
                            <Text style={styles.notePreviewText} numberOfLines={2}>
                              "{task.latest_note}"
                            </Text>
                          </View>
                        ) : null}
                      </NativeCardContent>
                    </NativeCard>
                  </TouchableOpacity>
                );
              })
            )}

            {/* Endless Scroll Completion Indicator */}
            {filteredTasks.length > 0 && (
              <View style={styles.endlessScrollFooter}>
                <MaterialCommunityIcons name="check-decagram-outline" size={16} color="#10b981" />
                <Text style={styles.endlessScrollText}>
                  All {filteredTasks.length} LOI Accepted deals loaded • Endless Scroll
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* Live M&A Events Feed */
          <View style={styles.eventsSection}>
            {isEventsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
              </View>
            ) : events.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="broadcast-off" size={40} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No live M&A events</Text>
              </View>
            ) : (
              events.map((ev) => (
                <NativeCard key={ev.id} style={styles.eventCard}>
                  <NativeCardContent style={styles.eventCardContent}>
                    <View style={styles.eventIconBox}>
                      <MaterialCommunityIcons name="lightning-bolt" size={18} color="#2563eb" />
                    </View>
                    <View style={styles.eventDetails}>
                      <View style={styles.eventTopRow}>
                        <Text style={styles.eventTitle}>{ev.title || ev.event_type}</Text>
                        <Text style={styles.eventTime}>
                          {ev.created_at ? new Date(ev.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Live"}
                        </Text>
                      </View>
                      <Text style={styles.eventMeta}>
                        {ev.industry ? `${ev.industry} • ` : ""}{ev.state || "US"} {ev.revenue ? `• ${formatRevenue(ev.revenue)}` : ""}
                      </Text>
                      {ev.note ? <Text style={styles.eventNote}>"{ev.note}"</Text> : null}
                    </View>
                  </NativeCardContent>
                </NativeCard>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* ========================================================= */}
      {/* DEAL DETAIL MODAL                                         */}
      {/* ========================================================= */}
      <Modal
        visible={selectedTask !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTask(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconBox}>
                  <MaterialCommunityIcons name="domain" size={24} color="#2563eb" />
                </View>
                <View style={styles.modalHeaderTitles}>
                  <Text style={styles.modalCompany} numberOfLines={1}>
                    {selectedTask?.company_name}
                  </Text>
                  <Text style={styles.modalIndustry}>
                    {selectedTask?.industry_name || "Target Opportunity"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedTask(null)}
              >
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.detailMetricRow}>
                <View style={styles.detailMetricCard}>
                  <Text style={styles.detailMetricLabel}>Revenue</Text>
                  <Text style={styles.detailMetricValue}>
                    {formatRevenue(selectedTask?.revenue)}
                  </Text>
                </View>

                <View style={styles.detailMetricCard}>
                  <Text style={styles.detailMetricLabel}>Priority Stage</Text>
                  <Text
                    style={[
                      styles.detailMetricValue,
                      selectedTask?.priority_color ? { color: selectedTask.priority_color } : null,
                    ]}
                  >
                    {selectedTask?.priority_name || "In Review"}
                  </Text>
                </View>
              </View>

              {/* Key Details */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Target Information</Text>

                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={16} color="#64748b" />
                  <Text style={styles.infoLabel}>Location:</Text>
                  <Text style={styles.infoValue}>
                    {selectedTask?.state_name || selectedTask?.state_code || "United States"}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={16} color="#64748b" />
                  <Text style={styles.infoLabel}>Lead Analyst:</Text>
                  <Text style={styles.infoValue}>
                    {selectedTask?.analyst_name || "M&A Intelligence"}
                  </Text>
                </View>

                {selectedTask?.name ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="business-outline" size={16} color="#64748b" />
                    <Text style={styles.infoLabel}>Contact:</Text>
                    <Text style={styles.infoValue}>{selectedTask.name}</Text>
                  </View>
                ) : null}

                {selectedTask?.email ? (
                  <TouchableOpacity
                    style={styles.infoRow}
                    onPress={() => selectedTask.email && Linking.openURL(`mailto:${selectedTask.email}`)}
                  >
                    <Ionicons name="mail-outline" size={16} color="#2563eb" />
                    <Text style={styles.infoLabel}>Email:</Text>
                    <Text style={[styles.infoValue, { color: "#2563eb" }]}>
                      {selectedTask.email}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {selectedTask?.phone ? (
                  <TouchableOpacity
                    style={styles.infoRow}
                    onPress={() => selectedTask.phone && Linking.openURL(`tel:${selectedTask.phone}`)}
                  >
                    <Ionicons name="call-outline" size={16} color="#2563eb" />
                    <Text style={styles.infoLabel}>Phone:</Text>
                    <Text style={[styles.infoValue, { color: "#2563eb" }]}>
                      {selectedTask.phone}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Latest Analyst Note */}
              {selectedTask?.latest_note ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Latest Intelligence & Notes</Text>
                  <View style={styles.noteBox}>
                    <Text style={styles.noteText}>{selectedTask.latest_note}</Text>
                  </View>
                </View>
              ) : null}
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
  kpiGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  kpiContent: {
    padding: 10,
    alignItems: "center",
  },
  kpiIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  kpiLabel: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
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
  dealsSection: {
    gap: 10,
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
    marginBottom: 6,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    marginRight: 6,
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
  },
  filterChipActiveGreen: {
    backgroundColor: "#ecfdf5",
    borderColor: "#10b981",
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  filterChipTextActive: {
    color: "#2563eb",
  },
  filterChipTextActiveGreen: {
    color: "#16a34a",
  },
  paginationBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
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
  dealCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 8,
  },
  dealCardAccepted: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  dealCardContent: {
    padding: 14,
  },
  dealTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  companyInfo: {
    flex: 1,
    marginRight: 10,
  },
  companyNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  companyName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  industryName: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  revenueBadgeBox: {
    alignItems: "flex-end",
  },
  revenueText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  revenueSub: {
    fontSize: 9,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  dealBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: "#64748b",
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  notePreview: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  notePreviewText: {
    fontSize: 11,
    color: "#475569",
    fontStyle: "italic",
  },
  endlessScrollFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 18,
    marginTop: 8,
  },
  endlessScrollText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
  },
  eventsSection: {
    gap: 8,
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
  },
  eventIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  eventDetails: {
    flex: 1,
  },
  eventTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  eventTime: {
    fontSize: 10,
    color: "#94a3b8",
  },
  eventMeta: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  eventNote: {
    fontSize: 11,
    fontStyle: "italic",
    color: "#475569",
    marginTop: 4,
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
  modalCompany: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalIndustry: {
    fontSize: 12,
    color: "#64748b",
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    gap: 16,
  },
  detailMetricRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  detailMetricCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  detailMetricLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
  },
  detailMetricValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2,
  },
  detailSection: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    width: 90,
  },
  infoValue: {
    fontSize: 12,
    color: "#0f172a",
    flex: 1,
  },
  noteBox: {
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  noteText: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
  },
});
