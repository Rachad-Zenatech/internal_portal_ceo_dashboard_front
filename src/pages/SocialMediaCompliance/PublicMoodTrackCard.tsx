import { CalendarClock, Landmark, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicMoodScrapeScope, PublicMoodTrack } from "@/types/socialCompliance";
import { PublicMoodTrendRow } from "./PublicMoodTrendRow";

interface Props {
  track: PublicMoodTrack;
  scope: Exclude<PublicMoodScrapeScope, "all">;
  scrapeLabel: string;
  busy: boolean;
  onScrape: (scope: PublicMoodScrapeScope) => void;
}

export function PublicMoodTrackCard({ track, scope, scrapeLabel, busy, onScrape }: Props) {
  const Icon = track.key === "financial_zenatech" ? Landmark : CalendarClock;

  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-3.5">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
            <Icon className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">{track.title}</h2>
            <p className="text-xs text-muted-foreground">{track.subtitle}</p>
            {track.collected_at && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Updated {new Date(track.collected_at).toLocaleString()} · Status: {track.status}
              </p>
            )}
          </div>
        </div>

        <Button type="button" size="sm" variant="outline" className="gap-1.5 rounded-xl cursor-pointer" disabled={busy} onClick={() => onScrape(scope)}>
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          <span>{busy ? "Scraping..." : scrapeLabel}</span>
        </Button>
      </div>

      {track.trends.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-muted/20 p-5 text-xs text-muted-foreground">
          {track.empty_reason || "No public mood items collected yet."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border/70">
          {track.trends.map((trend) => (
            <PublicMoodTrendRow key={trend.external_id} trend={trend} />
          ))}
        </ul>
      )}
    </section>
  );
}
