import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

function handleIncomingEvent(eventPayload: any) {
  if (!globalQueryClient) return;

  const eventType = eventPayload?.event_type || "";

  // Direct cache update for telemetry (Zero HTTP fetch needed!)
  if (eventType === "PORTALS_STATUS_UPDATED" && eventPayload?.portals) {
    globalQueryClient.setQueryData(["portalsStatus"], eventPayload.portals);
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

function initGlobalEventSource() {
  if (globalEventSource) return;
  if (reconnectTimer) return;

  try {
    const streamUrl = `${BASE_URL}/api/v1/ceo/events/stream`;
    const es = new EventSource(streamUrl);
    globalEventSource = es;

    es.addEventListener("connected", () => {
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
      setConnectionStatus(true);
    };

    es.onerror = () => {
      setConnectionStatus(false);
      closeGlobalEventSource();
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          initGlobalEventSource();
        }, 15000);
      }
    };
  } catch {
    setConnectionStatus(false);
    closeGlobalEventSource();
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        initGlobalEventSource();
      }, 15000);
    }
  }
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
