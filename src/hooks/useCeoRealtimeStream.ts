import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BASE_URL } from "@/services/apiClient";

export interface RealtimeSyncState {
  isConnected: boolean;
  lastSyncedAt: Date;
  triggerManualSync: () => void;
}

// Module-level Singleton State
let globalEventSource: EventSource | null = null;
let globalIsConnected = false;
let globalLastSyncedAt = new Date();
const listeners = new Set<(connected: boolean) => void>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let globalQueryClient: ReturnType<typeof useQueryClient> | null = null;

// Reconnect with exponential backoff (1s -> 2s -> 4s ... capped at 15s), reset once a
// connection is confirmed open so a brief blip doesn't leave us on a slow cadence.
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
let reconnectAttempt = 0;

const lastKnownPortalStatus = new Map<string, "online" | "offline" | "checking">();

function setConnectionStatus(newStatus: boolean) {
  if (globalIsConnected === newStatus) return;
  globalIsConnected = newStatus;
  listeners.forEach((listener) => {
    try {
      listener(globalIsConnected);
    } catch {
      // ignore
    }
  });
}

// Toasts + cache dedupe so the same transition isn't announced twice (once from the instant
// SERVICE_STATE_CHANGED push, once from the ~24s PORTALS_STATUS_UPDATED snapshot).
function noteServiceStatus(serviceName: string, status: "online" | "offline" | "checking") {
  const previous = lastKnownPortalStatus.get(serviceName);
  if (previous === status) return;
  lastKnownPortalStatus.set(serviceName, status);

  if (previous === undefined) return; // first observation - not a real transition

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
  if (!globalQueryClient) return;

  const eventType = eventPayload?.event_type || "";

  // Instant per-service circuit-breaker transition push - fires the moment a service actually
  // goes down or recovers, instead of waiting on the periodic health snapshot.
  if (eventType === "SERVICE_STATE_CHANGED" && eventPayload?.data?.service) {
    noteServiceStatus(eventPayload.data.service, eventPayload.data.status);
    globalQueryClient.invalidateQueries({ queryKey: ["portalsStatus"] });
    return;
  }

  // Direct cache update for telemetry (Zero HTTP fetch needed!)
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
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt, RECONNECT_MAX_MS);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initGlobalEventSource();
  }, delay);
}

function initGlobalEventSource() {
  if (globalEventSource) return;
  if (reconnectTimer) return;

  try {
    const streamUrl = `${BASE_URL}/api/v1/ceo/events/stream`;
    const es = new EventSource(streamUrl);
    globalEventSource = es;

    es.addEventListener("connected", () => {
      reconnectAttempt = 0;
      setConnectionStatus(true);
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
      setConnectionStatus(true);
    };

    es.onerror = () => {
      setConnectionStatus(false);
      closeGlobalEventSource();
      scheduleReconnect();
    };
  } catch {
    setConnectionStatus(false);
    closeGlobalEventSource();
    scheduleReconnect();
  }
}

// The CEO backend itself can be unreachable across a reconnect cycle (not just downstream
// portals). Jump the exponential backoff the instant the browser regains connectivity or the
// tab is refocused, rather than waiting out whatever delay was already queued.
function forceImmediateReconnect() {
  if (globalIsConnected) return;
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

  const [isConnected, setIsConnected] = useState(globalIsConnected);

  useEffect(() => {
    initGlobalEventSource();
    listeners.add(setIsConnected);
    return () => {
      listeners.delete(setIsConnected);
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
    isConnected,
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
