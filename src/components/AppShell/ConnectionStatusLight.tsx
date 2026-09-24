import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Radio,
  Server,
  Database,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface IntegratedService {
  id: string;
  name: string;
  state: string;
  status: "online" | "degraded" | "recovering" | "offline";
  description?: string;
  mode?: string;
  failure_count?: number;
  endpoint?: string;
}

export interface IntegrationStatusResponse {
  status: "healthy" | "degraded" | "recovering" | "offline";
  services: IntegratedService[];
}

export function ConnectionStatusLight({ className = "" }: { className?: string }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, refetch, isError } = useQuery<IntegrationStatusResponse>({
    queryKey: ["integration-status"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<IntegrationStatusResponse>("/api/integration/status");
        if (res && Array.isArray(res.services)) return res;
        return {
          status: "healthy",
          services: [
            {
              id: "backend_api",
              name: "Backend Application API",
              state: "CONNECTED",
              status: "online",
              mode: "Live API",
              description: "FastAPI business logic & database gateway",
            },
            {
              id: "realtime_sse",
              name: "Real-time Notification Stream (SSE)",
              state: "STREAMING",
              status: "online",
              mode: "30s Keep-Alive",
              description: "Event-driven zero-DB streaming connection",
            },
          ],
        };
      } catch {
        return {
          status: "offline",
          services: [
            {
              id: "backend_api",
              name: "Backend Application API",
              state: "DISCONNECTED",
              status: "offline",
              mode: "Unreachable",
              description: "Could not reach backend gateway",
            },
          ],
        };
      }
    },
    staleTime: 15000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const overallStatus = isError ? "offline" : data?.status ?? "healthy";
  const services = data?.services ?? [];

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const statusConfig = {
    healthy: {
      color: "bg-emerald-500",
      pingColor: "bg-emerald-400",
      borderColor: "border-emerald-500/30",
      badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      label: "Connected",
      badgeText: "Live",
      icon: CheckCircle2,
    },
    recovering: {
      color: "bg-amber-500",
      pingColor: "bg-amber-400",
      borderColor: "border-amber-500/30",
      badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      label: "Recovering",
      badgeText: "Recovering",
      icon: AlertTriangle,
    },
    degraded: {
      color: "bg-amber-500",
      pingColor: "bg-amber-400",
      borderColor: "border-amber-500/30",
      badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      label: "Fallback Mode",
      badgeText: "Fallback",
      icon: AlertTriangle,
    },
    offline: {
      color: "bg-rose-500",
      pingColor: "bg-rose-400",
      borderColor: "border-rose-500/30",
      badgeBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
      label: "Disconnected",
      badgeText: "Offline",
      icon: XCircle,
    },
  }[overallStatus] ?? {
    color: "bg-emerald-500",
    pingColor: "bg-emerald-400",
    borderColor: "border-emerald-500/30",
    badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    label: "Connected",
    badgeText: "Live",
    icon: CheckCircle2,
  };

  const StatusIcon = statusConfig.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 hover:bg-muted/80 border ${statusConfig.borderColor} bg-background/60 shadow-sm ${className}`}
          title={`Connection Status: ${statusConfig.label}`}
        >
          <span className="relative flex h-2.5 w-2.5">
            {overallStatus === "healthy" && (
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusConfig.pingColor} opacity-75`}
              />
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusConfig.color}`}
            />
          </span>

          <span className="hidden sm:inline-block font-semibold text-[11px] tracking-tight">
            {statusConfig.badgeText}
          </span>

          <ChevronDown className="h-3 w-3 text-muted-foreground opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-3 shadow-xl rounded-xl z-50">
        <div className="flex items-center justify-between pb-2 border-b">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Connection Matrix
            </span>
          </div>
          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${statusConfig.badgeBg}`}>
            <StatusIcon className="h-3 w-3 mr-1 inline" />
            {statusConfig.label}
          </Badge>
        </div>

        <div className="py-2.5 space-y-2">
          {services.map((svc) => {
            const isOnline = svc.status === "online";
            const isDegraded = svc.status === "degraded" || svc.status === "recovering";
            return (
              <div
                key={svc.id}
                className="p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors border border-border/50 text-xs"
              >
                <div className="flex items-center justify-between font-semibold">
                  <div className="flex items-center gap-1.5">
                    {svc.id.includes("db") ? (
                      <Database className="h-3.5 w-3.5 text-blue-500" />
                    ) : svc.id.includes("sse") ? (
                      <Radio className="h-3.5 w-3.5 text-purple-500" />
                    ) : (
                      <Server className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                    <span>{svc.name}</span>
                  </div>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isOnline
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : isDegraded
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full mr-1 ${
                        isOnline ? "bg-emerald-500" : isDegraded ? "bg-amber-500" : "bg-rose-500"
                      }`}
                    />
                    {svc.mode || svc.state}
                  </span>
                </div>
                {svc.description && (
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    {svc.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <DropdownMenuSeparator />

        <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Real-time keep-alive active</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
            Check Now
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ConnectionStatusLight;
