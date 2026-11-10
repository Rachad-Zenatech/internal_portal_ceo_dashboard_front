import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import WidgetSkeleton from "@/components/Customize/WidgetSkeleton";
import { useWidgetData } from "@/hooks/useWidgetData";
import { aggregate, formatCompact, formatValue } from "@/lib/aggregate";
import type { DataColumn, WidgetConfig } from "@/types/customize";

const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#ec4899", "#14b8a6", "#8b5cf6", "#ef4444"];
const DEFAULT_PAGE_SIZE = 50;

function Message({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-24 items-center justify-center p-4 text-center text-xs text-muted-foreground">{children}</div>;
}

export default function WidgetRenderer({ widget }: { widget: WidgetConfig }) {
  const { source, rows, columnByKey, dimension, measure, points, isLoading, isError, refetch } = useWidgetData(widget);

  const [page, setPage] = useState(0);
  const pageSize = widget.limit && widget.kind === "table" ? widget.limit : DEFAULT_PAGE_SIZE;
  useEffect(() => setPage(0), [widget.sourceId, widget.columns, widget.filter, rows.length]);

  if (widget.kind === "note") {
    return <p className="h-full overflow-auto whitespace-pre-wrap p-4 text-sm text-foreground">{widget.text?.trim() || "Empty note. Edit it to add your text."}</p>;
  }
  if (!source) return <Message>This data source is no longer available. Edit the widget to pick another.</Message>;
  if (isLoading) return <WidgetSkeleton kind={widget.kind} />;
  if (isError)
    return (
      <Message>
        <span>
          Could not load {source.label}.{" "}
          <button type="button" className="cursor-pointer underline" onClick={() => refetch()}>Try again</button>
        </span>
      </Message>
    );

  const isMoney = widget.aggregation !== "count" && measure?.type === "currency";
  const valueLabel = widget.aggregation === "count" ? "Records" : `${measure?.label ?? widget.measure}`;
  const axisFmt = (v: number) => formatCompact(v, isMoney);

  if (widget.kind === "kpi") {
    const value = aggregate(rows, widget.measure, widget.aggregation);
    return (
      <div className="flex h-full flex-col justify-center p-4">
        <div className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{formatCompact(value, isMoney)}</div>
        <div className="mt-1 text-xs text-muted-foreground">{source.label}</div>
      </div>
    );
  }

  if (widget.kind === "gauge") {
    const value = aggregate(rows, widget.measure, widget.aggregation);
    const target = widget.target && widget.target > 0 ? widget.target : 100;
    const pct = Math.max(0, Math.min(1, value / target));
    return (
      <div className="flex h-full flex-col items-center justify-center p-3">
        <svg viewBox="0 0 200 115" className="w-full max-w-[220px]" role="img" aria-label={`${Math.round(pct * 100)}% of goal`}>
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" strokeWidth="16" strokeLinecap="round" className="stroke-muted" pathLength="100" />
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" strokeWidth="16" strokeLinecap="round" stroke={PALETTE[1]} pathLength="100" strokeDasharray={`${pct * 100} 100`} />
          <text x="100" y="88" textAnchor="middle" className="fill-foreground text-[26px] font-semibold">{Math.round(pct * 100)}%</text>
        </svg>
        <div className="text-center text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{formatCompact(value, isMoney)}</span> of {formatCompact(target, isMoney)} goal
        </div>
      </div>
    );
  }

  if (widget.kind === "table") {
    const cols = (widget.columns?.length ? widget.columns : source.columns.slice(0, 5).map((c) => c.key))
      .map((k) => columnByKey.get(k))
      .filter((c): c is DataColumn => Boolean(c));
    if (rows.length === 0) return <Message>Nothing to show yet.</Message>;
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    const current = Math.min(page, pageCount - 1);
    const visible = rows.slice(current * pageSize, (current + 1) * pageSize);
    return (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr>
                {cols.map((c) => (
                  <th key={c.key} className={`whitespace-nowrap px-3 py-2 font-medium text-muted-foreground ${c.role === "measure" ? "text-right" : "text-left"}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((row, i) => (
                <tr key={i} className="hover:bg-muted/40">
                  {cols.map((c) => (
                    <td key={c.key} className={`max-w-[16rem] truncate whitespace-nowrap px-3 py-2 ${c.role === "measure" ? "text-right font-mono tabular-nums" : ""}`}>
                      {formatValue(row[c.key], c.type)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
            <span>{current * pageSize + 1}–{Math.min((current + 1) * pageSize, rows.length)} of {rows.length}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Grouped displays
  if (!dimension) return <Message>Choose what to group by in the side panel.</Message>;
  if (points.length === 0) return <Message>Nothing to show yet.</Message>;
  const tip = { contentStyle: { borderRadius: 12, fontSize: 12 }, formatter: (v: unknown) => [axisFmt(Number(v)), valueLabel] as [string, string] };

  if (widget.kind === "ranking") {
    const max = Math.max(...points.map((p) => p.value), 1);
    return (
      <ol className="h-full space-y-2.5 overflow-auto p-4">
        {points.map((p, i) => (
          <li key={p.name} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="truncate text-foreground">{p.name}</span>
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-foreground">{axisFmt(p.value)}</span>
            </div>
            <div className="ml-7 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${(p.value / max) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="h-full min-h-40 p-2">
      <ResponsiveContainer width="100%" height="100%">
        {widget.kind === "pie" ? (
          <PieChart>
            <Pie data={points} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="80%" paddingAngle={2}>
              {points.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip {...tip} />
          </PieChart>
        ) : widget.kind === "line" ? (
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={axisFmt} />
            <Tooltip {...tip} />
            <Line type="monotone" dataKey="value" stroke={PALETTE[0]} strokeWidth={2} dot={false} />
          </LineChart>
        ) : widget.kind === "area" ? (
          <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={axisFmt} />
            <Tooltip {...tip} />
            <Area type="monotone" dataKey="value" stroke={PALETTE[0]} fill={PALETTE[0]} fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        ) : widget.kind === "hbar" ? (
          <BarChart data={points} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.4} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={axisFmt} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={96} />
            <Tooltip {...tip} cursor={{ fillOpacity: 0.08 }} />
            <Bar dataKey="value" fill={PALETTE[0]} radius={[0, 6, 6, 0]} />
          </BarChart>
        ) : (
          <BarChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={points.length > 6 ? -30 : 0} textAnchor={points.length > 6 ? "end" : "middle"} height={points.length > 6 ? 54 : 30} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={axisFmt} />
            <Tooltip {...tip} cursor={{ fillOpacity: 0.08 }} />
            <Bar dataKey="value" fill={PALETTE[0]} radius={[6, 6, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
