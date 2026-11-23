import { Badge } from "@/components/ui/badge";
import { getPoSummary, getRequestDescription, getRequestTitle } from "./requestDetailHelpers";

function formatShortDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function RequestOverviewAndPoSection({ request }: { request: any }) {
  const title = getRequestTitle(request);
  const description = getRequestDescription(request);
  const specs = typeof request?.product_info?.specs === "string" ? request.product_info.specs.trim() : "";
  const po = getPoSummary(request);
  const hasPoDetails = Boolean(po.quoteRef || po.vendor || po.shippedTo || po.trackingNumber || po.expectedDelivery);

  return (
    <>
      <div className="p-3.5 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-2.5">
        <div>
          <span className="block text-[11px] text-muted-foreground font-medium">Title</span>
          <p className="font-semibold text-sm text-slate-900 dark:text-zinc-100 mt-0.5">{title}</p>
        </div>
        <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800">
          <span className="block text-[11px] text-muted-foreground font-medium">Description</span>
          <p className="text-slate-600 dark:text-zinc-400 mt-0.5 whitespace-pre-wrap">
            {description || "No description provided."}
          </p>
        </div>
        {specs && (
          <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800">
            <span className="block text-[11px] text-muted-foreground font-medium">Specs</span>
            <p className="text-slate-700 dark:text-zinc-300 mt-0.5 whitespace-pre-wrap">{specs}</p>
          </div>
        )}
      </div>

      <div className="p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-semibold text-slate-800 dark:text-zinc-200 text-xs">Purchase Order (PO)</span>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={`text-[10px] px-2 py-0.5 font-mono ${
                po.hasPo
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800"
                  : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700"
              }`}
            >
              {po.poNumber}
            </Badge>
            {po.status && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 uppercase">
                {po.status}
              </Badge>
            )}
          </div>
        </div>
        {hasPoDetails && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            {po.quoteRef && (
              <div>
                <span className="block text-[11px] text-muted-foreground font-medium">Quote / PO Ref</span>
                <span className="font-semibold font-mono text-slate-800 dark:text-zinc-200 break-words">{po.quoteRef}</span>
              </div>
            )}
            {po.vendor && (
              <div>
                <span className="block text-[11px] text-muted-foreground font-medium">Vendor</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200 break-words">{po.vendor}</span>
              </div>
            )}
            {po.shippedTo && (
              <div>
                <span className="block text-[11px] text-muted-foreground font-medium">Shipped To</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200 break-words">{po.shippedTo}</span>
              </div>
            )}
            {po.trackingNumber && (
              <div>
                <span className="block text-[11px] text-muted-foreground font-medium">Tracking #</span>
                <span className="font-semibold font-mono text-slate-800 dark:text-zinc-200 break-words">{po.trackingNumber}</span>
              </div>
            )}
            {po.expectedDelivery && (
              <div>
                <span className="block text-[11px] text-muted-foreground font-medium">Expected Delivery</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{formatShortDate(po.expectedDelivery)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
