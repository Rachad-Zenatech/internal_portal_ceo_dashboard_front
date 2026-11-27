import { apiClient, BASE_URL } from "./apiClient";
import { appStorage } from "@/lib/storage";
import type { UploadCreateResponse, UploadFilesResponse, UploadType } from "@/types/uploadArchive";

function getBinaryHeaders(): Record<string, string> {
  const token = appStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchBlob(path: string): Promise<Blob> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    credentials: "include",
    headers: getBinaryHeaders(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `File request failed (${res.status})`);
  }
  return res.blob();
}

export const uploadArchiveService = {
  async list(uploadType?: UploadType): Promise<UploadFilesResponse> {
    const params = uploadType ? `?upload_type=${encodeURIComponent(uploadType)}` : "";
    return apiClient.get<UploadFilesResponse>(`/upload-files${params}`);
  },

  async upload(
    files: File[],
    uploadType: UploadType,
    metadata?: { company_id?: string; notes?: string }
  ): Promise<UploadCreateResponse> {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    form.append("upload_type", uploadType);
    if (metadata?.company_id?.trim()) form.append("company_id", metadata.company_id.trim());
    if (metadata?.notes?.trim()) form.append("notes", metadata.notes.trim());
    return apiClient.post<UploadCreateResponse>("/upload-files", form, { timeoutMs: 60_000 });
  },

  async remove(fileId: string): Promise<void> {
    await apiClient.delete<void>(`/upload-files/${fileId}`);
  },

  fetchViewBlob(fileId: string): Promise<Blob> {
    return fetchBlob(`/api/upload-files/${fileId}/view`);
  },

  fetchDownloadBlob(fileId: string): Promise<Blob> {
    return fetchBlob(`/api/upload-files/${fileId}/download`);
  },

  viewUrl(fileId: string): string {
    return `${BASE_URL}/api/upload-files/${fileId}/view`;
  },

  downloadUrl(fileId: string): string {
    return `${BASE_URL}/api/upload-files/${fileId}/download`;
  },
};
