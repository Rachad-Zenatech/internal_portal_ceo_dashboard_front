import { useMemo, useState } from "react";
import { TouchableOpacity } from "react-native";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "@/components/native";
import { useRealEstateProperties } from "@/hooks/useRealEstate";
import { formatArea, formatBathrooms, formatPropertyAddress } from "@/types/realEstate";
import type { Property } from "@/types/realEstate";

export default function RealEstatePage() {
  const { data: response, isLoading, refetch } = useRealEstateProperties();
  const [selected, setSelected] = useState<Property | null>(null);
  const properties = response?.data?.items ?? [];
  const activeCount = useMemo(
    () => properties.filter((p) => p.record_status === "active").length,
    [properties]
  );

  if (selected) {
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn}>
            <Text style={styles.backText}>← All Properties</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{selected.property_name || "Unnamed Property"}</Text>
          <Text style={styles.subtitle}>{formatPropertyAddress(selected)}</Text>
          <View style={styles.card}>
            <Text style={styles.meta}>Status: {selected.record_status}</Text>
            <Text style={styles.meta}>Type: {selected.property_type || "—"}</Text>
            <Text style={styles.meta}>Beds: {selected.bedrooms ?? "—"} · Baths: {formatBathrooms(selected)}</Text>
            <Text style={styles.meta}>Area: {formatArea(selected.unit_area, selected.unit_area_unit)}</Text>
            <Text style={styles.meta}>Management: {selected.building_management || "—"}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Real Estate</Text>
            <Text style={styles.subtitle}>
              {properties.length} properties · {activeCount} active
            </Text>
          </View>
          <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {isLoading && properties.length === 0 ? (
          <Text style={styles.subtitle}>Loading properties…</Text>
        ) : (
          properties.map((p) => (
            <TouchableOpacity key={p.id} style={styles.card} onPress={() => setSelected(p)}>
              <Text style={styles.cardTitle}>{p.property_name || "Unnamed Property"}</Text>
              <Text style={styles.subtitle}>{formatPropertyAddress(p)}</Text>
              <Text style={styles.meta}>
                {p.bedrooms ?? "—"} bed · {formatBathrooms(p)} bath · {formatArea(p.unit_area, p.unit_area_unit)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, gap: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  card: { backgroundColor: "#ffffff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e2e8f0", gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  meta: { fontSize: 12, color: "#475569", marginTop: 4 },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 14, fontWeight: "600", color: "#4f46e5" },
  refreshBtn: { backgroundColor: "#e2e8f0", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  refreshText: { fontSize: 12, fontWeight: "600", color: "#0f172a" },
});
