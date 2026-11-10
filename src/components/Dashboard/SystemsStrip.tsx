import { Server } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SystemsStripItem {
  id: string;
  name: string;
  status: string;
}

const DOT: Record<string, string> = {
  online: "bg-emerald-500",
  degraded: "bg-amber-500",
};

/** Compact connected-systems status: one wrapped row of pills instead of a card grid. */
export function SystemsStrip({ servers }: { servers: SystemsStripItem[] }) {
  const online = servers.filter((s) => s.status === "online").length;
  const allUp = servers.length > 0 && online === servers.length;

  return (
    <section aria-label="Connected systems" className="rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-2xs">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Server className="h-3.5 w-3.5" />
          Connected systems
        </span>
        {servers.length > 0 && (
          <span className={cn("text-xs font-medium", allUp ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
            {online}/{servers.length} online
          </span>
        )}
      </div>
      {servers.length === 0 ? (
        <p className="text-xs text-muted-foreground">Message Hub status unavailable</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {servers.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs">
              <span className={cn("h-2 w-2 rounded-full", DOT[s.status] ?? "bg-rose-500")} />
              <span className="font-medium text-foreground">{s.name}</span>
              <span className="capitalize text-muted-foreground">{s.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
