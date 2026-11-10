import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetKind } from "@/types/customize";

const BAR_HEIGHTS = ["45%", "70%", "55%", "85%", "40%", "65%", "50%"];
const ROW_WIDTHS = ["90%", "72%", "58%", "44%", "32%"];

/** Placeholder shaped like the widget that is loading, so the page doesn't jump when data arrives. */
export default function WidgetSkeleton({ kind }: { kind: WidgetKind }) {
  switch (kind) {
    case "kpi":
      return (
        <div className="flex h-full flex-col justify-center gap-3 p-4" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-3.5 w-44 rounded" />
        </div>
      );
    case "gauge":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-4" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-24 w-48 rounded-t-full" />
          <Skeleton className="h-3.5 w-28 rounded" />
        </div>
      );
    case "pie":
      return (
        <div className="flex h-full items-center justify-center gap-6 p-4" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-32 w-32 rounded-full" />
          <div className="hidden space-y-2 sm:block">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-3 w-20 rounded" />)}
          </div>
        </div>
      );
    case "table":
      return (
        <div className="space-y-2 p-3" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-7 w-full rounded-md" />
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-5 w-full rounded" />)}
        </div>
      );
    case "ranking":
    case "hbar":
      return (
        <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading">
          {ROW_WIDTHS.map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3.5 w-16 rounded" />
              <Skeleton className="h-4 rounded-md" style={{ width: w }} />
            </div>
          ))}
        </div>
      );
    case "note":
      return (
        <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-11/12 rounded" />
          <Skeleton className="h-4 w-2/3 rounded" />
        </div>
      );
    default:
      // bar, line, area
      return (
        <div className="flex h-full min-h-40 items-end gap-2 p-4" aria-busy="true" aria-label="Loading">
          {BAR_HEIGHTS.map((h, i) => <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: h }} />)}
        </div>
      );
  }
}
