import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  ChevronDown,
  FileText,
  Home,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Plane,
  Server,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { SystemsStripItem } from "@/components/Dashboard/SystemsStrip";

const EXPANDED_STORAGE_KEY = "ceo_dashboard_platforms_expanded_v1";

interface PlatformMeta {
  label: string;
  subtitle: string;
  icon: LucideIcon;
  to?: string;
}

const PLATFORM_META: Record<string, PlatformMeta> = {
  ceo: { label: "CEO Dashboard", subtitle: "Command Center", icon: LayoutDashboard, to: "/customization" },
  finance: { label: "Finance", subtitle: "Ledger & Treasury", icon: Landmark, to: "/finance" },
  administration: { label: "Administration", subtitle: "Approvals & Purchasing", icon: Building2, to: "/administration" },
  ma: { label: "M&A", subtitle: "Acquisitions Pipeline", icon: Briefcase, to: "/mergers-acquisitions" },
  social_media_compliance: { label: "Social Compliance", subtitle: "Approved Posts & Mood", icon: ShieldCheck, to: "/social-media-compliance" },
  marketing: { label: "Marketing", subtitle: "Campaigns & Budgets", icon: Megaphone },
  sec_filing: { label: "SEC Filing", subtitle: "Share Document", icon: FileText },
  travel: { label: "Travel", subtitle: "Bookings & Expenses", icon: Plane },
  real_estate: { label: "Real Estate", subtitle: "Properties & Floor Plans", icon: Home, to: "/real-estate" },
};

const STATUS_DOT: Record<string, { dot: string; label: string }> = {
  online: { dot: "bg-emerald-500", label: "Online" },
  degraded: { dot: "bg-amber-500", label: "Degraded" },
  offline: { dot: "bg-rose-500", label: "Offline" },
};

function loadInitialExpanded(): boolean {
  try {
    const raw = window.localStorage.getItem(EXPANDED_STORAGE_KEY);
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

function PlatformTile({ server }: { server: SystemsStripItem }) {
  const meta = PLATFORM_META[server.id] ?? {
    label: server.name,
    subtitle: "Connected service",
    icon: Server,
  };
  const Icon = meta.icon;
  const st = STATUS_DOT[server.status] ?? STATUS_DOT.offline;
  const isOnline = server.status === "online";

  const inner = (
    <div
      className={cn(
        "group flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 transition-colors",
        meta.to && "hover:border-foreground/25 hover:bg-muted/40"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-muted/50 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground truncate flex items-center gap-1">
            <span className="truncate">{meta.label}</span>
            {meta.to && (
              <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">{meta.subtitle}</p>
        </div>
      </div>

      <Badge variant={isOnline ? "outline" : "secondary"} className="shrink-0 gap-1.5 text-[11px] font-normal">
        <span className={cn("h-1.5 w-1.5 rounded-full", st.dot, isOnline && "animate-pulse")} />
        {st.label}
      </Badge>
    </div>
  );

  return meta.to ? <Link to={meta.to} className="block">{inner}</Link> : inner;
}

export function ConnectedPlatformsHub({ servers }: { servers: SystemsStripItem[] }) {
  const [expanded, setExpanded] = useState<boolean>(loadInitialExpanded);
  const online = servers.filter((s) => s.status === "online").length;
  const total = servers.length;
  const pct = total > 0 ? Math.round((online / total) * 100) : 0;

  const handleOpenChange = (next: boolean) => {
    setExpanded(next);
    try {
      window.localStorage.setItem(EXPANDED_STORAGE_KEY, String(next));
    } catch {
      // ignore storage errors
    }
  };

  return (
    <Collapsible open={expanded} onOpenChange={handleOpenChange} className="shrink-0">
      <Card size="sm" className="gap-0 py-0">
        <CardHeader className="py-3.5 items-center">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Server className="h-4 w-4 text-muted-foreground" />
                Connected Platforms
              </CardTitle>
              <CardDescription className="text-xs">
                Live service health &amp; direct workspace launch
              </CardDescription>
            </div>
            {total > 0 && (
              <div className="flex items-center gap-2">
                <Progress value={pct} className="w-16 h-1.5" />
                <Badge variant="secondary" className="text-[11px] font-normal tabular-nums">
                  {online}/{total} online
                </Badge>
              </div>
            )}
          </div>
          <CardAction>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <span>{expanded ? "Collapse" : "Expand"}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", expanded && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
          </CardAction>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="border-t border-border pt-4 pb-4">
            {total === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Connecting to Message Hub telemetry...
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {servers.map((server) => (
                  <PlatformTile key={server.id} server={server} />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
