import { useState, type ReactNode } from "react";
import { RefreshCw, AlertTriangle, WifiOff, Clock } from "lucide-react";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";

export type IntegrationStatus =
  | "idle"
  | "loading"
  | "connected"
  | "stale"
  | "reconnecting"
  | "disconnected"
  | "timeout"
  | "error";

interface WidgetResilienceWrapperProps {
  children: ReactNode;
  widgetName: string;
  status?: IntegrationStatus;
  isLoading?: boolean;
  isFetching?: boolean;
  isStale?: boolean;
  lastUpdated?: string | Date | null;
  errorMessage?: string | null;
  skeleton?: ReactNode;
  onReconnect?: () => Promise<any> | void;
  className?: string;
  hasData?: boolean;
}

export const WidgetResilienceWrapper: React.FC<WidgetResilienceWrapperProps> = ({
  children,
  widgetName,
  status = "connected",
  isLoading = false,
  isFetching = false,
  isStale = false,
  lastUpdated,
  errorMessage,
  skeleton,
  onReconnect,
  className = "",
  hasData = true,
}) => {
  const [localReconnecting, setLocalReconnecting] = useState(false);

  const handleManualReconnect = async () => {
    if (!onReconnect || localReconnecting) return;
    setLocalReconnecting(true);
    try {
      await Promise.race([
        Promise.resolve(onReconnect()),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Reconnect timed out after 30s")), 30000)),
      ]);
    } catch (err) {
      console.warn(`[${widgetName}] Reconnect error:`, err);
    } finally {
      setLocalReconnecting(false);
    }
  };

  const formattedLastUpdated = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  const isReconnectingState = localReconnecting || isFetching || status === "reconnecting";
  const isDisconnectedState = status === "disconnected" || status === "timeout" || status === "error";

  // Initial loading skeleton (when no prior data exists)
  if (isLoading && !hasData) {
    return (
      <WidgetErrorBoundary widgetName={widgetName}>
        {skeleton || (
          <div className={`p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 ${className}`}>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <Skeleton className="h-8 w-44 rounded-lg" />
            <Skeleton className="h-3 w-full rounded-md" />
          </div>
        )}
      </WidgetErrorBoundary>
    );
  }

  // Disconnected without usable cached data
  if (isDisconnectedState && !hasData) {
    return (
      <WidgetErrorBoundary widgetName={widgetName}>
        <div className={`p-5 rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 flex flex-col items-center justify-center text-center gap-3 min-h-[160px] ${className}`}>
          <div className="p-2.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
            <WifiOff className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
              {widgetName} Unavailable
            </h4>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 max-w-sm">
              {errorMessage || "Connection to service lost. Live data is currently unavailable."}
            </p>
            {formattedLastUpdated && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-1">
                <Clock className="w-3 h-3" /> Last updated: {formattedLastUpdated}
              </span>
            )}
          </div>

          {onReconnect && (
            <Button
              size="sm"
              disabled={isReconnectingState}
              onClick={handleManualReconnect}
              className="h-7 text-xs px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-2xs"
            >
              <RefreshCw className={`w-3 h-3 ${isReconnectingState ? "animate-spin" : ""}`} />
              <span>{isReconnectingState ? "Reconnecting..." : "Reconnect"}</span>
            </Button>
          )}
        </div>
      </WidgetErrorBoundary>
    );
  }

  // Normal render or Stale data render with isolated ErrorBoundary
  return (
    <WidgetErrorBoundary widgetName={widgetName}>
      <div className={`relative ${className}`}>
        {/* Stale Data Warning Banner */}
        {isStale && (
          <div className="mb-2 p-2 rounded-lg bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 animate-fadeIn">
            <div className="flex items-center gap-1.5 text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Showing cached data.</strong>
                {formattedLastUpdated && ` Last updated: ${formattedLastUpdated}`}
              </span>
            </div>

            {onReconnect && (
              <Button
                size="sm"
                variant="ghost"
                disabled={isReconnectingState}
                onClick={handleManualReconnect}
                className="h-6 text-[10px] px-2 rounded text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isReconnectingState ? "animate-spin" : ""}`} />
                <span>{isReconnectingState ? "Syncing..." : "Reconnect"}</span>
              </Button>
            )}
          </div>
        )}

        {/* Content */}
        {children}
      </div>
    </WidgetErrorBoundary>
  );
};
