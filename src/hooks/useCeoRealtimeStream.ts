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
const listeners = new Set<(state: { isConnected: boolean; lastSyncedAt: Date }) => void>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let globalQueryClient: ReturnType<typeof useQueryClient> | null = null;

function setConnectionStatus(newStatus: boolean) {
  if (globalIsConnected === newStatus) return; // Prevent duplicate notifications
  globalIsConnected = newStatus;
  notifyListeners();
}

function notifyListeners() {
  const payload = { isConnected: globalIsConnected, lastSyncedAt: globalLastSyncedAt };
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch {
      // ignore
    }
  });
}

function debouncedInvalidate() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    globalLastSyncedAt = new Date();
    notifyListeners();
    if (globalQueryClient) {
      globalQueryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
      globalQueryClient.invalidateQueries({ queryKey: ["completedApprovalsHistory"] });
      globalQueryClient.invalidateQueries({ queryKey: ["notifications"] });
      globalQueryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      globalQueryClient.invalidateQueries({ queryKey: ["ceoEvents"] });
      globalQueryClient.invalidateQueries({ queryKey: ["ceoAuditLogs"] });
      globalQueryClient.invalidateQueries({ queryKey: ["summaryMetrics"] });
      globalQueryClient.invalidateQueries({ queryKey: ["portalsStatus"] });
    }
  }, 1500); // 1.5s debounce buffer
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

    es.addEventListener("message", () => {
      debouncedInvalidate();
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
        }, 15000); // Wait full 15s before attempting reconnection
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

  const [state, setState] = useState({
    isConnected: globalIsConnected,
    lastSyncedAt: globalLastSyncedAt,
  });

  useEffect(() => {
    initGlobalEventSource();
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const triggerManualSync = useCallback(() => {
    debouncedInvalidate();
  }, []);

  return {
    isConnected: state.isConnected,
    lastSyncedAt: state.lastSyncedAt,
    triggerManualSync,
  };
}
