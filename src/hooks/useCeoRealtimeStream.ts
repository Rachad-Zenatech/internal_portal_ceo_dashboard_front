import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BASE_URL } from "@/services/apiClient";

export type ConnectionState = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "RECONNECTING";

export interface RealtimeSyncState {
  isConnected: boolean;
  connectionState: ConnectionState;
  lastSyncedAt: Date;
  triggerManualSync: () => void;
}

// Module-level Singleton State Machine
let globalEventSource: EventSource | null = null;
let globalConnectionState: ConnectionState = "DISCONNECTED";
let globalLastSyncedAt = new Date();
const listeners = new Set<(state: ConnectionState) => void>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let globalQueryClient: ReturnType<typeof useQueryClient> | null = null;

// Reconnect with exponential backoff (2s -> 4s -> 8s -> 16s ... capped at 30s) + jitter (±20%)
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;
let reconnectAttempt = 0;

const lastKnownPortalStatus = new Map<string, "online" | "offline" | "checking">();
const lastToastNotificationTime = new Map<string, number>();

function setConnectionState(newState: ConnectionState) {
  if (globalConnectionState === newState) return;
  globalConnectionState = newState;
  listeners.forEach((listener) => {
    try {
      listener(globalConnectionState);
    } catch {
      // ignore
    }
  });
}

// Debounced and deduplicated toast notifications for service status transitions
function noteServiceStatus(serviceName: string, status: "online" | "offline" | "checking") {
  const previous = lastKnownPortalStatus.get(serviceName);
  if (previous === status) return;
  lastKnownPortalStatus.set(serviceName, status);

  if (previous === undefined) return; // first observation - ignore initial baseline

  const now = Date.now();
  const lastToast = lastToastNotificationTime.get(serviceName) || 0;
  if (now - lastToast < 10000) return; // 10s cooldown per service to prevent spam

  lastToastNotificationTime.set(serviceName, now);

  if (status === "offline") {
    toast.error(`${serviceName} went offline`, {
      description: "Falling back to cached data. Reconnecting automatically...",
    });
  } else if (status === "online" && previous !== "checking") {
    toast.success(`${serviceName} is back online`, {
      description: "Live data sync restored.",
    });
  }
}

function handleIncomingEvent(eventPayload: any) {
  if (!globalQueryClient || !eventPayload) return;

  const eventType = eventPayload?.event_type || "";

  // Instant per-service circuit-breaker transition push
  if (eventType === "SERVICE_STATE_CHANGED" && eventPayload?.data?.service) {
    noteServiceStatus(eventPayload.data.service, eventPayload.data.status);
    globalQueryClient.invalidateQueries({ queryKey: ["portalsStatus"] });
    return;
  }

  // Direct cache update for telemetry
  if (eventType === "PORTALS_STATUS_UPDATED" && eventPayload?.portals) {
    globalQueryClient.setQueryData(["portalsStatus"], eventPayload.portals);
    for (const portal of eventPayload.portals) {
      if (portal?.name && portal?.status) {
        noteServiceStatus(portal.name, portal.status === "online" ? "online" : "offline");
      }
    }
    return;
  }

  // Targeted debounced invalidation for approvals & notifications only
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    globalLastSyncedAt = new Date();
    if (globalQueryClient) {
      if (eventType.startsWith("PURCHASE_") || eventType === "PURCHASE_REQUESTS_UPDATED") {
        globalQueryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
        globalQueryClient.invalidateQueries({ queryKey: ["completedApprovalsHistory"] });
        globalQueryClient.invalidateQueries({ queryKey: ["notifications"] });
        globalQueryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
        globalQueryClient.invalidateQueries({ queryKey: ["ceoEvents"] });
        globalQueryClient.invalidateQueries({ queryKey: ["ceoAuditLogs"] });
      } else {
        globalQueryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
        globalQueryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
    }
  }, 2500); // 2.5s calm debounce
}

function closeGlobalEventSource() {
  if (globalEventSource) {
    try {
      globalEventSource.onopen = null;
      globalEventSource.onerror = null;
      globalEventSource.onmessage = null;
      globalEventSource.close();
    } catch {
      // ignore
    }
    globalEventSource = null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  setConnectionState("RECONNECTING");

  // Calculate exponential backoff with ±20% jitter
  const rawDelay = Math.min(RECONNECT_BASE_MS * (2 ** reconnectAttempt), RECONNECT_MAX_MS);
  const jitterFactor = 1 + (Math.random() * 0.4 - 0.2);
  const delay = Math.max(1000, Math.round(rawDelay * jitterFactor));

  reconnectAttempt = Math.min(reconnectAttempt + 1, 6);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initGlobalEventSource();
  }, delay);
}

function initGlobalEventSource() {
  if (globalEventSource) return;
  if (reconnectTimer) return;

  setConnectionState("CONNECTING");

  try {
    const streamUrl = `${BASE_URL}/api/v1/ceo/events/stream`;
    const es = new EventSource(streamUrl);
    globalEventSource = es;

    es.addEventListener("connected", () => {
      reconnectAttempt = 0;
      setConnectionState("CONNECTED");
      globalLastSyncedAt = new Date();
    });

    es.addEventListener("message", (evt) => {
      try {
        const data = evt.data ? JSON.parse(evt.data) : null;
        handleIncomingEvent(data);
      } catch {
        handleIncomingEvent(null);
      }
    });

    es.onopen = () => {
      reconnectAttempt = 0;
      setConnectionState("CONNECTED");
    };

    es.onerror = () => {
      closeGlobalEventSource();
      scheduleReconnect();
    };
  } catch {
    closeGlobalEventSource();
    scheduleReconnect();
  }
}

function forceImmediateReconnect() {
  if (globalConnectionState === "CONNECTED" || globalConnectionState === "CONNECTING") return;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempt = 0;
  closeGlobalEventSource();
  initGlobalEventSource();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", forceImmediateReconnect);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") forceImmediateReconnect();
  });
}

export function useCeoRealtimeStream(): RealtimeSyncState {
  const queryClient = useQueryClient();
  globalQueryClient = queryClient;

  const [connState, setConnState] = useState<ConnectionState>(globalConnectionState);

  useEffect(() => {
    initGlobalEventSource();
    listeners.add(setConnState);
    return () => {
      listeners.delete(setConnState);
    };
  }, []);

  const triggerManualSync = useCallback(() => {
    if (globalQueryClient) {
      globalQueryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
      globalQueryClient.invalidateQueries({ queryKey: ["completedApprovalsHistory"] });
      globalQueryClient.invalidateQueries({ queryKey: ["portalsStatus"] });
      globalQueryClient.invalidateQueries({ queryKey: ["summaryMetrics"] });
      globalQueryClient.invalidateQueries({ queryKey: ["ceoEvents"] });
      globalQueryClient.invalidateQueries({ queryKey: ["ceoAuditLogs"] });
      globalQueryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, []);

  return {
    isConnected: connState === "CONNECTED",
    connectionState: connState,
    lastSyncedAt: globalLastSyncedAt,
    triggerManualSync,
  };
}

// Vite HMR Clean Disposal
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    closeGlobalEventSource();
    if (debounceTimer) clearTimeout(debounceTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
  });
}
