import { apiClient, BASE_URL } from "./apiClient";
import type { UploadFilesResponse, UploadType } from "@/types/uploadArchive";

export const uploadArchiveService = {
  async list(uploadType?: UploadType): Promise<UploadFilesResponse> {
    const params = uploadType ? `?upload_type=${encodeURIComponent(uploadType)}` : "";
    return apiClient.get<UploadFilesResponse>(`/upload-files${params}`);
  },

  async remove(fileId: string): Promise<void> {
    await apiClient.delete<void>(`/upload-files/${fileId}`);
  },

  viewUrl(fileId: string): string {
    return `${BASE_URL}/api/upload-files/${fileId}/view`;
  },

  downloadUrl(fileId: string): string {
    return `${BASE_URL}/api/upload-files/${fileId}/download`;
  },
};
