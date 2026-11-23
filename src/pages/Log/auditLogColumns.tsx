import { ArrowUpDown, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import { AUDIT_SOURCE_LABELS, getAuditSourceLabel, normalizeAuditSource } from "./auditLogSources";

export { AUDIT_SOURCE_LABELS };

const SOURCE_BADGE_CLASSES: Record<string, string> = {
  ceo: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-zinc-800 dark:text-slate-200 dark:border-zinc-700",
  administration: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  ma: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800",
  finance: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  marketing: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800",
  real_estate: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  social_media_compliance: "bg-indigo-50/70 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
  travel: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800",
  sec_filing: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
  template_automation: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800",
};

export function getCeoAuditActionBadgeColor(action: string) {
  const act = (action || "").toUpperCase();
  if (act.includes("OVERRIDE") || act.includes("URGENT"))
    return "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 font-semibold";
  if (act.includes("CREATE") || act.includes("APPROV"))
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400";
  if (act.includes("UPDATE") || act.includes("ASSIGN"))
    return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400";
  if (act.includes("DELETE") || act.includes("REJECT"))
    return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400";
  return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-slate-300";
}

function formatAuditValue(val: unknown): string {
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

function summarizeAuditDetails(newValue: unknown): string | null {
  if (newValue === null || newValue === undefined) return null;
  if (typeof newValue === "string") return newValue.trim() || null;
  if (typeof newValue !== "object") return String(newValue);

  const obj = newValue as Record<string, unknown>;
  const direct = obj.comment || obj.details || obj.message || obj.reason || obj.summary;
  if (direct) return formatAuditValue(direct);

  const parts: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null) continue;
    const text = formatAuditValue(val).trim();
    if (!text) continue;
    parts.push(`${key.replace(/_/g, " ")}: ${text}`);
  }
  return parts.length > 0 ? parts.join("\n") : null;
}

export function buildCeoAuditColumns(options: { showProject?: boolean } = {}): ColumnDef<any>[] {
  const { showProject = true } = options;

  const projectColumn: ColumnDef<any>[] = showProject
    ? [
        {
          accessorKey: "source_service",
          header: ({ column }) => (
            <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
              Application
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          ),
          cell: ({ row }) => {
            const key = normalizeAuditSource(row.original.source_service);
            const label = getAuditSourceLabel(key);
            const badgeClass =
              SOURCE_BADGE_CLASSES[key] ||
              "bg-indigo-50/70 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800";
            return (
              <Badge variant="outline" className={`text-[11px] font-medium whitespace-nowrap ${badgeClass}`}>
                {label}
              </Badge>
            );
          },
        },
      ]
    : [];

  return [
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Date & Time
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium whitespace-nowrap">{new Date(row.original.created_at).toLocaleString()}</span>,
    },
    ...projectColumn,
    {
      accessorKey: "actor_name",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Actor
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-900 dark:text-slate-100">{row.original.actor_name || "System"}</span>
          {row.original.actor_email && <span className="text-xs text-slate-500">{row.original.actor_email}</span>}
        </div>
      ),
    },
    {
      accessorKey: "action",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Action
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <Badge variant="outline" className={getCeoAuditActionBadgeColor(row.original.action)}>
          {row.original.action}
        </Badge>
      ),
    },
    {
      accessorKey: "entity_type",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Entity Type
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.entity_type}</span>,
    },
    {
      accessorKey: "entity_id",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Entity ID
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-500 max-w-[150px] truncate block" title={row.original.entity_id || ""}>
          {row.original.entity_id || "—"}
        </span>
      ),
    },
    {
      id: "details",
      header: () => <div className="font-semibold">Details</div>,
      cell: ({ row }) => {
        const nv = row.original.new_value;
        const reason = nv && typeof nv === "object" ? (nv as Record<string, unknown>).urgent_override_reason : null;
        if (reason) {
          return (
            <div className="text-xs font-medium text-red-600 dark:text-red-400 whitespace-pre-wrap break-words leading-relaxed">
              Urgent Override: {String(reason)}
            </div>
          );
        }
        const summary = summarizeAuditDetails(nv);
        if (summary) {
          return (
            <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
              {summary}
            </div>
          );
        }
        return <span className="text-xs text-slate-400">—</span>;
      },
    },
  ];
}

export function buildCeoLoginColumns(): ColumnDef<any>[] {
  return [
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold w-[200px] justify-start" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Date & Time
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium whitespace-nowrap">{new Date(row.original.created_at).toLocaleString()}</span>,
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Account
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-900 dark:text-slate-100">{row.original.user_full_name || "Unknown"}</span>
          <span className="text-xs text-slate-500">{row.original.email}</span>
        </div>
      ),
    },
    {
      accessorKey: "success",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const log = row.original;
        return log.success ? (
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 gap-1.5 w-fit">
              <CheckCircle2 className="h-3 w-3" />
              Success
            </Badge>
            {log.logout_at && (
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                Logged out: {new Date(log.logout_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 gap-1.5 w-fit">
              <XCircle className="h-3 w-3" />
              Failed
            </Badge>
            <span className="text-xs text-red-600 dark:text-red-400 font-medium truncate max-w-[200px]" title={log.failure_reason}>
              {log.failure_reason}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "ip_address",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          IP Address
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.ip_address || "N/A"}</span>,
    },
    {
      accessorKey: "user_agent",
      header: () => <div className="font-semibold w-[300px]">User Agent</div>,
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 truncate max-w-[300px] block" title={row.original.user_agent}>
          {row.original.user_agent || "Unknown"}
        </span>
      ),
    },
  ];
}
