import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView, NativeCard, NativeCardContent, ActivityIndicator } from "@/components/native";
import { apiClient } from "@/services/apiClient";
import { formatMoney } from "@/components/Dashboard/KpiCard";

interface SummaryData {
  assets: number;
  liabilities: number;
  equity: number;
  netIncome: number;
}

export default function FinancePageNative() {
  const { data: summary, isLoading } = useQuery<SummaryData>({
    queryKey: ["summaryMetrics"],
    queryFn: () => apiClient.get<SummaryData>("/api/dashboard/summary"),
  });

  const rows = [
    { label: "Liquid Assets", value: formatMoney(summary?.assets) },
    { label: "Net Income", value: formatMoney(summary?.netIncome) },
    { label: "Liabilities", value: formatMoney(summary?.liabilities) },
    { label: "Equity", value: formatMoney(summary?.equity) },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Finance Overview</Text>
        <Text style={styles.subtitle}>Treasury balances and ledger performance</Text>
        {isLoading ? (
          <ActivityIndicator size="large" color="#2563eb" />
        ) : (
          <View style={styles.grid}>
            {rows.map((r) => (
              <NativeCard key={r.label} style={styles.card}>
                <NativeCardContent>
                  <Text style={styles.label}>{r.label}</Text>
                  <Text style={styles.value}>{r.value}</Text>
                </NativeCardContent>
              </NativeCard>
            ))}
          </View>
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
  grid: { gap: 10 },
  card: { marginBottom: 2 },
  label: { fontSize: 12, color: "#64748b" },
  value: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginTop: 4 },
});
