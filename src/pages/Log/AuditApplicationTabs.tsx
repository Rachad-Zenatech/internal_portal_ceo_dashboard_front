import { cn } from "@/lib/utils";
import type { AuditApplicationTab } from "./auditLogSources";

interface AuditApplicationTabsProps {
  tabs: AuditApplicationTab[];
  selectedApp: string;
  onSelect: (appKey: string) => void;
}

export function AuditApplicationTabs({ tabs, selectedApp, onSelect }: AuditApplicationTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter audit logs by application"
      className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 p-1.5"
    >
      {tabs.map((tab) => {
        const isActive = selectedApp === tab.key;
        const hasLogs = tab.count > 0;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(tab.key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all whitespace-nowrap cursor-pointer",
              isActive
                ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100 shadow-xs ring-1 ring-slate-200 dark:ring-zinc-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-zinc-800/60"
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold tabular-nums",
                isActive
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : hasLogs
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                    : "bg-slate-200/70 text-slate-500 dark:bg-zinc-800 dark:text-slate-500"
              )}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
