import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PublicMoodListeningPost, PublicMoodTrend } from "@/types/socialCompliance";

type SentimentFilter = "ALL" | "POSITIVE" | "NEUTRAL" | "NEGATIVE";

const REC_STYLES: Record<string, string> = {
  POST: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
  WAIT: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  HOLD: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
};

const POST_BORDER: Record<string, string> = {
  POSITIVE: "border-emerald-500/70",
  NEUTRAL: "border-slate-300 dark:border-zinc-700",
  NEGATIVE: "border-rose-500/70",
};

function TrendPostsDrawer({
  posts,
  filter,
  onFilterChange,
}: {
  posts: PublicMoodListeningPost[];
  filter: SentimentFilter;
  onFilterChange: (next: SentimentFilter) => void;
}) {
  return (
    <div className="mt-3 space-y-2.5 rounded-xl bg-muted/30 p-3 border border-border/60">
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {(["ALL", "POSITIVE", "NEUTRAL", "NEGATIVE"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onFilterChange(s)}
            className={`rounded-full px-2.5 py-0.5 font-medium cursor-pointer ${
              filter === s ? "bg-foreground text-background" : "bg-background text-muted-foreground border border-border"
            }`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {posts.map((post, idx) => (
          <li key={`${post.url || idx}`} className={`border-l-2 pl-2.5 text-xs ${POST_BORDER[post.sentiment] || POST_BORDER.NEUTRAL}`}>
            <p className="text-foreground whitespace-pre-wrap break-words">
              {post.url ? (
                <a href={post.url} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-baseline gap-1">
                  <span>{post.text}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                </a>
              ) : (
                post.text
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {post.author} · {post.network} · {post.sentiment}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PublicMoodTrendRow({ trend }: { trend: PublicMoodTrend }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<SentimentFilter>("ALL");

  const filteredPosts = useMemo(() => {
    const posts = trend.top_posts || [];
    if (filter === "ALL") return posts;
    return posts.filter((p) => p.sentiment === filter);
  }, [trend.top_posts, filter]);

  return (
    <li className="py-3.5 first:pt-1 last:pb-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{trend.name}</h3>
            <Badge variant="outline" className={`text-[10px] font-semibold ${REC_STYLES[trend.recommendation] || ""}`}>
              {trend.recommendation}
            </Badge>
            {trend.is_spike && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300">
                <Flame className="h-2.5 w-2.5" /> Spike
              </Badge>
            )}
          </div>
          {trend.post_title && (
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
              Post: {trend.post_title}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {trend.recommendation_reason || trend.description}
          </p>
        </div>

        <div className="text-right text-xs shrink-0">
          <span className={`font-semibold tabular-nums ${trend.net_sentiment >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            Net {trend.net_sentiment > 0 ? `+${trend.net_sentiment}` : trend.net_sentiment}
          </span>
          <p className="text-[11px] text-muted-foreground tabular-nums">{trend.volume} mentions</p>
        </div>
      </div>

      <div className="mt-2.5 flex h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${trend.positive_pct}% positive, ${trend.neutral_pct}% neutral, ${trend.negative_pct}% negative`}>
        <span className="bg-emerald-500" style={{ width: `${trend.positive_pct}%` }} title={`Positive ${trend.positive_pct}%`} />
        <span className="bg-slate-300 dark:bg-slate-600" style={{ width: `${trend.neutral_pct}%` }} title={`Neutral ${trend.neutral_pct}%`} />
        <span className="bg-rose-500" style={{ width: `${trend.negative_pct}%` }} title={`Negative ${trend.negative_pct}%`} />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          <strong className="text-emerald-600 dark:text-emerald-400">{trend.positive_pct}%</strong> pos ·{" "}
          <strong>{trend.neutral_pct}%</strong> neu ·{" "}
          <strong className="text-rose-600 dark:text-rose-400">{trend.negative_pct}%</strong> neg
        </span>
        {(trend.top_posts?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            <span>{expanded ? "Hide" : "View"} {trend.top_posts.length} source item(s)</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {expanded && <TrendPostsDrawer posts={filteredPosts} filter={filter} onFilterChange={setFilter} />}
    </li>
  );
}
