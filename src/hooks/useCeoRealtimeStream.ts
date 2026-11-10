import { useServiceStatus } from "@/lib/ServiceStatusContext";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

export type ConnectionState = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "RECONNECTING";

export interface RealtimeSyncState {
  isConnected: boolean;
  connectionState: ConnectionState;
  /** Time the last query successfully received fresh data (not the render time). */
  lastSyncedAt: Date;
  triggerManualSync: () => void;
}

export function useCeoRealtimeStream(): RealtimeSyncState {
  const { wsConnected, reconnect } = useServiceStatus();
  const queryClient = useQueryClient();
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(() => new Date());

  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        setLastSyncedAt(new Date());
      }
    });
  }, [queryClient]);

  const triggerManualSync = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    queryClient.invalidateQueries({ queryKey: ["ma"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["summaryMetrics"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["portalsStatus"] });
    reconnect();
  }, [queryClient, reconnect]);

  const connState: ConnectionState = useMemo(() => {
    return wsConnected ? "CONNECTED" : "DISCONNECTED";
  }, [wsConnected]);

  return {
    isConnected: wsConnected,
    connectionState: connState,
    lastSyncedAt,
    triggerManualSync,
  };
}
