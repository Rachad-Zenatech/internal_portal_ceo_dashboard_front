import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, BASE_URL } from "@/services/apiClient";

export interface Notification {
  id: number;
  user_id: string | number;
  type: string;
  title: string;
  message: string;
  link_url?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  sender_name?: string | null;
  sender_avatar?: string | null;
  attachments?: any[] | null;
  background_job_id?: string;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
}

/**
 * Hook to subscribe to real-time notifications via SSE with automatic reconnect
 * and 30-60s zero-DB heartbeat support.
 */
export function useNotificationStream() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      try {
        const token = sessionStorage.getItem("token");
        const streamUrl = new URL(`${BASE_URL}/api/notifications/stream`, window.location.origin);
        if (token) {
          streamUrl.searchParams.set("token", token);
        }

        eventSource = new EventSource(streamUrl.toString(), { withCredentials: true });

        eventSource.onmessage = (event) => {
          if (!event.data || event.data.trim() === "") return;
          try {
            const data = JSON.parse(event.data);
            if (data) {
              // Real-time notification event received: invalidate cache for instant reactive update
              queryClient.invalidateQueries({ queryKey: ["notifications"] });
              queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
            }
          } catch {
            // Ignore keep-alive or non-JSON comments
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (isMounted) {
            reconnectTimeout = setTimeout(connect, 5000);
          }
        };
      } catch {
        if (isMounted) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [queryClient]);
}

export function useNotifications(options?: { refetchInterval?: number | false }) {
  useNotificationStream();
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<Notification[]>("/api/notifications");
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
    staleTime: 30000,
    refetchInterval: options?.refetchInterval ?? false,
    refetchOnWindowFocus: true,
  });
}

export function useUnreadNotificationCount(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ count: number }>("/api/notifications/unread-count");
        return res && typeof res.count === "number" ? res : { count: 0 };
      } catch {
        return { count: 0 };
      }
    },
    staleTime: 30000,
    refetchInterval: options?.refetchInterval ?? false,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: number) => {
      try {
        return await apiClient.patch(`/api/notifications/${notificationId}/read`, {});
      } catch {
        return null;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        return await apiClient.patch(`/api/notifications/read-all`, {});
      } catch {
        return null;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}

export function useClearReadNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        return await apiClient.delete("/api/notifications/read");
      } catch {
        return null;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}

export function useClearAllNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        return await apiClient.delete("/api/notifications/all");
      } catch {
        return null;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}
