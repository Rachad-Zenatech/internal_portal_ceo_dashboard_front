import { Link } from "react-router-dom";
import { ArrowLeft, Building2, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRealEstatePropertyDetail } from "@/hooks/useRealEstate";
import { STATUS_STYLES, formatPropertyAddress } from "@/types/realEstate";
import { RealEstateOfflineBanner } from "./RealEstateOfflineBanner";
import { PropertyFloorPlanSection } from "./PropertyFloorPlanSection";
import {
  PropertyAtAGlanceCard,
  PropertyDocumentsCard,
  PropertyFullInfoCard,
  PropertyLocationCard,
  PropertyUnitsCard,
} from "./PropertyDetailSections";

export function PropertyDetailView({ propertyId }: { propertyId: string }) {
  const { data: response, isLoading, isFetching, refetch, dataUpdatedAt } = useRealEstatePropertyDetail(propertyId);
  const detail = response?.data;
  const property = detail?.property ?? null;
  const units = Array.isArray(detail?.units) ? detail.units : [];
  const documents = Array.isArray(detail?.documents) ? detail.documents : [];
  const floorMapProjects = Array.isArray(detail?.floor_map_projects) ? detail.floor_map_projects : [];
  const isOffline = Boolean(response && response.status !== "connected");
  const syncedTime = dataUpdatedAt ? new Date(dataUpdatedAt) : new Date();

  if (isLoading && !property) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] flex-col items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin mb-2" />
        <p className="text-sm">Loading property details…</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 sm:gap-6 bg-background p-4 sm:p-6 lg:p-8 pb-12">
        <Link to="/real-estate" className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to Properties
        </Link>
        <RealEstateOfflineBanner
          status={response?.status}
          lastUpdated={response?.last_updated}
          isRetrying={isFetching}
          onRetry={() => void refetch()}
        />
        <Card className="p-10 text-center items-center border-dashed shadow-none">
          <Building2 className="h-9 w-9 text-muted-foreground/50 mx-auto" />
          <h2 className="text-base font-semibold text-foreground">Property not found</h2>
          <p className="text-xs text-muted-foreground">
            This property could not be loaded from the Real Estate service.
          </p>
        </Card>
      </div>
    );
  }

  const st = STATUS_STYLES[property.record_status] ?? STATUS_STYLES.draft;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 bg-background p-4 sm:p-6 lg:p-8 pb-12">
      <header className="shrink-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1.5 min-w-0">
          <Link to="/real-estate" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            All Properties
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">
              {property.property_name || "Unnamed Property"}
            </h1>
            {property.property_reference && (
              <Badge variant="outline" className="font-mono text-xs">
                #{property.property_reference}
              </Badge>
            )}
            <Badge variant="outline" className={st.badge}>
              {st.label}
            </Badge>
            <Badge variant="outline" className="gap-1.5 font-normal">
              <span className={`h-1.5 w-1.5 rounded-full ${isOffline ? "bg-rose-500" : "bg-emerald-500 animate-pulse"}`} />
              {isOffline ? "Offline" : "Live"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{formatPropertyAddress(property)}</p>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching} className="gap-2 self-start sm:self-auto cursor-pointer">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          <span>Refresh</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {syncedTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </Button>
      </header>

      <RealEstateOfflineBanner
        status={response?.status}
        lastUpdated={response?.last_updated}
        isRetrying={isFetching}
        onRetry={() => void refetch()}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <PropertyLocationCard property={property} />
        <PropertyAtAGlanceCard property={property} />
      </div>

      <PropertyUnitsCard units={units} />

      <PropertyFloorPlanSection
        initialProject={detail?.floor_map ?? null}
        projects={floorMapProjects}
      />

      <PropertyDocumentsCard propertyId={property.id} documents={documents} />

      <PropertyFullInfoCard property={property} />
    </div>
  );
}
