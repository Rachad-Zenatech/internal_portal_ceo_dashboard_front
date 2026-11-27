import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, FolderArchive, HardDrive, RefreshCw, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/Dashboard/KpiCard";
import { uploadArchiveService } from "@/services/uploadArchiveService";
import type { ArchivedUpload, UploadType } from "@/types/uploadArchive";
import { UploadFilePreviewDialog } from "./UploadFilePreviewDialog";
import { UploadFilesDialog } from "./UploadFilesDialog";
import { formatBytes, UploadFilesTable } from "./UploadFilesTable";

type FilterValue = "all" | UploadType;
const PAGE_SIZE = 50;

export default function UploadFiles() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterValue>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<ArchivedUpload | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ mode: "single"; file: ArchivedUpload } | { mode: "bulk"; ids: string[] } | null>(null);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["uploadArchive", filter],
    queryFn: () => uploadArchiveService.list(filter === "all" ? undefined : filter),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const files = Array.isArray(data?.files) ? data.files : [];
  const uploadTypes = Array.isArray(data?.upload_types) ? data.upload_types : [];
  const storageMode = data?.storage_status?.mode === "s3" ? "S3 Storage" : "Local Archive";
  const storageWarning = data?.storage_warning;

  const filteredFiles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => {
      const meta = f.metadata || {};
      return (
        f.filename.toLowerCase().includes(q) ||
        (f.upload_type_label || "").toLowerCase().includes(q) ||
        String(meta.company_id || "").toLowerCase().includes(q) ||
        String(meta.notes || "").toLowerCase().includes(q)
      );
    });
  }, [files, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedFiles = useMemo(
    () => filteredFiles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredFiles, safePage]
  );

  const totals = useMemo(
    () => files.reduce((acc, f) => ({ original: acc.original + (f.original_size || 0), compressed: acc.compressed + (f.compressed_size || 0) }), { original: 0, compressed: 0 }),
    [files]
  );
  const savingsPct = totals.original > 0 ? Math.max(0, Math.round(((totals.original - totals.compressed) / totals.original) * 100)) : 0;

  const uploadMutation = useMutation({
    mutationFn: ({ incoming, type, meta }: { incoming: File[]; type: UploadType; meta: { company_id?: string; notes?: string } }) =>
      uploadArchiveService.upload(incoming, type, meta),
    onSuccess: (res) => {
      toast.success(`Uploaded ${res.count} ${res.count === 1 ? "file" : "files"}`);
      void queryClient.invalidateQueries({ queryKey: ["uploadArchive"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to upload files"),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => uploadArchiveService.remove(id))),
    onSuccess: (_res, ids) => {
      toast.success(`Deleted ${ids.length} ${ids.length === 1 ? "archive" : "archives"}`);
      setSelectedRows(new Set());
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["uploadArchive"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete file(s)"),
  });

  const handleDownload = async (file: ArchivedUpload) => {
    setDownloadingId(file.id);
    try {
      const blob = await uploadArchiveService.fetchDownloadBlob(file.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download file");
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const ids = deleteTarget.mode === "single" ? [deleteTarget.file.id] : deleteTarget.ids;
    deleteMutation.mutate(ids);
  };

  const filterOptions = [{ value: "all" as const, label: "All Files" }, ...uploadTypes];

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 bg-background p-4 sm:p-6 lg:p-8 pb-12">
      <header className="shrink-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Upload Files &amp; Archives</h1>
            <Badge variant="outline" className="gap-1.5 font-normal">
              <span className={`h-1.5 w-1.5 rounded-full ${isError ? "bg-rose-500" : "bg-emerald-500"}`} />
              {storageMode}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Upload, preview, and manage archived accounting spreadsheets, bank statements, reports, and executive documents.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching} className="gap-1.5 cursor-pointer">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5 cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            Upload Files
          </Button>
        </div>
      </header>

      {(isError || storageWarning) && (
        <Alert variant={isError ? "destructive" : "default"}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{isError ? "Could not load archived files" : "Storage notice"}</AlertTitle>
          <AlertDescription>{isError ? (error instanceof Error ? error.message : "Upload archive request failed.") : storageWarning}</AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => void refetch()} className="cursor-pointer bg-background">Retry</Button>
          </AlertAction>
        </Alert>
      )}

      <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard label="Total File Archives" value={files.length} hint={`${uploadTypes.length} archive categories`} icon={<FolderArchive className="h-4 w-4" />} tone="indigo" loading={isLoading} />
        <KpiCard label="Storage Footprint" value={formatBytes(totals.compressed)} hint={`Original: ${formatBytes(totals.original)} · ${savingsPct}% saved`} icon={<HardDrive className="h-4 w-4" />} tone="emerald" loading={isLoading} />
      </div>

      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => { setFilter(v as FilterValue); setPage(1); setSelectedRows(new Set()); }}>
          <TabsList className="h-auto flex-wrap justify-start">
            {filterOptions.map((opt) => (
              <TabsTrigger key={opt.value} value={opt.value} className="cursor-pointer px-3 text-xs">
                {opt.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-sm min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} placeholder="Search files, category, company, notes…" className="pl-9 bg-card" />
        </div>
      </div>

      <UploadFilesTable
        files={paginatedFiles}
        totalFiltered={filteredFiles.length}
        isLoading={isLoading}
        page={safePage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        selectedRows={selectedRows}
        downloadingId={downloadingId}
        isDeleting={deleteMutation.isPending}
        onPageChange={setPage}
        onSelectAll={(checked) => {
          const next = new Set(selectedRows);
          paginatedFiles.forEach((f) => (checked ? next.add(f.id) : next.delete(f.id)));
          setSelectedRows(next);
        }}
        onSelectRow={(id, checked) => {
          const next = new Set(selectedRows);
          if (checked) next.add(id);
          else next.delete(id);
          setSelectedRows(next);
        }}
        onPreview={setPreviewFile}
        onDownload={(f) => void handleDownload(f)}
        onDelete={(f) => setDeleteTarget({ mode: "single", file: f })}
        onBulkDelete={() => setDeleteTarget({ mode: "bulk", ids: Array.from(selectedRows) })}
        onOpenUpload={() => setUploadOpen(true)}
      />

      <UploadFilesDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        uploadTypes={uploadTypes}
        isUploading={uploadMutation.isPending}
        onSubmit={async (incoming, type, meta) => { await uploadMutation.mutateAsync({ incoming, type, meta }); }}
      />

      <UploadFilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} onDownload={(f) => void handleDownload(f)} />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete archived {deleteTarget?.mode === "bulk" ? `${deleteTarget.ids.length} files` : "file"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.mode === "single"
                ? `This permanently deletes "${deleteTarget.file.filename}" from archive storage.`
                : "This permanently deletes all selected files from archive storage."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
