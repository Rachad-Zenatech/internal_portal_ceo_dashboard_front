import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { uploadArchiveService } from "@/services/uploadArchiveService";
import type { ArchivedUpload, UploadType } from "@/types/uploadArchive";

type FilterValue = "all" | UploadType;

export default function UploadFiles() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterValue>("all");
  const [previewFile, setPreviewFile] = useState<ArchivedUpload | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selection state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Data fetching with React Query
  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["uploadArchive", filter],
    queryFn: () => uploadArchiveService.list(filter === "all" ? undefined : filter),
  });

  const files = data?.files ?? [];
  const uploadTypes = data?.upload_types ?? [];
  const error = queryError instanceof Error ? queryError.message : null;

  // Derive paginated files
  const paginatedFiles = useMemo(() => {
    const startIdx = (page - 1) * pageSize;
    return files.slice(startIdx, startIdx + pageSize);
  }, [files, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(files.length / pageSize));

  const totals = useMemo(() => {
    return files.reduce(
      (acc, file) => {
        acc.original += file.original_size;
        acc.compressed += file.compressed_size;
        return acc;
      },
      { original: 0, compressed: 0 }
    );
  }, [files]);

  const filterOptions = useMemo(
    () => [{ value: "all" as const, label: "All" }, ...uploadTypes],
    [uploadTypes]
  );

  const handleFilterChange = (newFilter: FilterValue) => {
    setFilter(newFilter);
    setPage(1);
    setSelectedRows(new Set());
  };

  async function handlePreview(file: ArchivedUpload) {
    setPreviewFile(file);
    setPreviewError(null);
    setPreviewText(null);

    if (!isTextPreview(file)) return;

    setIsPreviewLoading(true);
    try {
      const response = await fetch(uploadArchiveService.viewUrl(file.id));
      if (!response.ok) throw new Error("Failed to load preview");
      setPreviewText(await response.text());
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : "Failed to load preview"
      );
    } finally {
      setIsPreviewLoading(false);
    }
  }

  // React Query mutations
  const deleteMutation = useMutation({
    mutationFn: (id: string) => uploadArchiveService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["uploadArchive"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => uploadArchiveService.remove(id))),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["uploadArchive"] });
      setSelectedRows(new Set());
    },
  });

  async function handleDelete(file: ArchivedUpload) {
    const confirmed = window.confirm(`Delete ${file.filename}?`);
    if (!confirmed) return;
    deleteMutation.mutate(file.id);
  }

  async function handleBulkDelete() {
    if (selectedRows.size === 0) return;
    const confirmed = window.confirm(`Delete ${selectedRows.size} selected file(s)?`);
    if (!confirmed) return;
    bulkDeleteMutation.mutate(Array.from(selectedRows));
  }

  const handleSelectAll = (checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      paginatedFiles.forEach((f) => newSelected.add(f.id));
    } else {
      paginatedFiles.forEach((f) => newSelected.delete(f.id));
    }
    setSelectedRows(newSelected);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedRows(newSelected);
  };

  return (
    <main className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">Upload Files</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Manage your uploaded archive files and processing context.
          </p>
        </div>
      </header>

      <div className="flex mb-6 gap-2">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => handleFilterChange(option.value as FilterValue)}
            className={`relative px-6 py-3 text-sm font-semibold transition-colors duration-200 focus:outline-none
              ${filter === option.value
                ? 'text-primary after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-primary'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <Archive className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {(deleteMutation.isError || bulkDeleteMutation.isError) && (
        <Alert variant="destructive">
          <Trash2 className="h-4 w-4" />
          <AlertDescription>
            {deleteMutation.error instanceof Error ? deleteMutation.error.message : bulkDeleteMutation.error instanceof Error ? bulkDeleteMutation.error.message : "Failed to delete files"}
          </AlertDescription>
        </Alert>
      )}

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm rounded-xl overflow-hidden flex flex-col">
        {selectedRows.size > 0 && (
          <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center bg-blue-50/50 dark:bg-blue-900/10">
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              {selectedRows.size} file{selectedRows.size === 1 ? '' : 's'} selected
            </span>
            <Button 
              variant="destructive" 
              size="sm" 
              className="ml-auto h-8 gap-2 shadow-sm"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Selected
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50">
                <TableHead className="w-12 text-center">
                  <Checkbox 
                    checked={paginatedFiles.length > 0 && paginatedFiles.every(f => selectedRows.has(f.id))}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="font-semibold text-slate-900 dark:text-zinc-50">File</TableHead>
                <TableHead className="font-semibold text-slate-900 dark:text-zinc-50">Type</TableHead>
                <TableHead className="font-semibold text-slate-900 dark:text-zinc-50">Context</TableHead>
                <TableHead className="font-semibold text-slate-900 dark:text-zinc-50">Uploaded</TableHead>
                <TableHead className="text-right font-semibold text-slate-900 dark:text-zinc-50">Size</TableHead>
                <TableHead className="text-right font-semibold text-slate-900 dark:text-zinc-50">Stored</TableHead>
                <TableHead className="w-28 text-right font-semibold text-slate-900 dark:text-zinc-50">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-slate-500 dark:text-zinc-400">
                    Loading uploads...
                  </TableCell>
                </TableRow>
              ) : files.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-28 text-center text-slate-500 dark:text-zinc-400"
                  >
                    No uploads found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedFiles.map((file) => (
                  <TableRow key={file.id} className="border-slate-100 dark:border-zinc-800 hover:bg-slate-50/50 dark:bg-zinc-800/50">
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={selectedRows.has(file.id)}
                        onCheckedChange={(c) => handleSelectRow(file.id, !!c)}
                        aria-label={`Select ${file.filename}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="flex items-center gap-2">
                        <FileTypeIcon file={file} />
                        <span className="truncate font-medium text-slate-900 dark:text-zinc-50">
                          {file.filename}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-medium">
                        {file.upload_type_label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-slate-500 dark:text-zinc-400">
                      {getContext(file) || "-"}
                    </TableCell>
                    <TableCell className="text-slate-700 dark:text-zinc-300">
                      {formatDate(file.stored_at)}
                    </TableCell>
                    <TableCell className="text-right text-slate-700 dark:text-zinc-300">
                      {formatBytes(file.original_size)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium text-slate-900 dark:text-zinc-50">
                        {formatBytes(file.compressed_size)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400">
                        {formatCompression(file.compression_percent)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                          onClick={() => void handlePreview(file)}
                          title="View file"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View file</span>
                        </Button>

                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                          title="Download file"
                        >
                          <a href={uploadArchiveService.downloadUrl(file.id)}>
                            <Download className="h-4 w-4" />
                            <span className="sr-only">Download file</span>
                          </a>
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => void handleDelete(file)}
                          title="Delete file"
                          disabled={deleteMutation.isPending && deleteMutation.variables === file.id}
                        >
                          {deleteMutation.isPending && deleteMutation.variables === file.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          <span className="sr-only">Delete file</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col lg:flex-row items-center justify-center p-4 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 gap-8">
          <div className="text-sm text-slate-500 dark:text-zinc-400 text-center">
            {files.length} total file(s). Original {formatBytes(totals.original)} / Stored {formatBytes(totals.compressed)}
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900 dark:text-zinc-50">Rows per page</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-8 w-[70px] border-slate-200 dark:border-zinc-800 text-sm shadow-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm font-medium text-slate-900 dark:text-zinc-50 whitespace-nowrap">
              Page {page} of {totalPages}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 text-slate-500 dark:text-zinc-400 shadow-sm"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 text-slate-500 dark:text-zinc-400 shadow-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 text-slate-500 dark:text-zinc-400 shadow-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 text-slate-500 dark:text-zinc-400 shadow-sm"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={previewFile !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewFile(null);
            setPreviewText(null);
            setPreviewError(null);
          }
        }}
      >
        {previewFile && (
          <DialogContent className="h-[88vh] max-w-[min(1100px,calc(100vw-2rem))] grid-rows-[auto_1fr]">
            <DialogHeader>
              <DialogTitle className="truncate pr-8">
                {previewFile.filename}
              </DialogTitle>
              <DialogDescription>
                {previewFile.upload_type_label} /{" "}
                {formatBytes(previewFile.original_size)}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 overflow-hidden rounded-lg border bg-background">
              {isPdfPreview(previewFile) ? (
                <iframe
                  src={uploadArchiveService.viewUrl(previewFile.id)}
                  title={previewFile.filename}
                  className="h-full w-full border-0"
                />
              ) : isTextPreview(previewFile) ? (
                <pre className="h-full overflow-auto whitespace-pre-wrap p-4 text-xs">
                  {isPreviewLoading
                    ? "Loading preview..."
                    : previewError || previewText}
                </pre>
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
                  Inline preview is not available for this file type.
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </main>
  );
}

function FileTypeIcon({ file }: { file: ArchivedUpload }) {
  if (file.upload_type === "general-ledger") {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-700" />;
  }

  return <FileText className="h-4 w-4 text-sky-700" />;
}

function isPdfPreview(file: ArchivedUpload) {
  return file.content_type === "application/pdf" || file.filename.endsWith(".pdf");
}

function isTextPreview(file: ArchivedUpload) {
  return (
    file.content_type.startsWith("text/") ||
    file.filename.endsWith(".csv") ||
    file.filename.endsWith(".txt")
  );
}

function getContext(file: ArchivedUpload) {
  const values = [
    getMetadataValue(file, "company_name"),
    getMetadataValue(file, "bank_name"),
    getMetadataValue(file, "format_name"),
  ].filter(Boolean);

  return values.join(" / ");
}

function getMetadataValue(file: ArchivedUpload, key: string) {
  const value = file.metadata[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatCompression(percent: number) {
  if (percent > 0) return `${percent}% saved`;
  if (percent < 0) return `${Math.abs(percent)}% larger`;
  return "0% saved";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
