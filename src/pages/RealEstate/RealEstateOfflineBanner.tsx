import { RefreshCw, WifiOff } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { IntegrationStatus } from "@/types/realEstate";

interface Props {
  status?: IntegrationStatus;
  lastUpdated?: string | null;
  isRetrying: boolean;
  onRetry: () => void;
}

export function RealEstateOfflineBanner({ status, lastUpdated, isRetrying, onRetry }: Props) {
  if (!status || status === "connected") return null;
  const showingSaved = status === "stale";

  return (
    <Alert className="shrink-0 border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
      <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle>
        {showingSaved ? "Showing saved Real Estate data, not live" : "Real Estate service unreachable"}
      </AlertTitle>
      <AlertDescription className="text-amber-800 dark:text-amber-300">
        {showingSaved
          ? `The Real Estate service did not answer the live request${lastUpdated ? `, so this is the copy saved on ${new Date(lastUpdated).toLocaleString()}` : ""}. It refreshes automatically once the connection works.`
          : "Showing the last loaded data. It will refresh automatically when the service returns."}
      </AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline" onClick={onRetry} disabled={isRetrying} className="gap-1.5 cursor-pointer bg-background">
          <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
          Retry
        </Button>
      </AlertAction>
    </Alert>
  );
}
