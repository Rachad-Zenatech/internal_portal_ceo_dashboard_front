import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useRevenueExpenseChart,
  useBankBalancesChart,
  useAccountDistribution,
  useRecentTransactions,
} from "@/hooks/useDashboard";
import type {
  RevenueExpensePoint,
  BankBalancePoint,
  AccountDistributionPoint,
  RecentTransaction,
} from "@/types/dashboard";
import { formatMoney, formatCompactMoney } from "./NativeSystemsStrip.native";

export {
  formatMoney,
  formatCompactMoney,
  NativeSystemsStrip,
  type SystemServerItem,
} from "./NativeSystemsStrip.native";

const DIST_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

export function NativeRevenueExpenseCard({ period }: { period: "monthly" | "quarterly" | "yearly" }) {
  const { data = [], isLoading } = useRevenueExpenseChart(period);
  const rows: RevenueExpensePoint[] = Array.isArray(data) ? data : [];

  const maxVal = rows.reduce(
    (max, item) => Math.max(max, Number(item.revenue) || 0, Number(item.expenses) || 0),
    1
  );
  const totalRevenue = rows.reduce((acc, r) => acc + (Number(r.revenue) || 0), 0);
  const totalExpenses = rows.reduce((acc, r) => acc + (Number(r.expenses) || 0), 0);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>Revenue vs Expense</Text>
          <Text style={styles.cardSub}>Summary ({period})</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#2563eb" }]} />
            <Text style={styles.legendLabel}>Rev</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#f43f5e" }]} />
            <Text style={styles.legendLabel}>Exp</Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#2563eb" />
      ) : rows.length === 0 ? (
        <Text style={styles.emptyText}>No revenue & expense records for this period.</Text>
      ) : (
        <View style={styles.listGap}>
          <View style={styles.totalsBar}>
            <View style={styles.totalCell}>
              <Text style={styles.totalLabel}>Revenue</Text>
              <Text style={[styles.totalValue, { color: "#2563eb" }]}>{formatMoney(totalRevenue)}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalCell}>
              <Text style={styles.totalLabel}>Expenses</Text>
              <Text style={[styles.totalValue, { color: "#e11d48" }]}>{formatMoney(totalExpenses)}</Text>
            </View>
          </View>

          {rows.slice(-4).map((item, idx) => {
            const revPct = Math.max(4, Math.round(((Number(item.revenue) || 0) / maxVal) * 100));
            const expPct = Math.max(4, Math.round(((Number(item.expenses) || 0) / maxVal) * 100));
            return (
              <View key={`${item.month}-${idx}`} style={styles.barGroup}>
                <View style={styles.barLabelRow}>
                  <Text style={styles.barMonth}>{item.month || item.date || `Period ${idx + 1}`}</Text>
                  <Text style={styles.barNumbers}>
                    {formatCompactMoney(item.revenue)} · {formatCompactMoney(item.expenses)}
                  </Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${revPct}%`, backgroundColor: "#2563eb" }]} />
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${expPct}%`, backgroundColor: "#f43f5e" }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function NativeBankBalancesCard() {
  const { data = [], isLoading } = useBankBalancesChart();
  const rows: BankBalancePoint[] = Array.isArray(data) ? data : [];
  const maxVal = rows.reduce((max, item) => Math.max(max, Number(item.ending) || 0), 1);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>Bank Balances</Text>
          <Text style={styles.cardSub}>Current ending cash</Text>
        </View>
        <MaterialCommunityIcons name="bank-outline" size={18} color="#10b981" />
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#2563eb" />
      ) : rows.length === 0 ? (
        <Text style={styles.emptyText}>No bank balance records available.</Text>
      ) : (
        <View style={styles.listGap}>
          {rows.map((item, idx) => {
            const ending = Number(item.ending) || 0;
            const pct = Math.max(4, Math.round((Math.max(0, ending) / maxVal) * 100));
            return (
              <View key={`${item.account}-${idx}`} style={styles.bankRow}>
                <View style={styles.barLabelRow}>
                  <Text style={styles.bankName} numberOfLines={1}>
                    {item.account}
                  </Text>
                  <Text style={styles.bankBalance}>{formatMoney(ending)}</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${pct}%`, backgroundColor: "#10b981" }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function NativeAccountDistributionCard() {
  const { data = [], isLoading } = useAccountDistribution();
  const rows: AccountDistributionPoint[] = Array.isArray(data) ? data : [];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>Account Distribution</Text>
          <Text style={styles.cardSub}>Balance sheet mix</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#2563eb" />
      ) : rows.length === 0 ? (
        <Text style={styles.emptyText}>No account distribution data.</Text>
      ) : (
        <View style={styles.listGap}>
          {rows.map((item, idx) => {
            const color = DIST_COLORS[idx % DIST_COLORS.length];
            const pctValue = Math.min(100, Math.max(2, parseFloat(String(item.percentage || "0")) || 0));
            return (
              <View key={`${item.name}-${idx}`} style={styles.distRow}>
                <View style={styles.barLabelRow}>
                  <View style={styles.distNameRow}>
                    <View style={[styles.legendDot, { backgroundColor: color }]} />
                    <Text style={styles.distName}>{item.name}</Text>
                  </View>
                  <Text style={styles.distAmount}>
                    {formatMoney(item.value)} · {item.percentage}%
                  </Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${pctValue}%`, backgroundColor: color }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function NativeRecentTransactionsCard() {
  const [showAll, setShowAll] = useState(false);
  const { data = [], isLoading } = useRecentTransactions();
  const rows: RecentTransaction[] = Array.isArray(data) ? data : [];
  const visibleRows = showAll ? rows.slice(0, 15) : rows.slice(0, 5);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>Recent Transactions</Text>
          <Text style={styles.cardSub}>Latest general ledger entries</Text>
        </View>
        {rows.length > 5 && (
          <TouchableOpacity onPress={() => setShowAll((prev) => !prev)}>
            <Text style={styles.toggleLink}>
              {showAll ? "Show less" : `View all (${rows.length})`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#2563eb" />
      ) : rows.length === 0 ? (
        <Text style={styles.emptyText}>No recent transactions recorded.</Text>
      ) : (
        <View style={styles.txList}>
          {visibleRows.map((tx, idx) => {
            const amt = Number(tx.amount) || 0;
            const isPositive = amt >= 0;
            return (
              <View
                key={`${tx.id}-${idx}`}
                style={[styles.txRow, idx === visibleRows.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={styles.txInfo}>
                  <Text style={styles.txDesc} numberOfLines={1}>
                    {tx.description || "Transaction"}
                  </Text>
                  <Text style={styles.txDate}>{tx.date || "—"}</Text>
                </View>
                <Text style={[styles.txAmount, { color: isPositive ? "#059669" : "#e11d48" }]}>
                  {isPositive ? "+" : "-"}
                  {formatMoney(Math.abs(amt))}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  toggleLink: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563eb",
  },
  legendRow: {
    flexDirection: "row",
    gap: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  loader: {
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 13,
    color: "#94a3b8",
    paddingVertical: 8,
  },
  listGap: {
    gap: 12,
  },
  totalsBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  totalCell: {
    flex: 1,
  },
  totalDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 12,
  },
  totalLabel: {
    fontSize: 11,
    color: "#64748b",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  barGroup: {
    gap: 4,
  },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  barMonth: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  barNumbers: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  track: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
  bankRow: {
    gap: 6,
  },
  bankName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  bankBalance: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  distRow: {
    gap: 6,
  },
  distNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  distName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  distAmount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  txList: {
    gap: 2,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  txInfo: {
    flex: 1,
    minWidth: 0,
  },
  txDesc: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  txDate: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: "700",
  },
});
