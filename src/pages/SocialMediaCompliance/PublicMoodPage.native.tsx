import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, NativeCard, NativeCardContent, ActivityIndicator } from "@/components/native";
import { useCompliancePublicMood } from "@/hooks/useSocialCompliance";

export default function PublicMoodPageNative() {
  const { data: response, isLoading } = useCompliancePublicMood();
  const overview = response?.data;
  const tracks = overview ? [overview.financial_zenatech, overview.today_posts] : [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Public Mood</Text>
        <Text style={styles.subtitle}>Live sentiment from Social Media Compliance</Text>

        {isLoading ? (
          <ActivityIndicator size="large" color="#2563eb" />
        ) : (
          tracks.map((track) => (
            <NativeCard key={track.key} style={styles.card}>
              <NativeCardContent>
                <Text style={styles.trackTitle}>{track.title}</Text>
                <Text style={styles.trackSub}>{track.subtitle}</Text>
                {track.trends.length === 0 ? (
                  <Text style={styles.empty}>{track.empty_reason || "No public mood topics yet."}</Text>
                ) : (
                  track.trends.map((trend) => (
                    <View key={trend.external_id} style={styles.trend}>
                      <Text style={styles.trendName}>{trend.name} ({trend.recommendation})</Text>
                      <Text style={styles.trendMeta}>
                        Net {trend.net_sentiment} · {trend.positive_pct}% pos · {trend.negative_pct}% neg · {trend.volume} mentions
                      </Text>
                    </View>
                  ))
                )}
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
  card: { marginBottom: 4 },
  trackTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  trackSub: { fontSize: 12, color: "#64748b", marginBottom: 8 },
  empty: { fontSize: 12, color: "#94a3b8" },
  trend: { borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 8, marginTop: 8 },
  trendName: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  trendMeta: { fontSize: 11, color: "#64748b", marginTop: 2 },
});
