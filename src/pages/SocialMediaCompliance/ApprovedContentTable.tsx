import { useEffect, useRef } from "react";
import { CheckCircle2, FileText, Image as ImageIcon, Loader2, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApprovedContentItem } from "@/types/socialCompliance";

interface Props {
  items: ApprovedContentItem[];
  totalCount: number;
  hasMore: boolean;
  batchSize: number;
  isLoading: boolean;
  onLoadMore: () => void;
  onSelect: (item: ApprovedContentItem) => void;
}

function ContentTypeIcon({ type }: { type: string }) {
  const upper = (type || "").toUpperCase();
  if (upper.includes("VIDEO")) return <Video className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />;
  if (upper.includes("IMAGE") || upper.includes("CAROUSEL")) return <ImageIcon className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />;
  return <FileText className="h-3.5 w-3.5 text-slate-500" />;
}

function ScoreBadge({ score, light }: { score?: number | null; light?: string | null }) {
  if (score === null || score === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  const tone =
    light === "RED" || score < 60
      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
      : light === "YELLOW" || score < 80
        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
        : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300";
  return (
    <Badge variant="outline" className={`font-semibold tabular-nums ${tone}`}>
      {score}%
    </Badge>
  );
}

function ApprovedRow({ item, onSelect }: { item: ApprovedContentItem; onSelect: (i: ApprovedContentItem) => void }) {
  const displayDate = item.publish_at || item.updated_at || item.created_at;
  return (
    <TableRow className="cursor-pointer" onClick={() => onSelect(item)}>
      <TableCell className="whitespace-normal align-top min-w-[260px] max-w-[380px]">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
            {item.reference_code}
          </span>
          <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Approved
          </Badge>
        </div>
        <p className="font-semibold text-foreground leading-snug break-words">{item.title}</p>
        {item.caption_text && (
          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words line-clamp-2">
            {item.caption_text}
          </p>
        )}
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-wrap gap-1">
          {(item.brand_names.length > 0 ? item.brand_names : [item.brand_name]).map((brand) => (
            <Badge
              key={brand}
              variant="outline"
              className="text-[11px] bg-indigo-50/70 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
            >
              {brand}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1">
          <ContentTypeIcon type={item.content_type} />
          <span>{item.content_type}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {item.platforms.length > 0 ? (
            item.platforms.map((p) => (
              <Badge key={p} variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                {p.toLowerCase()}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </TableCell>
      <TableCell className="align-top">
        <ScoreBadge score={item.latest_score} light={item.latest_traffic_light} />
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{item.created_by_name}</span>
          {item.created_by_email && <span className="text-xs text-muted-foreground">{item.created_by_email}</span>}
        </div>
      </TableCell>
      <TableCell className="align-top whitespace-nowrap text-xs text-muted-foreground">
        {displayDate ? new Date(displayDate).toLocaleString() : "—"}
        {item.publish_at && <span className="block text-[10px] text-indigo-600 dark:text-indigo-400">Scheduled publish</span>}
      </TableCell>
    </TableRow>
  );
}

export function ApprovedContentTable({
  items,
  totalCount,
  hasMore,
  batchSize,
  isLoading,
  onLoadMore,
  onSelect,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    const root = scrollRef.current;
    const marker = sentinelRef.current;
    if (!root || !marker || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { root, rootMargin: "160px" }
    );
    observer.observe(marker);
    return () => observer.disconnect();
  }, [hasMore, items.length, onLoadMore]);

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-3">
      <Card className="flex-1 min-h-0 rounded-xl border border-border bg-card overflow-hidden shadow-2xs flex flex-col p-0">
        <Table className="m-0 relative" containerRef={scrollRef} containerClassName="max-h-[calc(100vh-22rem)]">
          <TableHeader className="bg-slate-50/80 dark:bg-zinc-950/50 sticky top-0 z-10 shadow-sm border-b">
            <TableRow className="border-t-0">
              <TableHead>Approved Content / Post</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Type & Platforms</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Creator</TableHead>
              <TableHead>Publish / Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500 mx-auto" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No approved content found for the selected filter.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {items.map((item) => (
                  <ApprovedRow key={item.id} item={item} onSelect={onSelect} />
                ))}
                {hasMore && (
                  <TableRow ref={sentinelRef}>
                    <TableCell colSpan={6} className="text-center py-4">
                      <Button variant="ghost" size="sm" onClick={onLoadMore} className="text-xs text-muted-foreground cursor-pointer">
                        Loading more ({Math.min(batchSize, totalCount - items.length)} more)...
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground px-1">
        <span>
          Showing <strong className="text-foreground tabular-nums">{items.length}</strong> of{" "}
          <strong className="text-foreground tabular-nums">{totalCount}</strong> approved post(s)
        </span>
        {hasMore && (
          <Button variant="outline" size="sm" onClick={onLoadMore} className="h-8 rounded-lg text-xs cursor-pointer">
            Load next {Math.min(batchSize, totalCount - items.length)}
          </Button>
        )}
      </div>
    </div>
  );
}
