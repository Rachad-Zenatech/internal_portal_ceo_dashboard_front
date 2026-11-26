import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface DashboardVisibilityPrefs {
  showPulse: boolean;
  showPlatforms: boolean;
  showCanvas: boolean;
}

interface Props {
  userName: string;
  isConnected: boolean;
  onlineCount: number;
  totalServers: number;
  lastSyncedAt: Date;
  isRefreshing: boolean;
  prefs: DashboardVisibilityPrefs;
  onTogglePref: (key: keyof DashboardVisibilityPrefs) => void;
  onRefresh: () => void;
}

export function ExecutiveHeroBanner({
  userName,
  isConnected,
  onlineCount,
  totalServers,
  lastSyncedAt,
  isRefreshing,
  prefs,
  onTogglePref,
  onRefresh,
}: Props) {
  return (
    <header className="shrink-0 flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1.5 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome back, {userName}
          </h1>
          <Badge variant="outline" className="gap-1.5 font-normal">
            <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            {isConnected ? "Live" : "Reconnecting"}
          </Badge>
          {totalServers > 0 && (
            <Badge variant="secondary" className="font-normal tabular-nums">
              {onlineCount}/{totalServers} Platforms Online
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Unified executive overview across Finance, Administration, M&amp;A, Social Media Compliance, and Real Estate.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 cursor-pointer">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Dashboard Sections</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={prefs.showPulse} onCheckedChange={() => onTogglePref("showPulse")}>
              Executive Pulse Cards
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={prefs.showPlatforms} onCheckedChange={() => onTogglePref("showPlatforms")}>
              Connected Platforms
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={prefs.showCanvas} onCheckedChange={() => onTogglePref("showCanvas")}>
              Customizable Canvas
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-2 cursor-pointer"
          title={`Last synced: ${lastSyncedAt.toLocaleTimeString()}`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </Button>
      </div>
    </header>
  );
}
