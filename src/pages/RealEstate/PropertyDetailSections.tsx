import { lazy, Suspense, useState } from "react";
import {
  BedDouble,
  Building2,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Home,
  Mail,
  MapPin,
  MapPinOff,
  Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchRealEstateDocumentBlob } from "@/hooks/useRealEstate";
import type { Property, PropertyDocument, PropertyUnit } from "@/types/realEstate";
import {
  formatArea,
  formatBathrooms,
  formatBytes,
  formatPropertyAddress,
  parseAmenities,
} from "@/types/realEstate";

const PropertyMap = lazy(() => import("./PropertyMap"));

export function PropertyLocationCard({ property }: { property: Property }) {
  const [copied, setCopied] = useState(false);
  const fullAddress = formatPropertyAddress(property);
  const hasCoords = property.latitude != null && property.longitude != null;
  const mapsQuery = hasCoords ? `${property.latitude},${property.longitude}` : encodeURIComponent(fullAddress);
  const googleMapsUrl = `https://www.google.com/maps?q=${mapsQuery}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(fullAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <Card>
      <CardHeader className="items-center">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Location &amp; Map
        </CardTitle>
        <CardAction>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs cursor-pointer" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy Address"}
            </Button>
            <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs">
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Maps
              </a>
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-[280px] overflow-hidden rounded-xl border border-border bg-muted/20">
          {hasCoords ? (
            <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
              <PropertyMap properties={[property]} compact />
            </Suspense>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
              <MapPinOff className="h-7 w-7" />
              <p className="text-sm font-medium text-foreground">No map location yet</p>
              <p className="max-w-xs text-xs">Coordinates are filled in when the property is added from a selected address.</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{fullAddress}</span>
          {hasCoords && (
            <Badge variant="secondary" className="font-mono text-[11px] font-normal shrink-0">
              {Number(property.latitude).toFixed(5)}, {Number(property.longitude).toFixed(5)}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PropertyAtAGlanceCard({ property }: { property: Property }) {
  const rows: { label: string; value: string }[] = [
    { label: "Property Type", value: property.property_type || "—" },
    { label: "Holding Type", value: property.holding_type ? property.holding_type.charAt(0).toUpperCase() + property.holding_type.slice(1) : "—" },
    { label: "Bedrooms", value: property.bedrooms != null ? `${property.bedrooms}${property.dens ? ` + ${property.dens} den` : ""}` : "—" },
    { label: "Bathrooms", value: formatBathrooms(property) },
    { label: "Unit Area", value: formatArea(property.unit_area, property.unit_area_unit) },
    { label: "Land Area", value: formatArea(property.land_area, property.land_area_unit) },
    { label: "Floor", value: property.floor_number ? `${property.floor_number}${property.building_total_floors ? ` of ${property.building_total_floors}` : ""}` : "—" },
    { label: "Year Built", value: property.year_built != null ? String(property.year_built) : "—" },
    { label: "Parking", value: property.parking_spaces != null ? `${property.parking_spaces}${property.parking_type ? ` (${property.parking_type})` : ""}` : property.parking_type || "—" },
    { label: "Furnished", value: property.furnished_status ? property.furnished_status.charAt(0).toUpperCase() + property.furnished_status.slice(1) : "—" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="h-4 w-4 text-muted-foreground" />
          At a Glance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <dt className="text-[11px] font-medium text-muted-foreground">{row.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-foreground truncate">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export function PropertyUnitsCard({ units }: { units: PropertyUnit[] }) {
  if (units.length === 0) return null;

  return (
    <Card>
      <CardHeader className="items-center">
        <CardTitle className="flex items-center gap-2">
          <BedDouble className="h-4 w-4 text-muted-foreground" />
          Stays &amp; Availability Units
        </CardTitle>
        <CardAction>
          <Badge variant="secondary" className="font-normal">
            {units.length} {units.length === 1 ? "unit" : "units"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {units.map((u) => {
            const available = Boolean(u.is_available_today);
            return (
              <div key={u.id} className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {u.unit_name || `Unit ${u.unit_number}`}
                  </p>
                  <Badge variant={available ? "outline" : "secondary"} className="text-[10px]">
                    {available ? "Available today" : u.status || "Occupied"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {u.unit_type && <span>{u.unit_type}</span>}
                  {u.bedrooms != null && <span>{u.bedrooms} bed</span>}
                  {u.guest_capacity != null && <span>Up to {u.guest_capacity} guests</span>}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function PropertyDocumentsCard({
  propertyId,
  documents,
}: {
  propertyId: string;
  documents: PropertyDocument[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const openDocument = async (doc: PropertyDocument, download: boolean) => {
    setBusyId(doc.id);
    try {
      const blob = await fetchRealEstateDocumentBlob(propertyId, doc.id, download);
      const url = URL.createObjectURL(blob);
      if (download) {
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.file_name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="items-center">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Property Documents
        </CardTitle>
        <CardAction>
          <Badge variant="secondary" className="font-normal">{documents.length}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center rounded-lg border border-dashed border-border bg-muted/10">
            No documents uploaded for this property.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-card hover:bg-muted/30">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button type="button" variant="ghost" size="sm" disabled={busyId === doc.id} className="h-8 gap-1 text-xs cursor-pointer" onClick={() => openDocument(doc, false)}>
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={busyId === doc.id} className="h-8 gap-1 text-xs cursor-pointer" onClick={() => openDocument(doc, true)}>
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground break-words">{display}</p>
    </div>
  );
}

function AddressSection({ property }: { property: Property }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-lg border border-border bg-muted/15 p-4">
        <DetailField label="Street number" value={property.street_number} />
        <DetailField label="Street name" value={property.street_name} />
        <DetailField label="Unit / apartment" value={property.unit_number} />
        <DetailField label="Building / development" value={property.building_name} />
        <DetailField label="District / neighbourhood" value={property.district_neighbourhood} />
        <DetailField label="City" value={property.city} />
        <DetailField label="State / province / region" value={property.state_province_region} />
        <DetailField label="Postal code" value={property.postal_code} />
        <DetailField label="Country code" value={property.country_code} />
      </div>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground gap-1 cursor-pointer">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            Geocoding &amp; standardized address
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-lg border border-border bg-muted/15 p-4">
            <DetailField label="Standardized address" value={property.address_formatted} />
            <DetailField label="Address as entered" value={property.address_original} />
            <DetailField label="Latitude" value={property.latitude} />
            <DetailField label="Longitude" value={property.longitude} />
            <DetailField label="Geocoding provider" value={property.geocoding_provider} />
            <DetailField label="Geocoding ID" value={property.geocoding_id} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function SpecificationsSection({ property }: { property: Property }) {
  const amenities = parseAmenities(property.amenities);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Specifications &amp; Amenities</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-lg border border-border bg-muted/15 p-4">
        <DetailField label="Bedrooms" value={property.bedrooms} />
        <DetailField label="Dens" value={property.dens} />
        <DetailField label="Full bathrooms" value={property.full_bathrooms} />
        <DetailField label="Half bathrooms" value={property.half_bathrooms} />
        <DetailField label="Floor number" value={property.floor_number} />
        <DetailField label="Building total floors" value={property.building_total_floors} />
        <DetailField label="Year built" value={property.year_built} />
        <DetailField label="Unit area" value={formatArea(property.unit_area, property.unit_area_unit)} />
        <DetailField label="Building floor area" value={formatArea(property.building_floor_area, property.building_floor_area_unit)} />
        <DetailField label="Land area" value={formatArea(property.land_area, property.land_area_unit)} />
        <DetailField label="Parking spaces" value={property.parking_spaces} />
        <DetailField label="Parking type" value={property.parking_type} />
        <DetailField label="Storage details" value={property.storage_details} />
        <DetailField label="Heating type" value={property.heating_type} />
        <DetailField label="Cooling type" value={property.cooling_type} />
      </div>
      {amenities.length > 0 && (
        <div className="pt-1 flex flex-wrap gap-1.5">
          {amenities.map((amenity) => (
            <Badge key={amenity} variant="secondary" className="font-normal">
              {amenity}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function ManagementSection({ property }: { property: Property }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Building Management</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 rounded-lg border border-border bg-muted/15 p-4">
        <DetailField label="Building management" value={property.building_management} />
        <div>
          <p className="text-xs font-medium text-muted-foreground">Phone</p>
          {property.management_phone ? (
            <a href={`tel:${property.management_phone}`} className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Phone className="h-3.5 w-3.5" />
              {property.management_phone}
            </a>
          ) : (
            <p className="mt-0.5 text-sm text-foreground">—</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Email</p>
          {property.management_email ? (
            <a href={`mailto:${property.management_email}`} className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-primary hover:underline break-all">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {property.management_email}
            </a>
          ) : (
            <p className="mt-0.5 text-sm text-foreground">—</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Website</p>
          {property.management_website ? (
            <a
              href={property.management_website.startsWith("http") ? property.management_website : `https://${property.management_website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-primary hover:underline break-all"
            >
              <Globe className="h-3.5 w-3.5 shrink-0" />
              {property.management_website}
            </a>
          ) : (
            <p className="mt-0.5 text-sm text-foreground">—</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function PropertyFullInfoCard({ property }: { property: Property }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Property Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identity</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-lg border border-border bg-muted/15 p-4">
            <DetailField label="Property name" value={property.property_name} />
            <DetailField label="Internal reference" value={property.property_reference} />
            <DetailField label="Property type" value={property.property_type} />
            <DetailField label="Holding type" value={property.holding_type} />
            <DetailField label="Record status" value={property.record_status} />
            <DetailField label="Parcel / title number" value={property.parcel_title_number} />
          </div>
        </div>
        <AddressSection property={property} />
        <SpecificationsSection property={property} />
        <ManagementSection property={property} />
      </CardContent>
    </Card>
  );
}
