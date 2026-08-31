import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
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
  FolderArchive,
  HardDrive,
  Search,
  CheckCircle2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { WidgetErrorBoundary } from "@/components/WidgetErrorBoundary";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
} from "@/components/ui/table";
import { uploadArchiveService } from "@/services/uploadArchiveService";
import type { ArchivedUpload, UploadType } from "@/types/uploadArchive";
import { toast } from "sonner";

type FilterValue = "all" | UploadType;

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isTextPreview(file: ArchivedUpload) {
  const ext = file.filename.split(".").pop()?.toLowerCase();
  return ext === "csv" || ext === "txt" || ext === "json";
}

function FileTypeIcon({ file }: { file: ArchivedUpload }) {
  const ext = file.filename.split(".").pop()?.toLowerCase();
  if (ext === "csv" || ext === "xlsx" || ext === "xls") {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  }
  return <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />;
}

function getContext(file: ArchivedUpload) {
  const parts: string[] = [];
  const meta = file.metadata || {};
  const companyId = (file as any).company_id || meta.company_id || meta.company;
  const entityId = (file as any).entity_id || meta.entity_id || meta.entity;
  if (companyId) parts.push(`Company: ${companyId}`);
  if (entityId) parts.push(`Entity: ${entityId}`);
  return parts.join(" • ");
}

export default function UploadFiles() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterValue>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [previewFile, setPreviewFile] = useState<ArchivedUpload | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Selection state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Data fetching with React Query
  const {
    data,
    isLoading,
    isFetching,
    refetch,

  } = useQuery({
    queryKey: ["uploadArchive", filter],
    queryFn: () => uploadArchiveService.list(filter === "all" ? undefined : filter),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const files = Array.isArray(data?.files) ? data.files : [];
  const uploadTypes = Array.isArray(data?.upload_types) ? data.upload_types : [];

  // Filter files by search term
  const filteredFiles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => {
      return (
        f.filename.toLowerCase().includes(q) ||
        (f.upload_type_label || "").toLowerCase().includes(q) ||
        String((f as any).company_id || f.metadata?.company_id || "").toLowerCase().includes(q) ||
        String((f as any).entity_id || f.metadata?.entity_id || "").toLowerCase().includes(q)
      );
    });
  }, [files, searchTerm]);

  // Derive paginated files
  const paginatedFiles = useMemo(() => {
    const startIdx = (page - 1) * pageSize;
    return filteredFiles.slice(startIdx, startIdx + pageSize);
  }, [filteredFiles, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / pageSize));
  const safePage = Math.min(page, totalPages);

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

  const compressionSavingsRatio = useMemo(() => {
    if (totals.original === 0) return 0;
    const saved = Math.max(0, totals.original - totals.compressed);
    return Math.round((saved / totals.original) * 100);
  }, [totals]);

  const filterOptions = useMemo(
    () => [{ value: "all" as const, label: "All Files" }, ...uploadTypes],
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
      toast.success("File archive deleted successfully");
      void queryClient.invalidateQueries({ queryKey: ["uploadArchive"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete file");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => uploadArchiveService.remove(id))),
    onSuccess: () => {
      toast.success("Selected archives deleted successfully");
      void queryClient.invalidateQueries({ queryKey: ["uploadArchive"] });
      setSelectedRows(new Set());
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete files");
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
    <div className="w-full flex flex-col gap-4 sm:gap-5 p-4 sm:p-6 lg:p-7 min-h-screen bg-slate-50/40 dark:bg-zinc-950 transition-colors">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-3 border-b border-slate-200/80 dark:border-zinc-800/80">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 flex items-center gap-2.5">
              <FolderArchive className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Upload Files & Archives
            </h1>
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Archive Storage Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Manage your uploaded accounting spreadsheets, bank statements, transaction batches, and compressed processing context.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs h-9 px-3.5 rounded-xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 gap-1.5 transition-all shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-indigo-600" : ""}`} />
            <span>Sync Feeds</span>
          </Button>
        </div>
      </div>

      {/* 2 Executive KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Total Archives Card */}
        <WidgetErrorBoundary widgetName="Total Archives">
          <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:shadow-xs transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Total File Archives
                </span>
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <FolderArchive className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5">
                {isLoading ? (
                  <div className="space-y-2 py-0.5">
                    <Skeleton className="h-7 w-24 rounded-lg" />
                    <Skeleton className="h-3.5 w-36 rounded" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100">
                        {files.length}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                        files stored
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {uploadTypes.length} distinct processing categories
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>

        {/* Compressed Storage Card */}
        <WidgetErrorBoundary widgetName="Compressed Storage">
          <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:shadow-xs transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Storage Footprint
                </span>
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <HardDrive className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5">
                {isLoading ? (
                  <div className="space-y-2 py-0.5">
                    <Skeleton className="h-7 w-28 rounded-lg" />
                    <Skeleton className="h-3.5 w-40 rounded" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatBytes(totals.compressed)}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-zinc-400">
                        (orig: {formatBytes(totals.original)})
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {compressionSavingsRatio}% compression reduction
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>
      </div>



      {/* Main Section */}
      <WidgetErrorBoundary widgetName="Upload Files Table" onReset={() => refetch()}>
        <div className="space-y-3 outline-none">
          {/* Controls Bar: Filter Pills & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
            {/* Filter Pills Toggle */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-lg shrink-0">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleFilterChange(option.value as FilterValue)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    filter === option.value
                      ? "bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-300 shadow-2xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search files, context, tags..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="h-8 pl-8 text-xs bg-slate-50/60 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-lg w-full"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs overflow-hidden">
            {/* Bulk Selection Bar */}
            {selectedRows.size > 0 && (
              <div className="p-3 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-indigo-50/80 dark:bg-indigo-950/40">
                <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                  {selectedRows.size} file{selectedRows.size === 1 ? "" : "s"} selected
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 px-3 text-xs rounded-lg gap-1.5 shadow-2xs cursor-pointer"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                >
                  {bulkDeleteMutation.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  <span>Delete Selected</span>
                </Button>
              </div>
            )}

            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <tr className="bg-slate-50/80 dark:bg-zinc-800/60 border-b border-slate-200/80 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold text-xs">
                    <th className="py-3 px-4 w-12 text-center">
                      <Checkbox
                        checked={paginatedFiles.length > 0 && paginatedFiles.every((f) => selectedRows.has(f.id))}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="py-3 px-4 min-w-[240px] text-left">File Name</th>
                    <th className="py-3 px-4 w-[140px] text-left">Type</th>
                    <th className="py-3 px-4 min-w-[200px] text-left">Context / Company</th>
                    <th className="py-3 px-4 w-[170px] text-left">Uploaded</th>
                    <th className="py-3 px-4 w-[110px] text-right">Original</th>
                    <th className="py-3 px-4 w-[110px] text-right">Stored</th>
                    <th className="py-3 px-4 w-28 text-right">Actions</th>
                  </tr>
                </TableHeader>

                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 text-xs">
                  {isLoading ? (
                    [1, 2, 3, 4, 5].map((i) => (
                      <tr key={i} className="hover:bg-slate-50/40 dark:hover:bg-zinc-800/30">
                        <td className="py-3.5 px-4 text-center"><Skeleton className="h-4 w-4 mx-auto rounded" /></td>
                        <td className="py-3.5 px-4"><Skeleton className="h-4 w-48 rounded" /></td>
                        <td className="py-3.5 px-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
                        <td className="py-3.5 px-4"><Skeleton className="h-4 w-32 rounded" /></td>
                        <td className="py-3.5 px-4"><Skeleton className="h-4 w-28 rounded" /></td>
                        <td className="py-3.5 px-4 text-right"><Skeleton className="h-4 w-14 ml-auto rounded" /></td>
                        <td className="py-3.5 px-4 text-right"><Skeleton className="h-4 w-14 ml-auto rounded" /></td>
                        <td className="py-3.5 px-4 text-right"><Skeleton className="h-7 w-16 ml-auto rounded-lg" /></td>
                      </tr>
                    ))
                  ) : filteredFiles.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <h4 className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                          No Files Found
                        </h4>
                        <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                          No archived upload files matched the current filter or search criteria.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedFiles.map((file) => (
                      <tr key={file.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <Checkbox
                            checked={selectedRows.has(file.id)}
                            onCheckedChange={(c) => handleSelectRow(file.id, !!c)}
                            aria-label={`Select ${file.filename}`}
                          />
                        </td>
                        <td className="py-3 px-4 max-w-[280px]">
                          <div className="flex items-center gap-2">
                            <FileTypeIcon file={file} />
                            <span className="truncate font-medium text-slate-900 dark:text-zinc-100">
                              {file.filename}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <Badge variant="outline" className="border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-medium text-[10px] px-2 py-0.5">
                            {file.upload_type_label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 max-w-[260px] truncate text-slate-500 dark:text-zinc-400">
                          {getContext(file) || "-"}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-zinc-300 font-mono text-[11px] whitespace-nowrap">
                          {formatDate(file.stored_at)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700 dark:text-zinc-300 font-mono whitespace-nowrap">
                          {formatBytes(file.original_size)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-zinc-100 font-mono whitespace-nowrap">
                          {formatBytes(file.compressed_size)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {isTextPreview(file) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:text-zinc-400 dark:hover:text-indigo-400 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                                onClick={() => handlePreview(file)}
                                title="Preview file"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 dark:text-zinc-400 dark:hover:text-emerald-400 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                              asChild
                              title="Download original"
                            >
                              <a href={uploadArchiveService.downloadUrl(file.id)} download>
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-400 dark:hover:text-rose-400 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                              onClick={() => handleDelete(file)}
                              disabled={deleteMutation.isPending}
                              title="Delete archive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t border-slate-100 dark:border-zinc-800 text-xs">
                <span className="text-slate-500">
                  Showing {(safePage - 1) * pageSize + 1} - {Math.min(safePage * pageSize, filteredFiles.length)} of {filteredFiles.length} items
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(1)}
                    disabled={safePage === 1}
                    className="h-7 w-7 p-0 rounded-lg cursor-pointer"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="h-7 w-7 p-0 rounded-lg cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <span className="px-2 font-medium text-slate-700 dark:text-zinc-300">
                    Page {safePage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="h-7 w-7 p-0 rounded-lg cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(totalPages)}
                    disabled={safePage === totalPages}
                    className="h-7 w-7 p-0 rounded-lg cursor-pointer"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </WidgetErrorBoundary>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileText className="h-4 w-4 text-indigo-600" />
              <span>Preview: {previewFile?.filename}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Stored on {previewFile ? formatDate(previewFile.stored_at) : ""} • {previewFile ? formatBytes(previewFile.original_size) : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs max-h-[50vh]">
            {isPreviewLoading ? (
              <div className="flex items-center justify-center h-24 gap-2 text-slate-400">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Loading preview...</span>
              </div>
            ) : previewError ? (
              <div className="text-rose-400 p-2">{previewError}</div>
            ) : (
              <pre className="whitespace-pre-wrap">{previewText}</pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
