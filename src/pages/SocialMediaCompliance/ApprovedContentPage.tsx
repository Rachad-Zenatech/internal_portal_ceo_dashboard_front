import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Globe2, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApprovedComplianceContent } from "@/hooks/useSocialCompliance";
import type { ApprovedContentItem, ComplianceBrand } from "@/types/socialCompliance";
import { ApprovedContentTable } from "./ApprovedContentTable";
import { ApprovedContentDetailDialog } from "./ApprovedContentDetailDialog";
import { ComplianceOfflineBanner } from "./ComplianceOfflineBanner";

const BATCH_SIZE = 50;

function BrandFilterBar({
  brands,
  totalCount,
  brandCounts,
  selectedBrand,
  onSelect,
}: {
  brands: ComplianceBrand[];
  totalCount: number;
  brandCounts: Map<string, number>;
  selectedBrand: string;
  onSelect: (code: string) => void;
}) {
  return (
    <Tabs value={selectedBrand} onValueChange={onSelect}>
      <TabsList className="h-auto flex-wrap justify-start gap-1 p-1">
        <TabsTrigger value="ALL" className="cursor-pointer gap-1.5 px-3 py-1 text-xs">
          <span>All Brands</span>
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal tabular-nums">{totalCount}</Badge>
        </TabsTrigger>
        {brands.map((brand) => (
          <TabsTrigger key={brand.code} value={brand.code} className="cursor-pointer gap-1.5 px-3 py-1 text-xs">
            <span>{brand.name}</span>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal tabular-nums">{brandCounts.get(brand.code) || 0}</Badge>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export default function ApprovedContentPage() {
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [selectedItem, setSelectedItem] = useState<ApprovedContentItem | null>(null);

  const { data: response, isLoading, isFetching, refetch, dataUpdatedAt } = useApprovedComplianceContent();
  const items = response?.data?.items ?? [];
  const brands = response?.data?.brands ?? [];
  const isOffline = Boolean(response && response.status !== "connected");
  const syncedTime = dataUpdatedAt ? new Date(dataUpdatedAt) : new Date();

  const brandCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const codes = item.brand_codes.length > 0 ? item.brand_codes : item.brand_code ? [item.brand_code] : [];
      for (const code of codes) counts.set(code, (counts.get(code) || 0) + 1);
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedBrand !== "ALL") {
        const codes = item.brand_codes.length > 0 ? item.brand_codes : item.brand_code ? [item.brand_code] : [];
        if (!codes.some((c) => c.toUpperCase() === selectedBrand.toUpperCase())) return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.reference_code.toLowerCase().includes(q) ||
        item.caption_text.toLowerCase().includes(q) ||
        item.brand_name.toLowerCase().includes(q) ||
        item.created_by_name.toLowerCase().includes(q) ||
        item.platforms.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [items, selectedBrand, search]);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [selectedBrand, search]);

  const visibleItems = useMemo(() => filteredItems.slice(0, visibleCount), [filteredItems, visibleCount]);
  const hasMore = visibleCount < filteredItems.length;
  const loadMore = useCallback(() => setVisibleCount((c) => c + BATCH_SIZE), []);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 sm:gap-6 bg-background p-4 sm:p-6 lg:p-8 pb-12">
      <header className="shrink-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Social Media Compliance</h1>
            <Badge variant="outline" className="gap-1.5 font-normal">
              <span className={`h-1.5 w-1.5 rounded-full ${isOffline ? "bg-rose-500" : "bg-emerald-500 animate-pulse"}`} />
              {isOffline ? "Offline" : "Live"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Approved social media posts and marketing content, synced from Social Media Compliance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button variant="outline" size="sm" asChild className="h-10 sm:h-9 rounded-xl gap-2">
            <Link to="/social-media-compliance/public-mood">
              <Globe2 className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              Public Mood
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching} className="h-10 sm:h-9 rounded-xl gap-2 cursor-pointer">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span>Refresh</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {syncedTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </Button>
        </div>
      </header>

      <ComplianceOfflineBanner
        status={response?.status}
        lastUpdated={response?.last_updated}
        isRetrying={isFetching}
        onRetry={() => void refetch()}
      />

      <BrandFilterBar
        brands={brands}
        totalCount={items.length}
        brandCounts={brandCounts}
        selectedBrand={selectedBrand}
        onSelect={setSelectedBrand}
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          placeholder="Search approved posts, captions, platforms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl bg-card"
        />
      </div>

      <ApprovedContentTable
        items={visibleItems}
        totalCount={filteredItems.length}
        hasMore={hasMore}
        batchSize={BATCH_SIZE}
        isLoading={isLoading && !isOffline}
        onLoadMore={loadMore}
        onSelect={setSelectedItem}
      />

      <ApprovedContentDetailDialog item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  );
}
