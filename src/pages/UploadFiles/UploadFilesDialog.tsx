import { useRef, useState } from "react";
import { FileText, Loader2, UploadCloud, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { UploadType, UploadTypeOption } from "@/types/uploadArchive";

const ACCEPT = ".csv,.xlsx,.xls,.pdf,.txt,.json,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.ppt,.pptx";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DropzoneProps {
  dragging: boolean;
  onDraggingChange: (dragging: boolean) => void;
  onAddFiles: (files: FileList | null) => void;
}

function FileDropzone({ dragging, onDraggingChange, onAddFiles }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => { e.preventDefault(); onDraggingChange(true); }}
      onDragLeave={() => onDraggingChange(false)}
      onDrop={(e) => { e.preventDefault(); onDraggingChange(false); onAddFiles(e.dataTransfer.files); }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
        dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
      }`}
    >
      <UploadCloud className="h-7 w-7 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">Drop files here or click to browse</p>
      <p className="text-xs text-muted-foreground">CSV, Excel, PDF, Word, PowerPoint, JSON, TXT, or Images</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => { onAddFiles(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}

function SelectedFileList({ files, onRemove }: { files: File[]; onRemove: (idx: number) => void }) {
  if (files.length === 0) return null;
  return (
    <ul className="max-h-36 overflow-y-auto divide-y divide-border rounded-lg border border-border">
      {files.map((f, idx) => (
        <li key={`${f.name}-${idx}`} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate font-medium text-foreground">{f.name}</span>
            <Badge variant="secondary" className="text-[10px] font-normal shrink-0">{formatFileSize(f.size)}</Badge>
          </div>
          <Button type="button" variant="ghost" size="icon-xs" onClick={() => onRemove(idx)} aria-label={`Remove ${f.name}`}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadTypes: UploadTypeOption[];
  isUploading: boolean;
  onSubmit: (files: File[], uploadType: UploadType, metadata: { company_id?: string; notes?: string }) => Promise<void>;
}

export function UploadFilesDialog({ open, onOpenChange, uploadTypes, isUploading, onSubmit }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadType, setUploadType] = useState<UploadType>(uploadTypes[0]?.value ?? "executive-document");
  const [companyId, setCompanyId] = useState("");
  const [notes, setNotes] = useState("");
  const [dragging, setDragging] = useState(false);

  const options: UploadTypeOption[] =
    uploadTypes.length > 0
      ? uploadTypes
      : [
          { value: "general-ledger", label: "General Ledger" },
          { value: "bank-statement", label: "Bank Statement" },
          { value: "financial-report", label: "Financial Report" },
          { value: "executive-document", label: "Executive Document" },
        ];

  const addIncoming = (list: FileList | null) => {
    if (!list?.length) return;
    const incoming = Array.from(list);
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...incoming.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  };

  const resetForm = () => {
    setFiles([]);
    setCompanyId("");
    setNotes("");
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    await onSubmit(files, uploadType, { company_id: companyId, notes });
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isUploading) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Archive spreadsheets, bank statements, reports, PDFs, or images (up to 25 MB per file).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="upload-category">Category</Label>
              <Select value={uploadType} onValueChange={(v) => setUploadType(v as UploadType)}>
                <SelectTrigger id="upload-category" className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upload-company">Company / Entity (optional)</Label>
              <Input
                id="upload-company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="e.g. ZenaTech USA"
              />
            </div>
          </div>

          <FileDropzone dragging={dragging} onDraggingChange={setDragging} onAddFiles={addIncoming} />
          <SelectedFileList files={files} onRemove={(idx) => setFiles((prev) => prev.filter((_, i) => i !== idx))} />

          <div className="space-y-1.5">
            <Label htmlFor="upload-notes">Notes (optional)</Label>
            <Textarea
              id="upload-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Brief description or period reference…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleUpload()} disabled={files.length === 0 || isUploading} className="gap-1.5 cursor-pointer">
            {isUploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Upload {files.length > 0 ? `(${files.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
