export type RecordStatus = "draft" | "active" | "archived";
export type AreaUnit = "sqft" | "sqm" | "acres" | "hectares" | "tsubo";

export interface Property {
  id: string;
  property_name: string | null;
  property_reference: string | null;
  property_type: string | null;
  holding_type: string | null;
  record_status: RecordStatus;
  address_original: string | null;
  address_formatted: string | null;
  country_code: string | null;
  state_province_region: string | null;
  city: string | null;
  district_neighbourhood: string | null;
  postal_code: string | null;
  street_number: string | null;
  street_name: string | null;
  unit_number: string | null;
  building_name: string | null;
  latitude: number | null;
  longitude: number | null;
  geocoding_provider: string | null;
  geocoding_id: string | null;
  bedrooms: number | null;
  dens: number | null;
  full_bathrooms: number | null;
  half_bathrooms: number | null;
  floor_number: string | null;
  building_total_floors: number | null;
  year_built: number | null;
  unit_area: number | null;
  unit_area_unit: AreaUnit | null;
  building_floor_area: number | null;
  building_floor_area_unit: AreaUnit | null;
  land_area: number | null;
  land_area_unit: AreaUnit | null;
  parking_spaces: number | null;
  parking_type: string | null;
  storage_details: string | null;
  furnished_status: string | null;
  heating_type: string | null;
  cooling_type: string | null;
  amenities: string[] | string | null;
  parcel_title_number: string | null;
  building_management: string | null;
  management_phone: string | null;
  management_email: string | null;
  management_website: string | null;
  document_count?: number;
  created_at: string;
  updated_at: string;
}

export interface PropertyDocument {
  id: string;
  property_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface PropertyUnit {
  id: string;
  property_id: string;
  unit_number: string;
  unit_name?: string | null;
  unit_type?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  guest_capacity?: number | null;
  status?: string | null;
  is_bookable?: boolean;
  is_available_today?: boolean;
  floor?: string | null;
  notes?: string | null;
}

export interface WallMeshPolygon {
  outer: [number, number][];
  holes: [number, number][][];
}

export interface WallMeshData {
  kind: "wall_mesh";
  aspect: number;
  wall_height: number;
  polygons: WallMeshPolygon[];
}

export interface FloorMapRender {
  id: string;
  project_id: string;
  render_type: "2d" | "3d" | string;
  image_mime_type: string;
  image_rotation?: number | null;
  prompt_used?: string | null;
  model_used?: string | null;
  revision_number: number;
  improvement_notes?: string | null;
  scene_json?: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
}

export interface FloorMapProject {
  id: string;
  title: string;
  property_id?: string | null;
  status: string;
  has_floorplan_image?: boolean;
  analysis_json?: Record<string, unknown> | null;
  scene_json?: Record<string, unknown> | null;
  renders?: FloorMapRender[];
  created_at: string;
  updated_at: string;
}

export type IntegrationStatus = "connected" | "stale" | "disconnected" | "timeout";

export interface RealEstatePropertiesResponse {
  status: IntegrationStatus;
  data: {
    items: Property[];
    total: number;
  };
  last_updated: string | null;
  error: string | null;
}

export interface RealEstatePropertyDetailData {
  property: Property | null;
  units: PropertyUnit[];
  documents: PropertyDocument[];
  floor_map: FloorMapProject | null;
  floor_map_projects: FloorMapProject[];
}

export interface RealEstatePropertyDetailResponse {
  status: IntegrationStatus;
  data: RealEstatePropertyDetailData;
  last_updated: string | null;
  error: string | null;
}

export interface RealEstateProjectResponse {
  status: IntegrationStatus;
  data: FloorMapProject | null;
  last_updated: string | null;
  error: string | null;
}

const AREA_LABELS: Record<string, string> = {
  sqft: "sq ft",
  sqm: "m²",
  acres: "acres",
  hectares: "hectares",
  tsubo: "tsubo",
};

export function formatPropertyAddress(p: Partial<Property>): string {
  if (p.address_formatted) return p.address_formatted;
  const street = [p.street_number, p.street_name].filter(Boolean).join(" ");
  const unit = p.unit_number ? `Unit ${p.unit_number}` : null;
  const region = [p.state_province_region, p.postal_code].filter(Boolean).join(" ");
  const parts = [street, unit, p.city, region, p.country_code].filter(Boolean);
  return parts.join(", ") || p.address_original || "—";
}

export function formatArea(value: number | null | undefined, unit: AreaUnit | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const label = unit ? AREA_LABELS[unit] || unit : "sq ft";
  return `${Number(value).toLocaleString()} ${label}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isWallMesh(scene: unknown): scene is WallMeshData {
  return (
    Boolean(scene) &&
    typeof scene === "object" &&
    (scene as WallMeshData).kind === "wall_mesh" &&
    Array.isArray((scene as WallMeshData).polygons) &&
    (scene as WallMeshData).polygons.length > 0
  );
}

export function parseAmenities(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
        }
      } catch {
        // Fall through to delimiter split
      }
    }
    return trimmed
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function formatBathrooms(p: Partial<Property>): string {
  const full = p.full_bathrooms ?? 0;
  const half = p.half_bathrooms ?? 0;
  if (p.full_bathrooms == null && p.half_bathrooms == null) return "—";
  return half > 0 ? `${full}.${half}` : String(full);
}

export const STATUS_STYLES: Record<RecordStatus, { badge: string; bar: string; label: string }> = {
  active: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    bar: "bg-emerald-500",
    label: "Active",
  },
  draft: {
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    bar: "bg-amber-400",
    label: "Draft",
  },
  archived: {
    badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
    bar: "bg-slate-300 dark:bg-zinc-600",
    label: "Archived",
  },
};
