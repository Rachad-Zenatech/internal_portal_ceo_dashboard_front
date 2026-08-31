import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

export interface Notification {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link_url?: string;
  entity_type?: string;
  entity_id?: string;

  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export function useNotifications(options?: { refetchInterval?: number | false }) {
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
    retry: false,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchInterval: options?.refetchInterval ?? 30000,
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
    retry: false,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchInterval: options?.refetchInterval ?? 30000,
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
