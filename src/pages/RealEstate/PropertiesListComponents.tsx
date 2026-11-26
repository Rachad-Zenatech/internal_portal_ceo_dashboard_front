import { useEffect, useRef } from "react";
import {
  Archive,
  Bath,
  BedDouble,
  Building2,
  Calendar,
  ChevronRight,
  FileWarning,
  Globe2,
  Home,
  MapPin,
  Maximize2,
  Paperclip,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard } from "@/components/Dashboard/KpiCard";
import type { Property } from "@/types/realEstate";
import {
  STATUS_STYLES,
  formatArea,
  formatBathrooms,
  formatPropertyAddress,
} from "@/types/realEstate";

export function PropertyStatCards({
  properties,
  loading,
}: {
  properties: Property[];
  loading?: boolean;
}) {
  const activeCount = properties.filter((p) => p.record_status === "active").length;
  const draftCount = properties.filter((p) => p.record_status === "draft").length;
  const archivedCount = properties.filter((p) => p.record_status === "archived").length;
  const cities = new Set(properties.map((p) => p.city?.trim()).filter(Boolean)).size;
  const countries = new Set(properties.map((p) => p.country_code?.trim().toUpperCase()).filter(Boolean)).size;

  return (
    <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Properties" value={properties.length} hint={`${activeCount} active`} icon={<Building2 className="h-4 w-4" />} tone="indigo" loading={loading} />
      <KpiCard label="Active" value={activeCount} hint={`${archivedCount} archived`} icon={<Archive className="h-4 w-4" />} tone="emerald" loading={loading} />
      <KpiCard label="Drafts to review" value={draftCount} hint={draftCount > 0 ? "Pending verification" : "All verified"} icon={<FileWarning className="h-4 w-4" />} tone="amber" loading={loading} />
      <KpiCard label="Locations" value={cities} hint={`${countries} ${countries === 1 ? "country" : "countries"}`} icon={<Globe2 className="h-4 w-4" />} tone="blue" loading={loading} />
    </div>
  );
}

function PropertyCardStats({ property }: { property: Property }) {
  const attachmentCount = Number(property.document_count ?? 0);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 rounded-lg border border-border bg-muted/35 px-2.5 py-2 text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground" title="Bedrooms">
        <BedDouble className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium text-foreground tabular-nums">{property.bedrooms ?? "—"}</span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground" title="Bathrooms">
        <Bath className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium text-foreground tabular-nums">{formatBathrooms(property)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground" title="Unit Area">
        <Maximize2 className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium text-foreground truncate tabular-nums">{formatArea(property.unit_area, property.unit_area_unit)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground" title="Year Built">
        <Calendar className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium text-foreground tabular-nums">{property.year_built ?? "—"}</span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground" title={`${attachmentCount} uploaded ${attachmentCount === 1 ? "attachment" : "attachments"}`}>
        <Paperclip className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium text-foreground tabular-nums">{attachmentCount}</span>
      </div>
    </div>
  );
}

function PropertyCard({ property, onSelect }: { property: Property; onSelect: (id: string) => void }) {
  const st = STATUS_STYLES[property.record_status] ?? STATUS_STYLES.draft;
  const locationLine = [property.city, property.state_province_region, property.country_code]
    .filter(Boolean)
    .join(", ");

  return (
    <Card
      size="sm"
      role="button"
      tabIndex={0}
      onClick={() => onSelect(property.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(property.id);
        }
      }}
      className="group cursor-pointer justify-between transition-colors hover:border-foreground/25 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardHeader>
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-muted/50 text-muted-foreground">
            <Home className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate text-sm font-semibold group-hover:text-primary transition-colors">
              {property.property_name || "Unnamed Property"}
            </CardTitle>
            <CardDescription className="line-clamp-2 text-xs mt-0.5">
              {formatPropertyAddress(property)}
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant="outline" className={st.badge}>
            {st.label}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3">
        {locationLine && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{locationLine}</span>
          </div>
        )}

        <PropertyCardStats property={property} />
      </CardContent>

      <CardFooter className="justify-between py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {property.property_reference && (
            <Badge variant="outline" className="font-mono text-[10px]">
              #{property.property_reference}
            </Badge>
          )}
          {property.property_type && (
            <Badge variant="secondary" className="text-[11px] font-normal max-w-[150px] truncate">
              {property.property_type}
            </Badge>
          )}
        </div>
        <span className="inline-flex items-center gap-0.5 font-medium text-muted-foreground group-hover:text-foreground shrink-0">
          Details
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </CardFooter>
    </Card>
  );
}

export function PropertyCardGrid({
  properties,
  onSelect,
}: {
  properties: Property[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {properties.map((p) => (
        <PropertyCard key={p.id} property={p} onSelect={onSelect} />
      ))}
    </div>
  );
}

function PropertyTableRow({ property, onSelect }: { property: Property; onSelect: (id: string) => void }) {
  const st = STATUS_STYLES[property.record_status] ?? STATUS_STYLES.draft;
  return (
    <TableRow onClick={() => onSelect(property.id)} className="cursor-pointer">
      <TableCell className="sticky left-0 z-10 bg-card font-medium text-foreground whitespace-nowrap border-r border-border/50">
        <div className="flex items-center gap-2">
          <span>{property.property_name || "Unnamed Property"}</span>
          {property.property_reference && (
            <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
              {property.property_reference}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{property.street_number || "—"}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{property.street_name || "—"}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{property.unit_number || "—"}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{property.city || "—"}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{property.state_province_region || "—"}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{property.postal_code || "—"}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{property.country_code || "—"}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{property.property_type || "—"}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap capitalize">{property.holding_type || "—"}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">{property.bedrooms ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">{formatBathrooms(property)}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
        {formatArea(property.unit_area, property.unit_area_unit)}
      </TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">{property.year_built ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{property.building_management || "—"}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{property.management_phone || "—"}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{property.management_email || "—"}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap max-w-[180px] truncate">
        {property.management_website || "—"}
      </TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
        <span className="inline-flex items-center gap-1">
          <Paperclip className="h-3.5 w-3.5" />
          {Number(property.document_count ?? 0)}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge variant="outline" className={st.badge}>
          {st.label}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

const TABLE_HEADERS = [
  "Property", "Street number", "Street", "Unit", "City", "State", "Postal code", "Country",
  "Type", "Holding", "Beds", "Baths", "Unit area", "Year built", "Building management",
  "Phone", "Email", "Website", "Attachments", "Status",
];

export function PropertiesTableView({
  properties,
  totalCount,
  hasMore,
  onLoadMore,
  onSelect,
}: {
  properties: Property[];
  totalCount: number;
  hasMore: boolean;
  onLoadMore: () => void;
  onSelect: (id: string) => void;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, properties.length]);

  return (
    <Card className="gap-0 py-0 overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            {TABLE_HEADERS.map((h, i) => (
              <TableHead
                key={h}
                className={i === 0 ? "sticky left-0 z-20 bg-muted/95 border-r border-border/60" : ""}
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map((p) => (
            <PropertyTableRow key={p.id} property={p} onSelect={onSelect} />
          ))}
        </TableBody>
      </Table>
      <div ref={sentinelRef} className="flex items-center justify-between px-4 py-2.5 border-t border-border text-xs text-muted-foreground bg-muted/20">
        <span>Showing {properties.length} of {totalCount} properties</span>
        {hasMore && (
          <Button type="button" variant="link" size="sm" onClick={onLoadMore} className="h-auto p-0 text-xs cursor-pointer">
            Load more
          </Button>
        )}
      </div>
    </Card>
  );
}
