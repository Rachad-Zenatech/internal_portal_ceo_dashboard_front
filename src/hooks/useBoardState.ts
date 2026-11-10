import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { useAuth } from "@/lib/AuthContext";
import type { BoardLayoutItem, BoardState, WidgetConfig } from "@/types/customize";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface BoardResponse {
  board_key: string;
  state: BoardState | null;
}

const SAVE_DELAY_MS = 800;

/** Next free slot at the bottom of the grid for a new widget. */
function nextSlot(layout: BoardLayoutItem[], w: number, h: number): Pick<BoardLayoutItem, "x" | "y" | "w" | "h"> {
  const bottom = layout.reduce((max, l) => Math.max(max, l.y + l.h), 0);
  return { x: 0, y: bottom, w, h };
}

export function newWidgetId(): string {
  return `w_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Widgets in reading order (top to bottom, then left to right): the order phones show them in. */
export function orderedWidgets(state: BoardState): WidgetConfig[] {
  const pos = new Map(state.layout.map((l) => [l.i, l]));
  return [...state.widgets].sort((a, b) => {
    const pa = pos.get(a.id);
    const pb = pos.get(b.id);
    return (pa?.y ?? 0) - (pb?.y ?? 0) || (pa?.x ?? 0) - (pb?.x ?? 0);
  });
}

/**
 * A board (widgets + grid layout) saved on the server for the signed-in user, so each login keeps its own
 * layout on every device. Nothing is shared between users. Until the user customizes, `defaults` are shown.
 */
export function useBoardState(boardKey: string, defaults: BoardState) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "anon";
  const url = `/api/v1/ceo/customization/boards/${boardKey}`;
  const cacheKey = useMemo(() => ["customization", "board", userId, boardKey], [userId, boardKey]);

  const saved = useQuery<BoardResponse>({
    queryKey: cacheKey,
    queryFn: ({ signal }) => apiClient.get<BoardResponse>(url, { signal }),
    staleTime: Infinity,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const [state, setState] = useState<BoardState | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const dirty = useRef(false);
  const latest = useRef<BoardState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defaultsRef = useRef(defaults);

  // Load the saved board once per user + page. If the server has none (or can't be reached) use the defaults.
  const scope = `${userId}:${boardKey}`;
  const hydratedScope = useRef<string | null>(null);
  useEffect(() => {
    if (hydratedScope.current === scope || saved.isLoading) return;
    hydratedScope.current = scope;
    dirty.current = false;
    setState(saved.data?.state ?? defaultsRef.current);
  }, [scope, saved.isLoading, saved.data]);

  const saveMutation = useMutation({
    mutationFn: (next: BoardState) => apiClient.put<BoardResponse>(url, next),
    // Keep the cached copy current so coming back to this page shows the latest saved board, not the one loaded earlier.
    onSuccess: (data) => {
      queryClient.setQueryData(cacheKey, data);
      setStatus("saved");
    },
    onError: () => setStatus("error"),
  });
  const { mutate: persist } = saveMutation;

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (dirty.current && latest.current) {
      dirty.current = false;
      persist(latest.current);
    }
  }, [persist]);

  // Save shortly after the user stops changing things; flush when leaving the page.
  useEffect(() => {
    latest.current = state;
    if (!state || !dirty.current) return;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [state, flush]);
  useEffect(() => flush, [flush]);

  const change = useCallback((fn: (s: BoardState) => BoardState) => {
    dirty.current = true;
    setState((s) => (s ? fn(s) : s));
  }, []);

  const setLayout = useCallback(
    (layout: BoardLayoutItem[]) => {
      const next = layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
      // The grid reports its layout on mount and after render passes; ignore no-op updates.
      setState((s) => {
        if (!s || JSON.stringify(s.layout) === JSON.stringify(next)) return s;
        dirty.current = true;
        return { ...s, layout: next };
      });
    },
    [],
  );

  const addWidget = useCallback(
    (widget: WidgetConfig) =>
      change((s) => {
        const small = widget.kind === "kpi" || widget.kind === "gauge" || widget.kind === "note";
        return { widgets: [...s.widgets, widget], layout: [...s.layout, { i: widget.id, ...nextSlot(s.layout, small ? 3 : 6, small ? 3 : 8) }] };
      }),
    [change],
  );

  const updateWidget = useCallback((widget: WidgetConfig) => change((s) => ({ ...s, widgets: s.widgets.map((w) => (w.id === widget.id ? widget : w)) })), [change]);

  const removeWidget = useCallback(
    (id: string) => change((s) => ({ widgets: s.widgets.filter((w) => w.id !== id), layout: s.layout.filter((l) => l.i !== id) })),
    [change],
  );

  /** Phones: move a widget up/down by swapping its position with the neighbour in reading order. */
  const moveWidget = useCallback(
    (id: string, direction: -1 | 1) =>
      change((s) => {
        const order = orderedWidgets(s);
        const index = order.findIndex((w) => w.id === id);
        const other = order[index + direction];
        if (index < 0 || !other) return s;
        const a = s.layout.find((l) => l.i === id);
        const b = s.layout.find((l) => l.i === other.id);
        if (!a || !b) return s;
        return {
          ...s,
          layout: s.layout.map((l) => (l.i === a.i ? { ...l, x: b.x, y: b.y } : l.i === b.i ? { ...l, x: a.x, y: a.y } : l)),
        };
      }),
    [change],
  );

  const reset = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    dirty.current = false;
    setState(defaultsRef.current);
    try {
      await apiClient.delete(url);
      queryClient.setQueryData(cacheKey, { board_key: boardKey, state: null });
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [url, queryClient, cacheKey, boardKey]);

  return {
    state,
    isLoading: state === null,
    loadFailed: saved.isError,
    status,
    retrySave: () => {
      dirty.current = true;
      flush();
    },
    setLayout,
    addWidget,
    updateWidget,
    removeWidget,
    moveWidget,
    reset,
  };
}
