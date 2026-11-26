import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, LayoutGrid, Loader2, Map as MapIcon, RefreshCw, Search, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRealEstateProperties } from "@/hooks/useRealEstate";
import type { RecordStatus } from "@/types/realEstate";
import { formatPropertyAddress } from "@/types/realEstate";
import { RealEstateOfflineBanner } from "./RealEstateOfflineBanner";
import { PropertiesTableView, PropertyCardGrid, PropertyStatCards } from "./PropertiesListComponents";
import { PropertyDetailView } from "./PropertyDetailView";

const PropertyMap = lazy(() => import("./PropertyMap"));
type ViewMode = "cards" | "table" | "map";

const BATCH_SIZE = 50;
const STATUS_FILTERS: Array<{ value: "all" | RecordStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

function PropertiesToolbar({
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
  viewMode,
  onViewMode,
}: {
  search: string;
  onSearch: (v: string) => void;
  statusFilter: "all" | RecordStatus;
  onStatusFilter: (v: "all" | RecordStatus) => void;
  viewMode: ViewMode;
  onViewMode: (v: ViewMode) => void;
}) {
  return (
    <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search name, reference, address, city, management…"
            className="pl-9 bg-card"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => onStatusFilter(v as "all" | RecordStatus)}>
          <TabsList>
            {STATUS_FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value} className="cursor-pointer px-3 text-xs">
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={viewMode} onValueChange={(v) => onViewMode(v as ViewMode)}>
        <TabsList>
          <TabsTrigger value="cards" className="cursor-pointer px-3 text-xs gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" />
            Cards
          </TabsTrigger>
          <TabsTrigger value="table" className="cursor-pointer px-3 text-xs gap-1.5">
            <Table2 className="h-3.5 w-3.5" />
            Table
          </TabsTrigger>
          <TabsTrigger value="map" className="cursor-pointer px-3 text-xs gap-1.5">
            <MapIcon className="h-3.5 w-3.5" />
            Map
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}

function RealEstateHeader({
  isOffline,
  isFetching,
  syncedTime,
  onRefresh,
}: {
  isOffline: boolean;
  isFetching: boolean;
  syncedTime: Date;
  onRefresh: () => void;
}) {
  return (
    <header className="shrink-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-border pb-4">
      <div className="space-y-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Real Estate</h1>
          <Badge variant="outline" className="gap-1.5 font-normal">
            <span className={`h-1.5 w-1.5 rounded-full ${isOffline ? "bg-rose-500" : "bg-emerald-500 animate-pulse"}`} />
            {isOffline ? "Offline" : "Live"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          All properties, unit details, documents, and 2D/3D floor plan models synced from Real Estate Management.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isFetching}
        className="gap-2 self-start sm:self-auto cursor-pointer"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        <span>Refresh</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {syncedTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </Button>
    </header>
  );
}

export default function RealEstatePage() {
  const { propertyId } = useParams<{ propertyId?: string }>();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RecordStatus>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  const { data: response, isLoading, isFetching, refetch, dataUpdatedAt } = useRealEstateProperties();
  const properties = Array.isArray(response?.data?.items) ? response.data.items : [];
  const isOffline = Boolean(response && response.status !== "connected");
  const syncedTime = dataUpdatedAt ? new Date(dataUpdatedAt) : new Date();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties.filter((p) => {
      if (statusFilter !== "all" && p.record_status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        p.property_name,
        p.property_reference,
        p.property_type,
        p.city,
        p.state_province_region,
        p.country_code,
        p.building_management,
        formatPropertyAddress(p),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [properties, search, statusFilter]);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [search, statusFilter, viewMode]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filtered.length));
  }, [filtered.length]);

  const handleSelectProperty = useCallback(
    (id: string) => {
      navigate(`/real-estate/properties/${id}`);
    },
    [navigate]
  );

  if (propertyId) {
    return <PropertyDetailView propertyId={propertyId} />;
  }

  const visibleRows = viewMode === "table" ? filtered.slice(0, visibleCount) : filtered;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 bg-background p-4 sm:p-6 lg:p-8 pb-12">
      <RealEstateHeader isOffline={isOffline} isFetching={isFetching} syncedTime={syncedTime} onRefresh={() => void refetch()} />

      <RealEstateOfflineBanner status={response?.status} lastUpdated={response?.last_updated} isRetrying={isFetching} onRetry={() => void refetch()} />

      <PropertyStatCards properties={properties} loading={isLoading && properties.length === 0} />

      <PropertiesToolbar search={search} onSearch={setSearch} statusFilter={statusFilter} onStatusFilter={setStatusFilter} viewMode={viewMode} onViewMode={setViewMode} />

      {isLoading && properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin mb-2" />
          <p className="text-sm">Loading properties…</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center items-center justify-center border-dashed shadow-none">
          <Building2 className="h-9 w-9 text-muted-foreground/50 mx-auto" />
          <p className="text-sm font-semibold text-foreground">No matching properties</p>
          <p className="text-xs text-muted-foreground">
            {properties.length === 0 ? "No properties were returned from the Real Estate service." : "Try adjusting your search query or status filter."}
          </p>
        </Card>
      ) : viewMode === "cards" ? (
        <PropertyCardGrid properties={filtered} onSelect={handleSelectProperty} />
      ) : viewMode === "map" ? (
        <Card className="h-[560px] py-0 overflow-hidden">
          <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
            <PropertyMap properties={filtered} selectedId={selectedMapId} onSelect={setSelectedMapId} onOpen={handleSelectProperty} />
          </Suspense>
        </Card>
      ) : (
        <PropertiesTableView properties={visibleRows} totalCount={filtered.length} hasMore={visibleRows.length < filtered.length} onLoadMore={loadMore} onSelect={handleSelectProperty} />
      )}
    </div>
  );
}
