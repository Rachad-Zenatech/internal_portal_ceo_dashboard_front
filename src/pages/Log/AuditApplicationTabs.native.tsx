import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { AuditApplicationTab } from "./auditLogSources";

interface AuditApplicationTabsProps {
  tabs: AuditApplicationTab[];
  selectedApp: string;
  onSelect: (appKey: string) => void;
}

export function AuditApplicationTabs({ tabs, selectedApp, onSelect }: AuditApplicationTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {tabs.map((tab) => {
        const isActive = selectedApp === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onSelect(tab.key)}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            <View style={[styles.countBadge, isActive && styles.countBadgeActive]}>
              <Text style={[styles.countText, isActive && styles.countTextActive]}>{tab.count}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginBottom: 10 },
  content: { gap: 8, paddingVertical: 2 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tabActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  labelActive: {
    color: "#ffffff",
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  countBadgeActive: {
    backgroundColor: "#334155",
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  countTextActive: {
    color: "#ffffff",
  },
});
