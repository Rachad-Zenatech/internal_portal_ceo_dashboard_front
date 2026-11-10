import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type KpiTone = "emerald" | "blue" | "amber" | "indigo";

const TONES: Record<KpiTone, string> = {
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400",
};

interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Secondary line under the value (amount, status, hint). */
  hint?: ReactNode;
  icon: ReactNode;
  tone?: KpiTone;
  loading?: boolean;
  /** When set the whole card is a button (large touch target on phones). */
  onClick?: () => void;
}

export function formatMoney(value: number | undefined | null): string {
  return `$${(Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function KpiCard({ label, value, hint, icon, tone = "indigo", loading, onClick }: KpiCardProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group w-full text-left rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 active:scale-[0.99]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("rounded-xl p-2 shrink-0", TONES[tone])}>{icon}</span>
      </div>
      <div className="mt-3 min-h-[3.25rem]">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-32 rounded-lg" />
            <Skeleton className="h-3.5 w-24 rounded" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</div>
            {hint && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                {hint}
                {onClick && <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />}
              </div>
            )}
          </>
        )}
      </div>
    </Comp>
  );
}
