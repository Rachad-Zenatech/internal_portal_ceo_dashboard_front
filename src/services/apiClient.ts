import { handleResponse, ApiError } from "./helper";
import { appStorage } from "../lib/storage";
import { getApiBaseUrl } from "../lib/env";

export const BASE_URL = getApiBaseUrl();
export const DEFAULT_TIMEOUT_MS = 15_000; // 15s default timeout

const getAuthHeaders = (): Record<string, string> => {
  const token = appStorage.getItem("token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
};

export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
}

// In-flight GET request coalescing map to prevent duplicate burst requests
const inFlightGetRequests = new Map<string, Promise<any>>();

async function monitoredFetch(endpoint: string, options: ApiRequestOptions): Promise<Response> {
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

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let isTimeout = false;

  const timeoutTimer = setTimeout(() => {
    isTimeout = true;
    controller.abort();
  }, timeoutMs);

  // Combine parent signal if provided
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", () => controller.abort());
    }
  }

  try {
    const response = await fetch(`${BASE_URL}${targetEndpoint}`, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (options.signal?.aborted && !isTimeout) {
      throw err; // Let React Query cancellation propagate cleanly
    }
    if (isTimeout) {
      throw new ApiError(`Request to ${endpoint} timed out after ${Math.round(timeoutMs / 1000)}s.`, 408);
    }
    if (err.name === "TypeError" && err.message?.includes("fetch")) {
      throw new ApiError(`Service at ${endpoint} is temporarily unreachable.`, 503);
    }
    throw err;
  } finally {
    clearTimeout(timeoutTimer);
  }
}

export const apiClient = {
  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    // Coalesce identical concurrent in-flight GET requests
    const cacheKey = `${endpoint}_${JSON.stringify(options?.headers || {})}`;
    if (!options?.signal && inFlightGetRequests.has(cacheKey)) {
      return inFlightGetRequests.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
      try {
        const res = await monitoredFetch(endpoint, {
          ...options, 
          method: "GET",
          credentials: "include",
          headers: {
            ...getAuthHeaders(),
            ...(options?.headers as Record<string, string>)
          } as HeadersInit
        });
        return await handleResponse<T>(res);
      } finally {
        inFlightGetRequests.delete(cacheKey);
      }
    })();

    if (!options?.signal) {
      inFlightGetRequests.set(cacheKey, fetchPromise);
    }

    return fetchPromise;
  },
  
  async post<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
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
  
  async patch<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
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
  
  async put<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
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
  
  async delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
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