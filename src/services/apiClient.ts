import { handleResponse } from "./helper";

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
export const BASE_URL = rawBaseUrl.endsWith("/") ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

const getAuthHeaders = (): Record<string, string> => {
  const token = sessionStorage.getItem("token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
};

const configuredSlowRequestMs = Number(import.meta.env.VITE_SLOW_REQUEST_MS ?? 2000);
const SLOW_REQUEST_MS = Number.isFinite(configuredSlowRequestMs)
  ? Math.max(250, configuredSlowRequestMs)
  : 2000;
const MAX_PERFORMANCE_REPORTS_PER_MINUTE = 5;
const PERFORMANCE_DEDUPLICATION_MS = 60_000;
const performanceReportTimes: number[] = [];
const recentPerformanceReports = new Map<string, number>();

async function monitoredFetch(endpoint: string, options: RequestInit): Promise<Response> {
  const started = performance.now();
  let statusCode = 0;
  
  let targetEndpoint = endpoint;
  if (!targetEndpoint.startsWith("/api/") && !targetEndpoint.startsWith("/ai/")) {
    const path = targetEndpoint.startsWith("/") ? targetEndpoint : `/${targetEndpoint}`;
    if (path.startsWith("/api/")) {
      targetEndpoint = path;
    } else if (path.startsWith("/ai/")) {
      targetEndpoint = path;
    } else if (path === "/api" || path === "/api/") {
      targetEndpoint = "/api/";
    } else if (path === "/ai" || path === "/ai/") {
      targetEndpoint = "/ai/";
    } else {
      targetEndpoint = `/api${path}`;
    }
  }


  try {
    const response = await fetch(`${BASE_URL}${targetEndpoint}`, options);
    statusCode = response.status;
    return response;
  } finally {
    const durationMs = performance.now() - started;
    if (
      durationMs >= SLOW_REQUEST_MS &&
      !targetEndpoint.startsWith("/api/observability/")
    ) {
      const now = Date.now();
      while (performanceReportTimes.length && performanceReportTimes[0] < now - 60_000) {
        performanceReportTimes.shift();
      }
      for (const [key, reportedAt] of recentPerformanceReports) {
        if (reportedAt < now - PERFORMANCE_DEDUPLICATION_MS) {
          recentPerformanceReports.delete(key);
        }
      }
      const method = options.method ?? "GET";
      const path = endpoint.split("?", 1)[0];
      const fingerprint = `${method}:${path}`;
      const lastReportedAt = recentPerformanceReports.get(fingerprint) ?? 0;
      if (
        performanceReportTimes.length < MAX_PERFORMANCE_REPORTS_PER_MINUTE &&
        now - lastReportedAt >= PERFORMANCE_DEDUPLICATION_MS
      ) {
        performanceReportTimes.push(now);
        recentPerformanceReports.set(fingerprint, now);
        void fetch(`${BASE_URL}/api/observability/client-performance`, {
          method: "POST",
          credentials: "include",
          keepalive: true,
          headers: { 
            "Content-Type": "application/json",
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            method,
            path,
            duration_ms: durationMs,
            status_code: statusCode,
          }),
        }).catch(() => undefined);
      }
    }
  }
}

export const apiClient = {
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await monitoredFetch(endpoint, {
      ...options, 
      method: "GET",
      credentials: "include",
      headers: {
        ...getAuthHeaders(),
        ...(options?.headers as Record<string, string>)
      } as HeadersInit
    });
    return handleResponse<T>(res);
  },
  
  async post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    const isFormData = body instanceof FormData;
    const res = await monitoredFetch(endpoint, {
      ...options,
      method: "POST",
      credentials: "include",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...getAuthHeaders(),
        ...(options?.headers as Record<string, string>),
      } as HeadersInit,
      body: isFormData ? body : JSON.stringify(body),
    });
    return handleResponse<T>(res);
  },
  
  async patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    const res = await monitoredFetch(endpoint, {
      ...options,
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...(options?.headers as Record<string, string>),
      } as HeadersInit,
      body: JSON.stringify(body),
    });
    return handleResponse<T>(res);
  },
  
  async put<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    const res = await monitoredFetch(endpoint, {
      ...options,
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...(options?.headers as Record<string, string>),
      } as HeadersInit,
      body: JSON.stringify(body),
    });
    return handleResponse<T>(res);
  },
  
  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await monitoredFetch(endpoint, {
      ...options, 
      method: "DELETE",
      credentials: "include",
      headers: {
        ...getAuthHeaders(),
        ...(options?.headers as Record<string, string>)
      } as HeadersInit
    });
    return handleResponse<T>(res);
  }
};
