import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Clock, Globe2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCompliancePublicMood, useTriggerPublicMoodScrape } from "@/hooks/useSocialCompliance";
import type { PublicMoodScrapeScope } from "@/types/socialCompliance";
import { PublicMoodTrackCard } from "./PublicMoodTrackCard";
import { ComplianceOfflineBanner } from "./ComplianceOfflineBanner";

function PublicMoodStatsGrid({ total, postCount, waitCount, holdCount }: { total: number; postCount: number; waitCount: number; holdCount: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="rounded-xl border border-border bg-card p-3.5">
        <p className="text-xs text-muted-foreground">Tracked Topics</p>
        <p className="text-2xl font-bold tabular-nums text-foreground mt-1">{total}</p>
      </div>
      <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5">
        <p className="text-xs text-emerald-700 dark:text-emerald-300">Safe to Post</p>
        <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300 mt-1">{postCount}</p>
      </div>
      <div className="rounded-xl border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-3.5">
        <p className="text-xs text-amber-700 dark:text-amber-300">Watch / Wait</p>
        <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300 mt-1">{waitCount}</p>
      </div>
      <div className="rounded-xl border border-rose-200/70 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 p-3.5">
        <p className="text-xs text-rose-700 dark:text-rose-300">Hold / Risk</p>
        <p className="text-2xl font-bold tabular-nums text-rose-700 dark:text-rose-300 mt-1">{holdCount}</p>
      </div>
    </div>
  );
}

export default function PublicMoodPage() {
  const { data: response, isLoading, isFetching, refetch } = useCompliancePublicMood();
  const scrapeMutation = useTriggerPublicMoodScrape();

  const overview = response?.data;
  const busy = scrapeMutation.isPending || overview?.scrape_state === "running";

  const stats = useMemo(() => {
    const allTrends = [
      ...(overview?.financial_zenatech?.trends ?? []),
      ...(overview?.today_posts?.trends ?? []),
    ];
    const postCount = allTrends.filter((t) => t.recommendation === "POST").length;
    const waitCount = allTrends.filter((t) => t.recommendation === "WAIT").length;
    const holdCount = allTrends.filter((t) => t.recommendation === "HOLD").length;
    return { total: allTrends.length, postCount, waitCount, holdCount };
  }, [overview]);

  const handleScrape = async (scope: PublicMoodScrapeScope) => {
    try {
      const res = await scrapeMutation.mutateAsync(scope);
      toast.info(res.message || "Public mood scrape triggered");
    } catch (err: any) {
      toast.error(err?.message || "Failed to trigger public mood scrape");
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading live Public Mood from Social Media Compliance...
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 bg-background p-4 sm:p-6 lg:p-8 pb-12">
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-2xs">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
            <Globe2 className="size-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Public Mood</h1>
              <Badge variant="outline" className={response?.status === "connected" ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-amber-300 bg-amber-50 text-amber-700"}>
                {response?.status === "connected" ? "Linked to Social Media Compliance" : response?.status || "Offline"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Live public sentiment across ZenaTech financial coverage and today&apos;s scheduled social posts.
            </p>
            {overview?.schedule_label && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                <span>{overview.schedule_label}</span>
                {overview.next_scrape_at && <span>· Next run: {new Date(overview.next_scrape_at).toLocaleString()}</span>}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild className="rounded-xl gap-2">
            <Link to="/social-media-compliance">
              <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Approved Content
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching} className="rounded-xl gap-1.5 cursor-pointer">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void handleScrape("all")} className="rounded-xl gap-1.5 cursor-pointer">
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            {busy ? "Scraping..." : "Scrape both"}
          </Button>
        </div>
      </header>

      <ComplianceOfflineBanner
        status={response?.status}
        lastUpdated={response?.last_updated}
        isRetrying={isFetching}
        onRetry={() => void refetch()}
      />

      <PublicMoodStatsGrid {...stats} />

      {overview && (
        <div className="grid gap-5 lg:grid-cols-2">
          <PublicMoodTrackCard
            track={overview.financial_zenatech}
            scope="financial"
            scrapeLabel="Scrape financial"
            busy={busy}
            onScrape={(s) => void handleScrape(s)}
          />
          <PublicMoodTrackCard
            track={overview.today_posts}
            scope="today"
            scrapeLabel="Scrape today's posts"
            busy={busy}
            onScrape={(s) => void handleScrape(s)}
          />
        </div>
      )}
    </div>
  );
}
