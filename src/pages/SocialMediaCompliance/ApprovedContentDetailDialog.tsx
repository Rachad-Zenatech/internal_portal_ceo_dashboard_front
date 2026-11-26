import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { ApprovedContentItem } from "@/types/socialCompliance";

interface Props {
  item: ApprovedContentItem | null;
  onClose: () => void;
}

export function ApprovedContentDetailDialog({ item, onClose }: Props) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {item && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">{item.reference_code}</Badge>
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-xs">APPROVED</Badge>
                <Badge variant="secondary" className="text-xs">{item.content_type}</Badge>
              </div>
              <DialogTitle className="text-lg pt-1">{item.title}</DialogTitle>
              <DialogDescription>
                Submitted by {item.created_by_name}
                {item.created_by_email ? ` (${item.created_by_email})` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
              <div>
                <p className="text-muted-foreground">Brand(s)</p>
                <p className="font-semibold text-foreground mt-0.5">{item.brand_names.join(", ") || item.brand_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Platforms</p>
                <p className="font-semibold text-foreground mt-0.5">{item.platforms.join(", ") || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Compliance Score</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {item.latest_score !== null && item.latest_score !== undefined ? `${item.latest_score} / 100` : "—"}
                  {item.latest_traffic_light ? ` (${item.latest_traffic_light})` : ""}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Scheduled / Updated</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {item.publish_at
                    ? new Date(item.publish_at).toLocaleString()
                    : item.updated_at
                      ? new Date(item.updated_at).toLocaleString()
                      : "—"}
                </p>
              </div>
              {item.audiences.length > 0 && (
                <div>
                  <p className="text-muted-foreground">Audience</p>
                  <p className="font-semibold text-foreground mt-0.5">{item.audiences.join(", ")}</p>
                </div>
              )}
              {item.region && (
                <div>
                  <p className="text-muted-foreground">Region</p>
                  <p className="font-semibold text-foreground mt-0.5">{item.region}</p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Caption / Content</h4>
              <div className="rounded-xl border border-border bg-card p-3.5 text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                {item.caption_text || "No caption text provided."}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
