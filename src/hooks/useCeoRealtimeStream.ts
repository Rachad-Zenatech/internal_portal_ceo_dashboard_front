import { useServiceStatus } from "@/lib/ServiceStatusContext";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

export type ConnectionState = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "RECONNECTING";

export interface RealtimeSyncState {
  isConnected: boolean;
  connectionState: ConnectionState;
  lastSyncedAt: Date;
  triggerManualSync: () => void;
}

export function useCeoRealtimeStream(): RealtimeSyncState {
  const { wsConnected, reconnect } = useServiceStatus();
  const queryClient = useQueryClient();

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
    lastSyncedAt: new Date(),
    triggerManualSync,
  };
}
