import { ArrowUpDown, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";

export const AUDIT_SOURCE_LABELS: Record<string, string> = {
  ceo: "CEO Dashboard",
  administration: "Administration",
  admin: "Administration",
  ma: "M&A",
  m7a: "M&A",
  finance: "Finance",
  marketing: "Marketing",
  real_estate: "Real Estate",
  social_media_compliance: "Compliance",
  travel: "Travel",
  sec_filing: "SEC Filing",
  share_document: "SEC Filing",
  template_automation: "Templates",
};

export function getCeoAuditActionBadgeColor(action: string) {
  const act = (action || "").toUpperCase();
  if (act.includes("OVERRIDE") || act.includes("URGENT"))
    return "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 font-semibold";
  if (act.includes("CREATE"))
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400";
  if (act.includes("UPDATE"))
    return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400";
  if (act.includes("DELETE") || act.includes("REJECT"))
    return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400";
  return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-slate-300";
}

export function buildCeoAuditColumns(): ColumnDef<any>[] {
  return [
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Date & Time
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium">{new Date(row.original.created_at).toLocaleString()}</span>,
    },
    {
      accessorKey: "source_service",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Project
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const key = String(row.original.source_service || "ceo").toLowerCase();
        const label = AUDIT_SOURCE_LABELS[key] || key.replace(/_/g, " ");
        return (
          <Badge variant="outline" className="text-[11px] font-medium bg-indigo-50/70 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 whitespace-nowrap">
            {label}
          </Badge>
        );
      },
    },
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
        <span className="font-mono text-xs text-slate-500 max-w-[150px] truncate block" title={row.original.entity_id}>
          {row.original.entity_id}
        </span>
      ),
    },
    {
      id: "details",
      header: () => <div className="font-semibold">Details</div>,
      cell: ({ row }) => {
        const nv = row.original.new_value;
        const reason = nv && typeof nv === "object" ? nv.urgent_override_reason : null;
        const comment = nv && typeof nv === "object" ? nv.comment || nv.details || nv.message : null;
        if (reason) {
          return (
            <span className="text-xs font-medium text-red-600 dark:text-red-400 line-clamp-2 max-w-[300px]">
              Urgent Override: {String(reason)}
            </span>
          );
        }
        if (comment) {
          return <span className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 max-w-[300px]">{String(comment)}</span>;
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
