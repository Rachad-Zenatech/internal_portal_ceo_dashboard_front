import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useCeoRealtimeStream } from "@/hooks/useCeoRealtimeStream";
import {
  Settings as SettingsIcon,
  Server,
  Activity,
  Bell,
  Shield,
  Palette,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Wifi,
  WifiOff,
  User,
  Sliders,
  Database,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getEnv } from "@/lib/env";

interface PortalStatus {
  name: string;
  code: string;
  port: number;
  domain: string;
  status: "online" | "degraded" | "offline";
  status_code?: number;
  latency_ms: number;
  is_local?: boolean;
}

export default function Settings() {
  const { user, roles } = useAuth();
  const { isConnected, lastSyncedAt, triggerManualSync } = useCeoRealtimeStream();

  const [inAppAlerts, setInAppAlerts] = useState(() => localStorage.getItem("inAppAlerts") !== "false");
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  // Portals Status Query
  const { data: portals = [], refetch: refetchPortals, isFetching: isFetchingPortals } = useQuery<PortalStatus[]>({
    queryKey: ["portalsStatus"],
    queryFn: () => apiClient.get<PortalStatus[]>("/api/v1/ceo/portals-status"),
    staleTime: 30000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const toggleInAppAlerts = () => {
    const next = !inAppAlerts;
    setInAppAlerts(next);
    localStorage.setItem("inAppAlerts", String(next));
    toast.success(next ? "In-app notifications enabled" : "In-app notifications silenced");
  };

  const handleTestPing = () => {
    refetchPortals();
    triggerManualSync();
    toast.info("Testing integration links and refreshing live status...");
  };

  return (
    <div className="w-full flex flex-col gap-5 p-4 sm:p-6 lg:p-7 min-h-screen bg-slate-50/40 dark:bg-zinc-950 transition-colors">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80 dark:border-zinc-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 flex items-center gap-2.5">
              <SettingsIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Executive Settings & Integrations
            </h1>
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60 font-semibold">
              System v2.4
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Microservice connection matrix, real-time SSE stream configuration, executive alert preferences, and governance controls.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestPing}
            disabled={isFetchingPortals}
            className="text-xs h-9 px-3.5 rounded-xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 gap-1.5 shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetchingPortals ? "animate-spin text-indigo-600" : ""}`} />
            <span>Test Ping & Refresh</span>
          </Button>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Connected Services Matrix & Real-time Stream */}
        <div className="lg:col-span-2 space-y-5">
          {/* Connected Services Matrix */}
          <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-zinc-800/80">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Server className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Integrated Microservices & Portals
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Live health telemetry, circuit breaker statuses, and port bindings.
                  </CardDescription>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
                  <span>{isConnected ? "SSE Stream Connected" : "Connecting..."}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {portals.map((p) => {
                  const isOnline = p.status === "online";
                  return (
                    <div
                      key={p.code}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isOnline
                          ? "bg-slate-50/50 dark:bg-zinc-800/40 border-slate-200/80 dark:border-zinc-800"
                          : "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-900/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
                          <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">{p.name}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 font-semibold ${
                            isOnline
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}
                        >
                          {isOnline ? "ONLINE" : "DISCONNECTED"}
                        </Badge>
                      </div>

                      <div className="mt-2 text-[11px] space-y-1 text-slate-600 dark:text-zinc-400">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Domain:</span>
                          <span className="font-medium text-slate-700 dark:text-zinc-300">{p.domain}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Port / Target:</span>
                          <span className="font-mono">:{p.port || (p.is_local ? 8005 : "ext")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Latency:</span>
                          <span className="font-mono">{p.latency_ms}ms</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Real-time SSE Stream & Sync Config */}
          <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-zinc-800/80">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Real-Time SSE Event Broadcasting
              </CardTitle>
              <CardDescription className="text-xs">
                Zero-polling Server-Sent Events architecture for instantaneous cross-service data propagation.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 dark:text-zinc-100 block">Live Event Stream Hook</span>
                  <span className="text-[11px] text-muted-foreground">Subscribed to /api/v1/ceo/events/stream singleton</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold ${isConnected ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>
                    {isConnected ? "Active Stream" : "Reconnecting"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 dark:text-zinc-100 block">Last Synchronized Timestamp</span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {lastSyncedAt.toLocaleDateString()} at {lastSyncedAt.toLocaleTimeString()}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={triggerManualSync}
                  className="h-7 text-xs px-3 rounded-lg gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Trigger Sync</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: User & Executive Preferences */}
        <div className="space-y-5">
          {/* Executive Profile & PBAC Roles */}
          <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-zinc-800/80">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Executive Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground text-[11px] block">Full Name</span>
                <span className="font-bold text-slate-900 dark:text-zinc-100">{user?.full_name || "Chief Executive Officer"}</span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-[11px] block">Email</span>
                <span className="font-mono text-slate-700 dark:text-zinc-300">{user?.email || "ceo@zenatech.com"}</span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-[11px] block">Assigned PBAC Roles</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(roles.length ? roles : ["SUPER_ADMIN", "CEO_EXECUTIVE"]).map((r) => (
                    <Badge key={r} variant="secondary" className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-900">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* In-App Notifications */}
          <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-zinc-800/80">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Notifications & Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 block">In-App Live Toast Alerts</span>
                  <span className="text-[11px] text-muted-foreground">Popup toasts on incoming purchase requests & LOI deals</span>
                </div>
                <Button
                  size="sm"
                  variant={inAppAlerts ? "default" : "outline"}
                  onClick={toggleInAppAlerts}
                  className={`h-7 px-3 text-xs rounded-lg cursor-pointer ${inAppAlerts ? "bg-indigo-600 text-white" : ""}`}
                >
                  {inAppAlerts ? "Enabled" : "Disabled"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
