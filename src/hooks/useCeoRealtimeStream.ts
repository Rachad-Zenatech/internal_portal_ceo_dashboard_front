import { useEffect, useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BASE_URL } from "@/services/apiClient";

export interface RealtimeSyncState {
  isConnected: boolean;
  lastSyncedAt: Date;
  triggerManualSync: () => void;
}

export function useCeoRealtimeStream(): RealtimeSyncState {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(() => new Date());
  const eventSourceRef = useRef<EventSource | null>(null);

  const invalidateAll = useCallback(() => {
    setLastSyncedAt(new Date());
    queryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    queryClient.invalidateQueries({ queryKey: ["ceoEvents"] });
    queryClient.invalidateQueries({ queryKey: ["ceoAuditLogs"] });
    queryClient.invalidateQueries({ queryKey: ["summaryMetrics"] });
    queryClient.invalidateQueries({ queryKey: ["portalsStatus"] });
  }, [queryClient]);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isSubscribed = true;

    const connect = () => {
      if (!isSubscribed) return;
      try {
        const streamUrl = `${BASE_URL}/api/v1/ceo/events/stream`;
        es = new EventSource(streamUrl);
        eventSourceRef.current = es;

        es.addEventListener("connected", () => {
          if (!isSubscribed) return;
          setIsConnected(true);
          setLastSyncedAt(new Date());
        });

        es.addEventListener("message", () => {
          if (!isSubscribed) return;
          invalidateAll();
        });

        es.onopen = () => {
          if (!isSubscribed) return;
          setIsConnected(true);
          setLastSyncedAt(new Date());
        };

        es.onerror = () => {
          if (!isSubscribed) return;
          setIsConnected(false);
          if (es) {
            es.close();
            es = null;
          }
          reconnectTimer = setTimeout(connect, 6000);
        };
      } catch {
        if (!isSubscribed) return;
        setIsConnected(false);
        reconnectTimer = setTimeout(connect, 6000);
      }
    };

    connect();

    return () => {
      isSubscribed = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (es) {
        es.close();
      }
      eventSourceRef.current = null;
    };
  }, [invalidateAll]);

  const triggerManualSync = useCallback(() => {
    invalidateAll();
  }, [invalidateAll]);

  return { isConnected, lastSyncedAt, triggerManualSync };
}
