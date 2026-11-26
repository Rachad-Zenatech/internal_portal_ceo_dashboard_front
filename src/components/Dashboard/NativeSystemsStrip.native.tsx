import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function formatMoney(value: number | undefined | null): string {
  return `$${(Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatCompactMoney(value: number | undefined | null): string {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export interface SystemServerItem {
  id: string;
  name: string;
  status: string;
}

export function NativeSystemsStrip({ servers }: { servers: SystemServerItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const online = servers.filter((s) => s.status === "online").length;
  const allUp = servers.length > 0 && online === servers.length;

  return (
    <TouchableOpacity
      style={styles.stripCard}
      onPress={() => servers.length > 0 && setExpanded((prev) => !prev)}
      activeOpacity={0.75}
    >
      <View style={styles.stripHeader}>
        <View style={styles.cardTitleRow}>
          <View
            style={[
              styles.stripDot,
              { backgroundColor: servers.length === 0 ? "#94a3b8" : allUp ? "#10b981" : "#f59e0b" },
            ]}
          />
          <Text style={styles.stripTitle}>Connected systems</Text>
        </View>
        <View style={styles.stripRight}>
          <Text
            style={[
              styles.stripCount,
              { color: servers.length === 0 ? "#64748b" : allUp ? "#059669" : "#d97706" },
            ]}
          >
            {servers.length > 0 ? `${online}/${servers.length} online` : "Checking..."}
          </Text>
          {servers.length > 0 && (
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={15} color="#64748b" />
          )}
        </View>
      </View>

      {expanded && servers.length > 0 && (
        <View style={styles.pillsWrap}>
          {servers.map((s) => {
            const dotColor = s.status === "online" ? "#10b981" : s.status === "degraded" ? "#f59e0b" : "#f43f5e";
            return (
              <View key={s.id} style={styles.systemPill}>
                <View style={[styles.pillDot, { backgroundColor: dotColor }]} />
                <Text style={styles.pillName}>{s.name}</Text>
                <Text style={styles.pillStatus}>{s.status}</Text>
              </View>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  stripCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  stripHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stripDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stripTitle: { fontSize: 13, fontWeight: "600", color: "#334155" },
  stripRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  stripCount: { fontSize: 12, fontWeight: "700" },
  pillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  systemPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillName: { fontSize: 12, fontWeight: "600", color: "#0f172a" },
  pillStatus: { fontSize: 11, color: "#64748b", textTransform: "capitalize" },
});
