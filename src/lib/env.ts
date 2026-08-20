// Universal environment variable reader for Vite and Metro / React Native

declare const process: any;

export function getEnv(key: string, defaultValue = ""): string {
  try {
    // 1. Check Vite's import.meta.env
    // @ts-ignore
    if (typeof import.meta !== "undefined" && import.meta?.env && key in import.meta.env) {
      // @ts-ignore
      const val = import.meta.env[key];
      if (val !== undefined && val !== null) return String(val);
    }
  } catch {
    // Ignore error in non-module environments
  }

  try {
    // 2. Check Node / Metro process.env
    // @ts-ignore
    if (typeof process !== "undefined" && process?.env && key in process.env) {
      // @ts-ignore
      const val = process.env[key];
      if (val !== undefined && val !== null) return String(val);
    }
  } catch {
    // Ignore error
  }

  return defaultValue;
}

// Expo/Metro replaces `process.env.EXPO_PUBLIC_*` at build time, but ONLY for a
// literal member expression. The dynamic `process.env[key]` lookup in getEnv() is
// never substituted, so native builds must read this statically or they fall back
// to localhost — which on a real device means the phone itself, not the dev machine.
function getNativeApiBaseUrl(): string {
  try {
    // @ts-ignore - `process` is provided by Metro, not typed under vite/client
    const val = process.env.EXPO_PUBLIC_API_BASE_URL;
    return val ? String(val) : "";
  } catch {
    return "";
  }
}

export function getApiBaseUrl(): string {
  const envUrl = getNativeApiBaseUrl() || getEnv("VITE_API_BASE_URL", "");
  if (envUrl) {
    return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
  }
  return "http://localhost:8005";
}
