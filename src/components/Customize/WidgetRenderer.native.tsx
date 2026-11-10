import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Circle, G, Path, Rect, Text as SvgText } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import WidgetSkeleton from "@/components/Customize/WidgetSkeleton";
import { useWidgetData } from "@/hooks/useWidgetData";
import { aggregate, formatCompact, formatValue } from "@/lib/aggregate";
import type { ChartPoint } from "@/lib/aggregate";
import type { DataColumn, WidgetConfig } from "@/types/customize";

const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#ec4899", "#14b8a6", "#8b5cf6", "#ef4444"];
const PAGE_SIZE = 50;
const CHART_HEIGHT = 200;

function Message({ children }: { children: React.ReactNode }) {
  return <View style={s.message}><Text style={s.messageText}>{children}</Text></View>;
}

function BarChart({ points, width, fmt }: { points: ChartPoint[]; width: number; fmt: (n: number) => string }) {
  const padX = 8;
  const padTop = 18;
  const padBottom = 28;
  const max = Math.max(...points.map((p) => p.value), 1);
  const slot = (width - padX * 2) / points.length;
  const barW = Math.min(36, slot * 0.6);
  return (
    <Svg width={width} height={CHART_HEIGHT}>
      {points.map((p, i) => {
        const h = (p.value / max) * (CHART_HEIGHT - padTop - padBottom);
        const x = padX + i * slot + (slot - barW) / 2;
        const y = CHART_HEIGHT - padBottom - h;
        return (
          <G key={p.name}>
            <Rect x={x} y={y} width={barW} height={Math.max(h, 1)} rx={5} fill={PALETTE[0]} />
            <SvgText x={x + barW / 2} y={y - 4} fontSize={9} fill="#475569" textAnchor="middle">{fmt(p.value)}</SvgText>
            <SvgText x={x + barW / 2} y={CHART_HEIGHT - 10} fontSize={9} fill="#64748b" textAnchor="middle">{p.name.length > 7 ? `${p.name.slice(0, 6)}…` : p.name}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function LineChart({ points, width, filled }: { points: ChartPoint[]; width: number; filled: boolean }) {
  const pad = 16;
  const max = Math.max(...points.map((p) => p.value), 1);
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const xy = points.map((p, i) => ({ x: pad + i * stepX, y: CHART_HEIGHT - 30 - (p.value / max) * (CHART_HEIGHT - 50) }));
  const line = xy.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x} ${pt.y}`).join(" ");
  const base = CHART_HEIGHT - 30;
  const area = `${line} L${xy[xy.length - 1].x} ${base} L${xy[0].x} ${base} Z`;
  return (
    <Svg width={width} height={CHART_HEIGHT}>
      {filled && <Path d={area} fill={PALETTE[0]} fillOpacity={0.15} />}
      <Path d={line} stroke={PALETTE[0]} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {xy.map((pt, i) => <Circle key={i} cx={pt.x} cy={pt.y} r={3} fill={PALETTE[0]} />)}
      <SvgText x={pad} y={CHART_HEIGHT - 8} fontSize={9} fill="#64748b" textAnchor="start">{points[0].name}</SvgText>
      <SvgText x={width - pad} y={CHART_HEIGHT - 8} fontSize={9} fill="#64748b" textAnchor="end">{points[points.length - 1].name}</SvgText>
    </Svg>
  );
}

function Donut({ points, fmt }: { points: ChartPoint[]; fmt: (n: number) => string }) {
  const total = points.reduce((a, p) => a + p.value, 0) || 1;
  const r = 50;
  const circ = 2 * Math.PI * r;
  const slices = points.map((p, i) => ({
    name: p.name,
    color: PALETTE[i % PALETTE.length],
    len: (p.value / total) * circ,
    offset: points.slice(0, i).reduce((sum, q) => sum + (q.value / total) * circ, 0),
  }));
  return (
    <View style={{ alignItems: "center", gap: 12 }}>
      <Svg width={140} height={140} viewBox="0 0 120 120">
        <G rotation={-90} origin="60, 60">
          {slices.map((sl) => (
            <Circle key={sl.name} cx={60} cy={60} r={r} fill="none" stroke={sl.color} strokeWidth={20} strokeDasharray={`${sl.len} ${circ - sl.len}`} strokeDashoffset={-sl.offset} />
          ))}
        </G>
      </Svg>
      <View style={{ alignSelf: "stretch", gap: 6 }}>
        {points.map((p, i) => (
          <View key={p.name} style={s.legendRow}>
            <View style={[s.dot, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
            <Text style={s.legendName} numberOfLines={1}>{p.name}</Text>
            <Text style={s.legendValue}>{fmt(p.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RankedBars({ points, fmt, numbered }: { points: ChartPoint[]; fmt: (n: number) => string; numbered: boolean }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <View style={{ gap: 12 }}>
      {points.map((p, i) => (
        <View key={p.name} style={{ gap: 4 }}>
          <View style={s.rankHead}>
            <Text style={s.rankName} numberOfLines={1}>{numbered ? `${i + 1}.  ` : ""}{p.name}</Text>
            <Text style={s.rankValue}>{fmt(p.value)}</Text>
          </View>
          <View style={s.track}><View style={[s.fill, { width: `${(p.value / max) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }]} /></View>
        </View>
      ))}
    </View>
  );
}

export default function WidgetRenderer({ widget }: { widget: WidgetConfig }) {
  const { source, rows, columnByKey, dimension, measure, points, isLoading, isError, refetch } = useWidgetData(widget);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [widget.sourceId, widget.columns, widget.filter, rows.length]);

  if (widget.kind === "note") {
    return <Text style={s.note}>{widget.text?.trim() || "Empty note. Edit it to add your text."}</Text>;
  }
  if (!source) return <Message>This data source is no longer available. Edit the widget to pick another.</Message>;
  if (isLoading) return <WidgetSkeleton kind={widget.kind} />;
  if (isError)
    return (
      <View style={s.message}>
        <Text style={s.messageText}>Could not load {source.label}.</Text>
        <TouchableOpacity onPress={() => refetch()} style={s.retry}><Text style={s.retryText}>Try again</Text></TouchableOpacity>
      </View>
    );

  const isMoney = widget.aggregation !== "count" && measure?.type === "currency";
  const fmt = (n: number) => formatCompact(n, isMoney);

  if (widget.kind === "kpi") {
    const value = aggregate(rows, widget.measure, widget.aggregation);
    return (
      <View style={s.pad}>
        <Text style={s.kpiValue}>{fmt(value)}</Text>
        <Text style={s.kpiLabel}>{source.label}</Text>
      </View>
    );
  }

  if (widget.kind === "gauge") {
    const value = aggregate(rows, widget.measure, widget.aggregation);
    const target = widget.target && widget.target > 0 ? widget.target : 100;
    const pct = Math.max(0, Math.min(1, value / target));
    const arc = Math.PI * 80;
    return (
      <View style={[s.pad, { alignItems: "center" }]}>
        <Svg width={220} height={120} viewBox="0 0 200 115">
          <Path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" strokeWidth={16} strokeLinecap="round" />
          <Path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={PALETTE[1]} strokeWidth={16} strokeLinecap="round" strokeDasharray={`${pct * arc} ${arc}`} />
          <SvgText x={100} y={92} fontSize={26} fontWeight="600" fill="#0f172a" textAnchor="middle">{`${Math.round(pct * 100)}%`}</SvgText>
        </Svg>
        <Text style={s.kpiLabel}><Text style={s.strong}>{fmt(value)}</Text> of {fmt(target)} goal</Text>
      </View>
    );
  }

  if (widget.kind === "table") {
    const cols = (widget.columns?.length ? widget.columns : source.columns.slice(0, 5).map((c) => c.key))
      .map((k) => columnByKey.get(k))
      .filter((c): c is DataColumn => Boolean(c));
    if (rows.length === 0) return <Message>Nothing to show yet.</Message>;
    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const current = Math.min(page, pageCount - 1);
    const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
    return (
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={[s.tr, s.thead]}>
              {cols.map((c) => <Text key={c.key} style={[s.th, c.role === "measure" && s.right]}>{c.label}</Text>)}
            </View>
            <ScrollView style={{ maxHeight: 360 }} nestedScrollEnabled>
              {visible.map((row, i) => (
                <View key={i} style={[s.tr, i % 2 === 1 && s.zebra]}>
                  {cols.map((c) => (
                    <Text key={c.key} numberOfLines={1} style={[s.td, c.role === "measure" && s.right]}>{formatValue(row[c.key], c.type)}</Text>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
        {pageCount > 1 && (
          <View style={s.pager}>
            <Text style={s.pagerText}>{current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, rows.length)} of {rows.length}</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity disabled={current === 0} onPress={() => setPage(current - 1)} style={[s.pagerBtn, current === 0 && s.disabled]} accessibilityLabel="Previous page"><Ionicons name="chevron-back" size={18} color="#334155" /></TouchableOpacity>
              <TouchableOpacity disabled={current >= pageCount - 1} onPress={() => setPage(current + 1)} style={[s.pagerBtn, current >= pageCount - 1 && s.disabled]} accessibilityLabel="Next page"><Ionicons name="chevron-forward" size={18} color="#334155" /></TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  if (!dimension) return <Message>Choose what to group by in the panel.</Message>;
  if (points.length === 0) return <Message>Nothing to show yet.</Message>;

  return (
    <View style={s.pad} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 32)}>
      {widget.kind === "ranking" && <RankedBars points={points} fmt={fmt} numbered />}
      {widget.kind === "hbar" && <RankedBars points={points} fmt={fmt} numbered={false} />}
      {widget.kind === "pie" && <Donut points={points} fmt={fmt} />}
      {widget.kind === "bar" && width > 0 && <BarChart points={points} width={width} fmt={fmt} />}
      {(widget.kind === "line" || widget.kind === "area") && width > 0 && <LineChart points={points} width={width} filled={widget.kind === "area"} />}
    </View>
  );
}

const s = StyleSheet.create({
  pad: { padding: 16 },
  message: { padding: 20, alignItems: "center", justifyContent: "center", minHeight: 90, gap: 8 },
  messageText: { fontSize: 12, color: "#64748b", textAlign: "center" },
  retry: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1" },
  retryText: { fontSize: 12, color: "#334155", fontWeight: "600" },
  note: { padding: 16, fontSize: 14, lineHeight: 20, color: "#0f172a" },
  kpiValue: { fontSize: 32, fontWeight: "700", color: "#0f172a" },
  kpiLabel: { marginTop: 4, fontSize: 12, color: "#64748b" },
  strong: { fontWeight: "700", color: "#0f172a" },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, fontSize: 13, color: "#0f172a" },
  legendValue: { fontSize: 13, color: "#475569", fontVariant: ["tabular-nums"] },
  rankHead: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rankName: { flex: 1, fontSize: 14, color: "#0f172a" },
  rankValue: { fontSize: 13, color: "#334155", fontVariant: ["tabular-nums"] },
  track: { height: 6, borderRadius: 3, backgroundColor: "#e2e8f0", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  tr: { flexDirection: "row" },
  thead: { backgroundColor: "#f1f5f9" },
  zebra: { backgroundColor: "#f8fafc" },
  th: { width: 130, paddingHorizontal: 10, paddingVertical: 9, fontSize: 11, fontWeight: "600", color: "#64748b" },
  td: { width: 130, paddingHorizontal: 10, paddingVertical: 10, fontSize: 12, color: "#0f172a" },
  right: { textAlign: "right" },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  pagerText: { fontSize: 12, color: "#64748b" },
  pagerBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.4 },
});
