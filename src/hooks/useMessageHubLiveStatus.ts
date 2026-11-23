import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, BASE_URL } from "@/services/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { appStorage } from "@/lib/storage";
import type {
  HubConnectedServer,
  HubQueueOrStreamItem,
  MessageHubStatusResponse,
} from "@/types/messageHub";

const CURRENT_APP_ID = "ceo";

export const HUB_SERVERS: { id: string; name: string; user: string; port: number }[] = [
  { id: "ma", name: "M&A", user: "acquisition_service", port: 8003 },
  { id: "administration", name: "Administration", user: "administration_service", port: 8002 },
  { id: "ceo", name: "CEO Dashboard", user: "ceo_service", port: 8000 },
  { id: "social_media_compliance", name: "Social Media Compliance", user: "compliance_service", port: 8009 },
  { id: "finance", name: "Finance (Enterprise System)", user: "finance_service", port: 8001 },
  { id: "marketing", name: "Marketing Management", user: "marketing_service", port: 8010 },
  { id: "sec_filing", name: "SEC Filing (Share Document)", user: "sec_filing_service", port: 8006 },
  { id: "travel", name: "Travel Management", user: "travel_service", port: 8008 },
  { id: "real_estate", name: "Real Estate", user: "real_estate_service", port: 8007 },
];

// Backends that serve /api/message-hub/status; asked when this app's own backend is down
const PEER_BACKEND_URLS = ["travel", "marketing", "administration", "ceo"]
  .filter((id) => id !== CURRENT_APP_ID)
  .map((id) => `http://127.0.0.1:${HUB_SERVERS.find((h) => h.id === id)!.port}`);

function forceServerOffline(srv: HubConnectedServer): HubConnectedServer {
  return {
    ...srv,
    online: false,
    status: "offline",
    connection_state: "DISCONNECTED",
    connections_count: 0,
    queues: {
      ...srv.queues,
      working: false,
      status: "offline",
      consumers: 0,
      roundtrip_ms: null,
    },
    streams: {
      ...srv.streams,
      working: false,
      status: "offline",
      consumers: 0,
      roundtrip_ms: null,
    },
  };
}

function buildOfflineServer(s: { id: string; name: string; user: string; port: number }): HubConnectedServer {
  const q = (name: string, type: string): HubQueueOrStreamItem => ({
    name, type, state: "offline", consumers: 0, messages: 0, working: false,
  });
  return {
    id: s.id,
    name: s.name,
    service_user: s.user,
    port: s.port,
    is_self: s.id === CURRENT_APP_ID,
    online: false,
    status: "offline",
    connection_state: "DISCONNECTED",
    connections_count: 0,
    queues: {
      working: false,
      topology_ready: false,
      status: "offline",
      consumers: 0,
      items: [
        q(`${s.id}.commands`, "classic"),
        q(`${s.id}.commands.dlq`, "classic"),
        q(`ceo.${s.id}.events`, "classic"),
      ],
      roundtrip_ms: null,
    },
    streams: {
      working: false,
      topology_ready: false,
      status: "offline",
      consumers: 0,
      items: [q(`${s.id}.events.stream`, "stream"), q("hub.presence.stream", "stream")],
      roundtrip_ms: null,
    },
    last_seen: null,
  };
}

export function buildAllOfflineFallback(previous?: MessageHubStatusResponse): MessageHubStatusResponse {
  const nowIso = new Date().toISOString();
  const baseServers: HubConnectedServer[] =
    previous?.servers && previous.servers.length > 0
      ? previous.servers.map((s) => ({
          ...forceServerOffline(s),
          is_self: s.id === CURRENT_APP_ID,
        }))
      : HUB_SERVERS.map(buildOfflineServer);

  return {
    status: "offline",
    connected: false,
    checked_at: nowIso,
    hub: {
      name: "RabbitMQ Message Hub",
      status: "offline",
      connected: false,
      host: previous?.hub?.host || "127.0.0.1:5672",
      management_url: previous?.hub?.management_url || "http://127.0.0.1:15672",
      management_api_reachable: false,
      vhost: previous?.hub?.vhost || "zenatech-local",
      version: previous?.hub?.version || "4.4.0",
      total_connections: 0,
      online_servers: 0,
      total_servers: baseServers.length,
    },
    active_test: null,
    servers: baseServers,
  };
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 1800): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isTokenUsable(token: string | null): token is string {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return false;
    const claims = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof claims.exp !== "number" || claims.exp * 1000 > Date.now() + 5000;
  } catch {
    return false;
  }
}

/**
 * Shared live hub status query (local backend -> peer backend -> all-offline fallback).
 * Used by the TopBar dropdown and the Dashboard telemetry panel so both flip together
 * when a server is turned off. The SSE push listener lives in the dropdown.
 */
export function useMessageHubLiveStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useQuery<MessageHubStatusResponse>({
    queryKey: ["message-hub-live-status"],
    enabled: Boolean(user),
    queryFn: async () => {
      const previous = queryClient.getQueryData<MessageHubStatusResponse>(["message-hub-live-status"]);

      // 1. Try local backend first
      try {
        const res = await apiClient.get<MessageHubStatusResponse>("/api/message-hub/status");
        if (res && Array.isArray(res.servers)) {
          return res;
        }
      } catch {
        // Local backend is turned off / unreachable — fall through to peer backend
      }

      // 2. Local backend is offline: ask a surviving peer backend so we still see live hub status
      // while forcing This App's entry to OFFLINE
      for (const peerUrl of PEER_BACKEND_URLS) {
        try {
          const peerResp = await fetchWithTimeout(`${peerUrl}/api/message-hub/status`, {
            method: "GET",
            credentials: "include",
            headers: { Accept: "application/json" },
          });
          if (!peerResp.ok) continue;
          const peerData = (await peerResp.json()) as MessageHubStatusResponse;
          if (!peerData || !Array.isArray(peerData.servers)) continue;
          const adjustedServers = peerData.servers.map((srv) =>
            srv.id === CURRENT_APP_ID ? { ...forceServerOffline(srv), is_self: true } : { ...srv, is_self: false },
          );
          const onlineCount = adjustedServers.filter((s) => s.online).length;
          return {
            ...peerData,
            status: onlineCount === adjustedServers.length ? "online" : onlineCount > 0 ? "degraded" : "offline",
            connected: peerData.connected,
            hub: { ...peerData.hub, online_servers: onlineCount, total_servers: adjustedServers.length },
            servers: adjustedServers,
          } as MessageHubStatusResponse;
        } catch {
          // This peer is unreachable too; try the next one
        }
      }

      // 3. Both backends unreachable: mark all servers inside dropdown as OFFLINE
      return buildAllOfflineFallback(previous);
    },
    staleTime: 1500,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

/**
 * Real-time SSE listener for cross-server disconnect/reconnect pushes.
 * Appends the stored JWT via `?token=...` because EventSource cannot send
 * custom Authorization headers (required when cookies are absent/not forwarded).
 */
export function useMessageHubStream(refetch: () => unknown) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const storedToken = appStorage.getItem("token");
    if (storedToken === "dev-session-token") return;

    const tokenParam = isTokenUsable(storedToken)
      ? `?token=${encodeURIComponent(storedToken)}`
      : "";
    const streamUrl = `${BASE_URL || ""}/api/message-hub/stream${tokenParam}`;

    let es: EventSource | null = null;
    try {
      es = new EventSource(streamUrl, { withCredentials: true });
      es.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data) as MessageHubStatusResponse;
          if (payload && Array.isArray(payload.servers)) {
            queryClient.setQueryData(["message-hub-live-status"], payload);
          }
        } catch {
          // Ignore malformed event
        }
      };
      es.onerror = () => {
        // When This App's server stops, SSE drops immediately — trigger refetch to flip This App to OFFLINE
        refetch();
      };
    } catch {
      // EventSource not available
    }
    return () => {
      if (es) es.close();
    };
  }, [queryClient, refetch, user]);
}
