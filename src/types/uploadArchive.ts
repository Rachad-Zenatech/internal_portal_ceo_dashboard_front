export type UploadType = "general-ledger" | "bank-statement";

export type UploadTypeOption = {
  value: UploadType;
  label: string;
};

export type ArchivedUpload = {
  id: string;
  upload_type: UploadType;
  upload_type_label: string;
  filename: string;
  content_type: string;
  original_size: number;
  compressed_size: number;
  compression_percent: number;
  stored_at: string;
  storage: string;
  metadata: Record<string, unknown>;
};

export type UploadFilesResponse = {
  upload_types: UploadTypeOption[];
  files: ArchivedUpload[];
};
