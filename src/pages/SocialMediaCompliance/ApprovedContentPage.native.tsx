import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, NativeCard, NativeCardContent, NativeBadge, ActivityIndicator } from "@/components/native";
import { useApprovedComplianceContent } from "@/hooks/useSocialCompliance";

const BATCH_SIZE = 50;
const DEFAULT_BRAND_CODE = "CEO_THOUGHT_LEADERSHIP";

export default function ApprovedContentPageNative() {
  const [selectedBrand, setSelectedBrand] = useState(DEFAULT_BRAND_CODE);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const { data: response, isLoading } = useApprovedComplianceContent();

  const items = response?.data?.items ?? [];
  const brands = response?.data?.brands ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedBrand !== "ALL") {
        const codes = item.brand_codes.length > 0 ? item.brand_codes : item.brand_code ? [item.brand_code] : [];
        if (!codes.some((c) => c.toUpperCase() === selectedBrand.toUpperCase())) return false;
      }
      if (!q) return true;
      return item.title.toLowerCase().includes(q) || item.brand_name.toLowerCase().includes(q) || item.reference_code.toLowerCase().includes(q);
    });
  }, [items, selectedBrand, search]);

  useEffect(() => {
    if (brands.length === 0 || selectedBrand === "ALL") return;
    if (brands.some((b) => b.code.toUpperCase() === selectedBrand.toUpperCase())) return;
    const fallback = brands.find((b) => b.name.toLowerCase().includes("thought leadership"));
    setSelectedBrand(fallback ? fallback.code : "ALL");
  }, [brands, selectedBrand]);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [selectedBrand, search]);

  const visibleItems = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleScroll = (e: any) => {
    if (!hasMore) return;
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 120) {
      setVisibleCount((c) => c + BATCH_SIZE);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body} onScroll={handleScroll} scrollEventThrottle={200}>
        <Text style={styles.title}>Social Media Compliance</Text>
        <Text style={styles.subtitle}>Approved content and posts across connected brands</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <TouchableOpacity style={[styles.chip, selectedBrand === "ALL" && styles.chipActive]} onPress={() => setSelectedBrand("ALL")}>
            <Text style={[styles.chipText, selectedBrand === "ALL" && styles.chipTextActive]}>All ({items.length})</Text>
          </TouchableOpacity>
          {brands.map((b) => (
            <TouchableOpacity key={b.code} style={[styles.chip, selectedBrand === b.code && styles.chipActive]} onPress={() => setSelectedBrand(b.code)}>
              <Text style={[styles.chipText, selectedBrand === b.code && styles.chipTextActive]}>{b.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TextInput
          style={styles.search}
          placeholder="Search approved posts..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />

        {isLoading ? (
          <ActivityIndicator size="large" color="#2563eb" />
        ) : visibleItems.length === 0 ? (
          <Text style={styles.empty}>No approved content found.</Text>
        ) : (
          visibleItems.map((item) => (
            <NativeCard key={item.id} style={styles.card}>
              <NativeCardContent>
                <View style={styles.row}>
                  <Text style={styles.ref}>{item.reference_code}</Text>
                  <NativeBadge variant="outline"><Text style={styles.badgeText}>{item.brand_name}</Text></NativeBadge>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.meta}>{item.content_type} · {item.created_by_name}</Text>
              </NativeCardContent>
            </NativeCard>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  body: { padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  subtitle: { fontSize: 13, color: "#64748b" },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: "#e2e8f0" },
  chipActive: { backgroundColor: "#0f172a" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#334155" },
  chipTextActive: { color: "#ffffff" },
  search: { backgroundColor: "#ffffff", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  empty: { textAlign: "center", color: "#64748b", paddingVertical: 24 },
  card: { marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  ref: { fontSize: 12, fontWeight: "700", color: "#4f46e5" },
  badgeText: { fontSize: 11, color: "#334155" },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  meta: { fontSize: 12, color: "#64748b", marginTop: 4 },
});
