import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ArchivedUpload } from "@/types/uploadArchive";
import { isPreviewableFile } from "./UploadFilePreviewDialog";

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FileTypeIcon({ file }: { file: ArchivedUpload }) {
  const ext = file.filename.split(".").pop()?.toLowerCase() ?? "";
  if (["csv", "xlsx", "xls"].includes(ext)) {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  }
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
    return <FileImage className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />;
  }
  return <FileText className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function getContext(file: ArchivedUpload): string {
  const meta = file.metadata || {};
  const parts: string[] = [];
  if (meta.company_id) parts.push(`Company: ${String(meta.company_id)}`);
  if (meta.entity_id) parts.push(`Entity: ${String(meta.entity_id)}`);
  if (meta.notes) parts.push(String(meta.notes));
  return parts.join(" · ") || "—";
}

interface Props {
  files: ArchivedUpload[];
  totalFiltered: number;
  isLoading: boolean;
  page: number;
  totalPages: number;
  pageSize: number;
  selectedRows: Set<string>;
  downloadingId: string | null;
  isDeleting: boolean;
  onPageChange: (page: number) => void;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onPreview: (file: ArchivedUpload) => void;
  onDownload: (file: ArchivedUpload) => void;
  onDelete: (file: ArchivedUpload) => void;
  onBulkDelete: () => void;
  onOpenUpload: () => void;
}

function UploadRow({
  file,
  selected,
  downloading,
  isDeleting,
  onSelect,
  onPreview,
  onDownload,
  onDelete,
}: {
  file: ArchivedUpload;
  selected: boolean;
  downloading: boolean;
  isDeleting: boolean;
  onSelect: (checked: boolean) => void;
  onPreview: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  return (
    <TableRow>
      <TableCell className="w-10 text-center">
        <Checkbox checked={selected} onCheckedChange={(c) => onSelect(Boolean(c))} aria-label={`Select ${file.filename}`} />
      </TableCell>
      <TableCell className="max-w-[280px]">
        <div className="flex items-center gap-2">
          <FileTypeIcon file={file} />
          <span className="truncate font-medium text-foreground">{file.filename}</span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge variant="outline" className="text-[11px] font-normal">
          {file.upload_type_label || file.upload_type}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge variant="secondary" className="text-[10px] font-normal uppercase">
          {file.storage === "s3" ? "S3" : "Local"}
        </Badge>
      </TableCell>
      <TableCell className="max-w-[240px] truncate text-muted-foreground text-xs">{getContext(file)}</TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">{formatDate(file.stored_at)}</TableCell>
      <TableCell className="text-right whitespace-nowrap text-xs font-mono tabular-nums">{formatBytes(file.original_size)}</TableCell>
      <TableCell className="text-right whitespace-nowrap text-xs font-mono tabular-nums">{formatBytes(file.compressed_size)}</TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1">
          {isPreviewableFile(file) && (
            <Button variant="ghost" size="icon-xs" onClick={onPreview} title="Preview file" className="cursor-pointer">
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon-xs" onClick={onDownload} disabled={downloading} title="Download file" className="cursor-pointer">
            <Download className={`h-3.5 w-3.5 ${downloading ? "animate-pulse" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onDelete} disabled={isDeleting} title="Delete file" className="cursor-pointer text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function EmptyUploadsRow({ onOpenUpload }: { onOpenUpload: () => void }) {
  return (
    <TableRow>
      <TableCell colSpan={9} className="py-12 text-center">
        <div className="flex flex-col items-center gap-2">
          <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">No archived files found</p>
          <p className="text-xs text-muted-foreground">Upload a spreadsheet, statement, report, or document to get started.</p>
          <Button type="button" size="sm" variant="outline" onClick={onOpenUpload} className="mt-1 cursor-pointer">
            Upload Files
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function TablePaginationBar({
  page,
  totalPages,
  pageSize,
  totalFiltered,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  totalFiltered: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
      <span>
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalFiltered)} of {totalFiltered}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-xs" onClick={() => onPageChange(1)} disabled={page === 1}><ChevronsLeft className="h-3.5 w-3.5" /></Button>
        <Button variant="outline" size="icon-xs" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}><ChevronLeft className="h-3.5 w-3.5" /></Button>
        <span className="px-2 font-medium text-foreground">Page {page} of {totalPages}</span>
        <Button variant="outline" size="icon-xs" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}><ChevronRight className="h-3.5 w-3.5" /></Button>
        <Button variant="outline" size="icon-xs" onClick={() => onPageChange(totalPages)} disabled={page === totalPages}><ChevronsRight className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

export function UploadFilesTable({
  files,
  totalFiltered,
  isLoading,
  page,
  totalPages,
  pageSize,
  selectedRows,
  downloadingId,
  isDeleting,
  onPageChange,
  onSelectAll,
  onSelectRow,
  onPreview,
  onDownload,
  onDelete,
  onBulkDelete,
  onOpenUpload,
}: Props) {
  return (
    <Card className="gap-0 py-0 overflow-hidden">
      {selectedRows.size > 0 && (
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2.5">
          <span className="text-xs font-medium text-foreground">
            {selectedRows.size} file{selectedRows.size === 1 ? "" : "s"} selected
          </span>
          <Button variant="destructive" size="sm" className="h-7 gap-1.5 text-xs cursor-pointer" onClick={onBulkDelete} disabled={isDeleting}>
            {isDeleting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Delete Selected
          </Button>
        </div>
      )}

      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-10 text-center">
              <Checkbox
                checked={files.length > 0 && files.every((f) => selectedRows.has(f.id))}
                onCheckedChange={(c) => onSelectAll(Boolean(c))}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>File Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Storage</TableHead>
            <TableHead>Context / Notes</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="text-right">Original</TableHead>
            <TableHead className="text-right">Stored</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [0, 1, 2, 3, 4].map((i) => (
              <TableRow key={i}>
                <TableCell colSpan={9} className="py-3">
                  <Skeleton className="h-5 w-full rounded" />
                </TableCell>
              </TableRow>
            ))
          ) : files.length === 0 ? (
            <EmptyUploadsRow onOpenUpload={onOpenUpload} />
          ) : (
            files.map((file) => (
              <UploadRow
                key={file.id}
                file={file}
                selected={selectedRows.has(file.id)}
                downloading={downloadingId === file.id}
                isDeleting={isDeleting}
                onSelect={(c) => onSelectRow(file.id, c)}
                onPreview={() => onPreview(file)}
                onDownload={() => onDownload(file)}
                onDelete={() => onDelete(file)}
              />
            ))
          )}
        </TableBody>
      </Table>

      <TablePaginationBar
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        totalFiltered={totalFiltered}
        onPageChange={onPageChange}
      />
    </Card>
  );
}
