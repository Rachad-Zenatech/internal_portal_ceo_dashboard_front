import { useQuery } from "@tanstack/react-query";
import { apiClient, BASE_URL } from "@/services/apiClient";
import { appStorage } from "@/lib/storage";
import type {
  RealEstateProjectResponse,
  RealEstatePropertiesResponse,
  RealEstatePropertyDetailResponse,
} from "@/types/realEstate";

function getBinaryHeaders(): Record<string, string> {
  const token = appStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchAuthenticatedBlob(apiPath: string): Promise<Blob> {
  const res = await fetch(`${BASE_URL}${apiPath}`, {
    method: "GET",
    credentials: "include",
    headers: getBinaryHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Asset fetch failed (${res.status})`);
  }
  return res.blob();
}

export function fetchRealEstateRenderBlob(renderId: string, format: "png" | "jpg" | "webp" = "png"): Promise<Blob> {
  return fetchAuthenticatedBlob(`/api/v1/ceo/real-estate/renders/${renderId}/image?format=${format}`);
}

export function fetchRealEstateFloorplanBlob(projectId: string): Promise<Blob> {
  return fetchAuthenticatedBlob(`/api/v1/ceo/real-estate/projects/${projectId}/floorplan-image`);
}

export function fetchRealEstateDocumentBlob(
  propertyId: string,
  documentId: string,
  download = false
): Promise<Blob> {
  return fetchAuthenticatedBlob(
    `/api/v1/ceo/real-estate/properties/${propertyId}/documents/${documentId}/file?download=${download}`
  );
}

export function useRealEstateProperties() {
  return useQuery<RealEstatePropertiesResponse>({
    queryKey: ["real-estate", "properties"],
    queryFn: () => apiClient.get<RealEstatePropertiesResponse>("/v1/ceo/real-estate/properties?limit=1000"),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}

export function useRealEstatePropertyDetail(propertyId: string | undefined) {
  return useQuery<RealEstatePropertyDetailResponse>({
    queryKey: ["real-estate", "property", propertyId],
    queryFn: () =>
      apiClient.get<RealEstatePropertyDetailResponse>(`/v1/ceo/real-estate/properties/${propertyId}`),
    enabled: Boolean(propertyId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
}

export function useRealEstateFloorMapProject(projectId: string | undefined, enabled: boolean) {
  return useQuery<RealEstateProjectResponse>({
    queryKey: ["real-estate", "floor-map-project", projectId],
    queryFn: () =>
      apiClient.get<RealEstateProjectResponse>(`/v1/ceo/real-estate/projects/${projectId}`),
    enabled: Boolean(projectId) && enabled,
    staleTime: 60_000,
  });
}
