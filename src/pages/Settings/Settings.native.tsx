import { useState, useEffect } from "react";
import { View, Text, ScrollView, Switch, RefreshControl, ActivityIndicator, StyleSheet } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { apiClient } from "@/services/apiClient";
import { useAuth, type Role } from "@/lib/AuthContext";
import { appStorage } from "@/lib/storage";
import MobileShell from "@/components/AppShell/MobileShell.native";

interface PortalStatus {
  name: string;
  code: string;
  port: number;
  domain: string;
  status: "online" | "degraded" | "offline";
  status_code?: number;
  latency_ms: number;
}

function ExecutiveProfileCard({ fullName, email, roles }: { fullName?: string; email?: string; roles: Role[] }) {
  const roleLabel = Array.isArray(roles) && roles.length > 0
    ? roles.map((r) => (typeof r === "string" ? r : r.name)).join(", ")
    : "Executive";

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="account-circle-outline" size={18} color="#2563eb" />
        <Text style={styles.cardTitle}>Executive Profile</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Name</Text>
        <Text style={styles.rowValue}>{fullName || "Chief Executive Officer"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Email</Text>
        <Text style={styles.rowValue}>{email || "—"}</Text>
      </View>
      <View style={[styles.row, { borderBottomWidth: 0 }]}>
        <Text style={styles.rowLabel}>Roles</Text>
        <Text style={styles.rowValue}>{roleLabel}</Text>
      </View>
    </View>
  );
}

function NotificationsCard({ inAppAlerts, onToggle }: { inAppAlerts: boolean; onToggle: (next: boolean) => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="bell-outline" size={18} color="#2563eb" />
        <Text style={styles.cardTitle}>Notifications</Text>
      </View>
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchTitle}>In-App Executive Alerts</Text>
          <Text style={styles.switchSub}>Show real-time status and approval notifications</Text>
        </View>
        <Switch
          value={inAppAlerts}
          onValueChange={onToggle}
          trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
          thumbColor={inAppAlerts ? "#2563eb" : "#f8fafc"}
        />
      </View>
    </View>
  );
}

function ConnectedPortalsCard({ portals, isLoading }: { portals: PortalStatus[]; isLoading: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="server-network" size={18} color="#2563eb" />
        <Text style={styles.cardTitle}>Connected Services Matrix</Text>
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ paddingVertical: 20 }} color="#2563eb" />
      ) : portals.length === 0 ? (
        <Text style={styles.emptyText}>No connected portals reported.</Text>
      ) : (
        portals.map((p, idx) => {
          const dotColor = p.status === "online" ? "#10b981" : p.status === "degraded" ? "#f59e0b" : "#ef4444";
          return (
            <View
              key={p.code || idx}
              style={[styles.portalRow, idx === portals.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.portalName}>{p.name}</Text>
                <Text style={styles.portalMeta}>{p.domain || p.code}</Text>
              </View>
              <View style={styles.portalRight}>
                <Text style={[styles.portalStatus, { color: dotColor }]}>{p.status.toUpperCase()}</Text>
                <Text style={styles.portalLatency}>{p.latency_ms} ms</Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

export default function Settings() {
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const [inAppAlerts, setInAppAlerts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const val = appStorage.getItem("inAppAlerts");
    if (val === "false") setInAppAlerts(false);
  }, []);

  const { data: portals = [], isLoading, refetch: refetchPortals } = useQuery<PortalStatus[]>({
    queryKey: ["portalsStatus"],
    queryFn: () => apiClient.get<PortalStatus[]>("/api/v1/ceo/portals-status"),
    retry: false,
  });

  const toggleInAppAlerts = (next: boolean) => {
    setInAppAlerts(next);
    appStorage.setItem("inAppAlerts", String(next));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchPortals(),
      queryClient.invalidateQueries({ queryKey: ["message-hub-live-status"] }),
    ]);
    setRefreshing(false);
  };

  return (
    <MobileShell title="Settings" subtitle="Integrations & Preferences" onRefresh={onRefresh} isRefreshing={refreshing}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} />}
      >
        <ExecutiveProfileCard fullName={user?.full_name} email={user?.email} roles={roles} />
        <NotificationsCard inAppAlerts={inAppAlerts} onToggle={toggleInAppAlerts} />
        <ConnectedPortalsCard portals={portals} isLoading={isLoading} />
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 32, gap: 14 },
  card: { backgroundColor: "#ffffff", borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", padding: 16 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  rowLabel: { fontSize: 13, color: "#64748b" },
  rowValue: { fontSize: 13, fontWeight: "600", color: "#0f172a", flexShrink: 1, textAlign: "right" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchTitle: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  switchSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  emptyText: { fontSize: 13, color: "#94a3b8", paddingVertical: 12 },
  portalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  portalName: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  portalMeta: { fontSize: 11, color: "#64748b", marginTop: 1 },
  portalRight: { alignItems: "flex-end" },
  portalStatus: { fontSize: 11, fontWeight: "700" },
  portalLatency: { fontSize: 11, color: "#94a3b8", marginTop: 1 },
});
