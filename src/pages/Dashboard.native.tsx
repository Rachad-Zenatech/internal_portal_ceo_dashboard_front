import { useQuery } from "@tanstack/react-query";
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
  NativeCardTitle,
  NativeCardDescription,
  NativeCardContent,
  NativeBadge,
} from "@/components/native";
import { Ionicons } from "@expo/vector-icons";

interface LoginActivity {
  id?: string;
  created_at: string;
  user_full_name?: string;
  email: string;
  success: boolean;
  failure_reason?: string;
  ip_address?: string;
}

export default function Dashboard() {
  const { user } = useAuth();

  const { data: loginActivities = [], isLoading: isLoginLoading } = useQuery<LoginActivity[]>({
    queryKey: ["loginActivities"],
    queryFn: () => apiClient.get<LoginActivity[]>("/api/login-activities"),
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Welcome back, {user?.full_name || "Admin"}
        </Text>
        <Text style={styles.headerSubtitle}>
          This is your central CEO dashboard, providing an overview of all portals and connected systems.
        </Text>
      </View>

      <NativeCard style={styles.card}>
        <NativeCardHeader style={styles.cardHeader}>
          <NativeCardTitle style={styles.cardTitle}>CEO Portal Activity</NativeCardTitle>
          <NativeCardDescription style={styles.cardDescription}>
            Recent login activities from the CEO Portal.
          </NativeCardDescription>
        </NativeCardHeader>

        <NativeCardContent style={styles.cardContent}>
          {isLoginLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Loading activities...</Text>
            </View>
          ) : loginActivities.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No recent login activity found.</Text>
            </View>
          ) : (
            <View style={styles.tableContainer}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Date & Time</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Account</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Status</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>IP Address</Text>
              </View>

              {loginActivities.map((item, index) => (
                <View
                  key={item.id || index}
                  style={[
                    styles.tableRow,
                    index === loginActivities.length - 1 && styles.tableRowLast,
                  ]}
                >
                  <View style={[styles.cell, { flex: 2 }]}>
                    <Text style={styles.cellDate}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>

                  <View style={[styles.cell, { flex: 2 }]}>
                    <Text style={styles.cellName}>{item.user_full_name || "Unknown"}</Text>
                    <Text style={styles.cellEmail}>{item.email}</Text>
                  </View>

                  <View style={[styles.cell, { flex: 1.5 }]}>
                    {item.success ? (
                      <NativeBadge variant="success" style={styles.badge}>
                        <View style={styles.badgeRow}>
                          <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
                          <Text style={styles.badgeTextSuccess}>Success</Text>
                        </View>
                      </NativeBadge>
                    ) : (
                      <View style={styles.failedStatusContainer}>
                        <NativeBadge variant="destructive" style={styles.badge}>
                          <View style={styles.badgeRow}>
                            <Ionicons name="close-circle" size={12} color="#dc2626" />
                            <Text style={styles.badgeTextDestructive}>Failed</Text>
                          </View>
                        </NativeBadge>
                        {item.failure_reason ? (
                          <Text style={styles.failureReason} numberOfLines={1}>
                            {item.failure_reason}
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </View>

                  <View style={[styles.cell, { flex: 1.5 }]}>
                    <Text style={styles.cellIp}>{item.ip_address || "N/A"}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </NativeCardContent>
      </NativeCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  contentContainer: {
    padding: 16,
    width: "100%",
  },
  header: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226, 232, 240, 0.8)",
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
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#0f172a",
  },
  cardDescription: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  cardContent: {
    padding: 0,
  },
  loadingContainer: {
    padding: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748b",
  },
  emptyContainer: {
    padding: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
    color: "#94a3b8",
  },
  tableContainer: {
    width: "100%",
  },
  tableHeaderRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: "center",
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  cell: {
    justifyContent: "center",
  },
  cellDate: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "500",
  },
  cellName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  cellEmail: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  cellIp: {
    fontSize: 12,
    fontFamily: "monospace",
    color: "#475569",
  },
  badge: {
    alignSelf: "flex-start",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badgeTextSuccess: {
    fontSize: 11,
    fontWeight: "600",
    color: "#16a34a",
  },
  badgeTextDestructive: {
    fontSize: 11,
    fontWeight: "600",
    color: "#dc2626",
  },
  failedStatusContainer: {
    gap: 2,
  },
  failureReason: {
    fontSize: 10,
    color: "#ef4444",
    maxWidth: 120,
  },
});
