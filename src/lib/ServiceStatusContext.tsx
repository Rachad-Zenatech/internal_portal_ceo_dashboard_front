import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, BASE_URL } from "@/services/apiClient";
import { appStorage } from "@/lib/storage";
import { toast } from "sonner";

export type ServiceStatus = "online" | "offline" | "unknown";

export interface ServiceStatusMap {
  [serviceName: string]: ServiceStatus;
}

export interface ServiceStatusContextValue {
  serviceStatuses: ServiceStatusMap;
  isOnline: (serviceName: string) => boolean;
  getStatus: (serviceName: string) => ServiceStatus;
  wsConnected: boolean;
  lastUpdated: Record<string, string>;
  reconnect: () => void;
}

const ServiceStatusContext = createContext<ServiceStatusContextValue | null>(null);

// Service Name Normalization Map
export const SERVICE_NAMES = {
  ADMIN: "admin",
  MA: "ma",
  CEO: "ceo",
  FINANCE: "finance",
} as const;

export function normalizeServiceName(name: string): string {
  const lower = (name || "").toLowerCase().trim();
  if (lower.includes("admin") || lower.includes("purchas")) return "admin";
  if (lower.includes("ma") || lower.includes("m&a") || lower.includes("m7a") || lower.includes("merger")) return "ma";
  if (lower.includes("ceo")) return "ceo";
  if (lower.includes("finance") || lower.includes("accounting") || lower.includes("gl")) return "finance";
  return lower;
}

// Module-level Singleton State for WebSocket
let globalWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;

// Deduplicated toast cooldown tracker
const lastToastTimes = new Map<string, number>();

function notifyServiceTransition(serviceName: string, status: ServiceStatus, previousStatus?: ServiceStatus) {
  if (previousStatus === status || previousStatus === undefined) return;
  const now = Date.now();
  const lastTime = lastToastTimes.get(serviceName) || 0;
  if (now - lastTime < 10000) return; // 10s cooldown
  lastToastTimes.set(serviceName, now);

  const displayName = serviceName === "admin"
    ? "Administration Portal"
    : serviceName === "ma"
    ? "M&A System"
    : serviceName.toUpperCase();

  if (status === "offline") {
    toast.error(`${displayName} is currently offline`, {
      description: "Showing cached data. New actions are temporarily paused.",
    });
  } else if (status === "online") {
    toast.success(`${displayName} is back online`, {
      description: "Live data sync restored.",
    });
  }
}

export function ServiceStatusProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatusMap>({
    admin: "unknown",
    ma: "unknown",
    ceo: "online",
    finance: "online",
  });
  const [lastUpdated, setLastUpdated] = useState<Record<string, string>>({});
  const [wsConnected, setWsConnected] = useState(false);

  const statusesRef = useRef(serviceStatuses);
  statusesRef.current = serviceStatuses;

  const handleStatusChange = useCallback((service: string, newStatus: ServiceStatus, updatedAt?: string) => {
    const normService = normalizeServiceName(service);
    const prevStatus = statusesRef.current[normService];

    setServiceStatuses((prev) => {
      if (prev[normService] === newStatus) return prev;
      return { ...prev, [normService]: newStatus };
    });

    if (updatedAt) {
      setLastUpdated((prev) => ({ ...prev, [normService]: updatedAt }));
    }

    notifyServiceTransition(normService, newStatus, prevStatus);

    // React Query Coordination
    const qc = queryClientRef.current;
    if (!qc) return;

    if (newStatus === "offline") {
      // Cancel active queries for offline service immediately
      qc.cancelQueries({ queryKey: [normService] });
      if (normService === "admin") {
        qc.cancelQueries({ queryKey: ["pendingApprovals"] });
        qc.cancelQueries({ queryKey: ["completedApprovalsHistory"] });
        qc.cancelQueries({ queryKey: ["approvalDetail"] });
      } else if (normService === "ma") {
        qc.cancelQueries({ queryKey: ["ma-summary"] });
        qc.cancelQueries({ queryKey: ["ma-pipeline-loi-accepted-deals"] });
        qc.cancelQueries({ queryKey: ["ma-events"] });
      }
    } else if (newStatus === "online") {
      // Invalidate only affected query key namespace
      qc.invalidateQueries({ queryKey: [normService] });
      if (normService === "admin") {
        qc.invalidateQueries({ queryKey: ["pendingApprovals"] });
        qc.invalidateQueries({ queryKey: ["completedApprovalsHistory"] });
        qc.invalidateQueries({ queryKey: ["portalsStatus"] });
      } else if (normService === "ma") {
        qc.invalidateQueries({ queryKey: ["ma-summary"] });
        qc.invalidateQueries({ queryKey: ["ma-pipeline-loi-accepted-deals"] });
        qc.invalidateQueries({ queryKey: ["portalsStatus"] });
      }
    }
  }, []);

  const handleBusinessEvent = useCallback((event: any) => {
    const qc = queryClientRef.current;
    if (!qc || !event) return;

    const service = normalizeServiceName(event.service || "");
    const eventType = (event.eventType || event.event_type || "").toUpperCase();

    if (service === "admin" || eventType.startsWith("PURCHASE_") || eventType.includes("APPROVAL")) {
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["pendingApprovals"] });
      qc.invalidateQueries({ queryKey: ["completedApprovalsHistory"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["ceoEvents"] });
    } else if (service === "ma" || eventType.startsWith("MA_") || eventType.includes("LOI")) {
      qc.invalidateQueries({ queryKey: ["ma"] });
      qc.invalidateQueries({ queryKey: ["ma-summary"] });
      qc.invalidateQueries({ queryKey: ["ma-pipeline-loi-accepted-deals"] });
      qc.invalidateQueries({ queryKey: ["ceoEvents"] });
    } else if (service) {
      qc.invalidateQueries({ queryKey: [service] });
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (globalWs && (globalWs.readyState === WebSocket.OPEN || globalWs.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    try {
      let wsUrl = BASE_URL.replace(/^http(s)?:\/\//, (_, s) => (s ? "wss://" : "ws://"));
      const token = appStorage.getItem("token");
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
      const endpoint = `${wsUrl}/ws/service-status${tokenParam}`;

      const ws = new WebSocket(endpoint);
      globalWs = ws;

      ws.onopen = () => {
        reconnectAttempts = 0;
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.eventType === "service.status-snapshot" && data.services) {
            const nextMap: ServiceStatusMap = { ...statusesRef.current };
            const nextTimes: Record<string, string> = {};
            for (const [sName, sData] of Object.entries(data.services)) {
              const norm = normalizeServiceName(sName);
              const info = sData as { status: ServiceStatus; updatedAt?: string };
              nextMap[norm] = info.status || "unknown";
              if (info.updatedAt) nextTimes[norm] = info.updatedAt;
            }
            setServiceStatuses(nextMap);
            setLastUpdated((prev) => ({ ...prev, ...nextTimes }));
          } else if (data.eventType === "service.status-changed") {
            handleStatusChange(data.service, data.status as ServiceStatus, data.updatedAt);
          } else {
            handleBusinessEvent(data);
          }
        } catch {
          // ignore malformed ws message
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        globalWs = null;
        // Mark remote services as unknown on disconnect
        setServiceStatuses((prev) => ({
          ...prev,
          admin: "unknown",
          ma: "unknown",
        }));
        scheduleReconnect();
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      };
    } catch {
      scheduleReconnect();
    }
  }, [handleStatusChange, handleBusinessEvent]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer) return;
    const rawDelay = Math.min(RECONNECT_BASE_MS * (2 ** reconnectAttempts), RECONNECT_MAX_MS);
    const jitter = 0.8 + Math.random() * 0.4;
    const delay = Math.max(1000, Math.round(rawDelay * jitter));
    reconnectAttempts = Math.min(reconnectAttempts + 1, 6);

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectWebSocket();
    }, delay);
  }, [connectWebSocket]);

  // Initial Snapshot Fetch via REST (once on startup)
  useEffect(() => {
    let isMounted = true;
    apiClient.get<any>("/service-status")
      .then((res) => {
        if (!isMounted || !res?.services) return;
        const initialMap: ServiceStatusMap = {};
        const initialTimes: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.services)) {
          const norm = normalizeServiceName(k);
          const val = v as { status: ServiceStatus; updatedAt?: string };
          initialMap[norm] = val.status || "unknown";
          if (val.updatedAt) initialTimes[norm] = val.updatedAt;
        }
        setServiceStatuses((prev) => ({ ...prev, ...initialMap }));
        setLastUpdated((prev) => ({ ...prev, ...initialTimes }));
      })
      .catch(() => {
        // ignore initial fetch error; ws will update
      });

    connectWebSocket();

    return () => {
      isMounted = false;
    };
  }, [connectWebSocket]);

  const isOnline = useCallback((serviceName: string) => {
    const norm = normalizeServiceName(serviceName);
    return serviceStatuses[norm] === "online";
  }, [serviceStatuses]);

  const getStatus = useCallback((serviceName: string): ServiceStatus => {
    const norm = normalizeServiceName(serviceName);
    return serviceStatuses[norm] || "unknown";
  }, [serviceStatuses]);

  const reconnect = useCallback(() => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectAttempts = 0;
    if (globalWs) {
      try {
        globalWs.close();
      } catch {
        // ignore
      }
      globalWs = null;
    }
    connectWebSocket();
  }, [connectWebSocket]);

  const value: ServiceStatusContextValue = {
    serviceStatuses,
    isOnline,
    getStatus,
    wsConnected,
    lastUpdated,
    reconnect,
  };

  return (
    <ServiceStatusContext.Provider value={value}>
      {children}
    </ServiceStatusContext.Provider>
  );
}

export function useServiceStatus(): ServiceStatusContextValue {
  const context = useContext(ServiceStatusContext);
  if (!context) {
    // Fallback default if rendered outside provider
    return {
      serviceStatuses: { admin: "online", ma: "online", ceo: "online", finance: "online" },
      isOnline: () => true,
      getStatus: () => "online",
      wsConnected: false,
      lastUpdated: {},
      reconnect: () => {},
    };
  }
  return context;
}
