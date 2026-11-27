import { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uploadArchiveService } from "@/services/uploadArchiveService";
import type { ArchivedUpload } from "@/types/uploadArchive";

export function isPreviewableFile(file: ArchivedUpload): boolean {
  const ext = file.filename.split(".").pop()?.toLowerCase() ?? "";
  const ct = (file.content_type || "").toLowerCase();
  return (
    ["csv", "txt", "json", "pdf", "png", "jpg", "jpeg", "webp", "gif"].includes(ext) ||
    ct.startsWith("image/") ||
    ct.startsWith("text/") ||
    ct === "application/pdf" ||
    ct === "application/json"
  );
}

function previewKind(file: ArchivedUpload): "image" | "pdf" | "text" {
  const ext = file.filename.split(".").pop()?.toLowerCase() ?? "";
  const ct = (file.content_type || "").toLowerCase();
  if (ct.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
  if (ct === "application/pdf" || ext === "pdf") return "pdf";
  return "text";
}

interface Props {
  file: ArchivedUpload | null;
  onClose: () => void;
  onDownload: (file: ArchivedUpload) => void;
}

export function UploadFilePreviewDialog({ file, onClose, onDownload }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setTextContent(null);
      setBlobUrl(null);
      setError(null);
      return;
    }
    let alive = true;
    let objUrl = "";
    const kind = previewKind(file);
    setLoading(true);
    setError(null);
    setTextContent(null);
    setBlobUrl(null);

    uploadArchiveService
      .fetchViewBlob(file.id)
      .then(async (blob) => {
        if (!alive) return;
        if (kind === "text") {
          setTextContent(await blob.text());
        } else {
          objUrl = URL.createObjectURL(blob);
          setBlobUrl(objUrl);
        }
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Failed to load preview");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [file]);

  const kind = file ? previewKind(file) : "text";

  return (
    <Dialog open={Boolean(file)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{file?.filename}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {file?.upload_type_label} · {file ? new Date(file.stored_at).toLocaleString() : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-[240px] overflow-auto rounded-lg border border-border bg-muted/20">
          {loading ? (
            <div className="flex h-60 items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading preview…
            </div>
          ) : error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : kind === "image" && blobUrl ? (
            <div className="flex items-center justify-center p-4">
              <img src={blobUrl} alt={file?.filename} className="max-h-[60vh] w-auto object-contain rounded" />
            </div>
          ) : kind === "pdf" && blobUrl ? (
            <iframe title={file?.filename} src={blobUrl} className="h-[60vh] w-full border-0" />
          ) : (
            <pre className="p-4 font-mono text-xs whitespace-pre-wrap break-words text-foreground">
              {textContent}
            </pre>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          {file && (
            <Button type="button" onClick={() => onDownload(file)} className="gap-1.5 cursor-pointer">
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
