import { Badge } from "@/components/ui/badge";

export function parseQuoteDataSafe(raw: any): any {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

export function mapCompletedHistoryRequests(rawCompletedHistory: any[]) {
  if (!Array.isArray(rawCompletedHistory)) return [];
  return rawCompletedHistory.map((r: any) => {
    const qd = parseQuoteDataSafe(r.quote_data);
    const isUrgentOverride = Boolean(r.is_urgent_override || qd?.is_urgent_override);
    const urgentReason = r.urgent_override_reason || qd?.urgent_override_reason || null;
    const priority = isUrgentOverride ? "URGENT" : r.priority || "Normal";
    return {
      id: String(r.id),
      department: r.department || "Operations",
      amount: Number(r.amount) || 0,
      requester_name: r.requester_name || r.requester || "Staff Member",
      created_at: r.created_at || r.request_date || "",
      description: r.description || r.product_name || `Purchase Request #${r.id}`,
      status: r.status || "COMPLETED",
      priority,
      approved_at: r.created_at || "",
      note:
        r.approval_note ||
        (urgentReason ? `Urgent Override: ${urgentReason}` : null) ||
        r.hold_reason ||
        (r.pending_sync
          ? r.status === "REJECTED"
            ? "Rejected Offline (Queued)"
            : "Approved Offline (Queued)"
          : r.status === "REJECTED"
          ? "Rejected"
          : "Signed Off"),
      vendor: r.vendor || r.product_info?.vendor || "Verified Vendor",
      currency: r.currency || "USD",
      original_currency: r.original_currency,
      original_amount: r.original_amount,
      exchange_rate: r.exchange_rate,
      is_converted: r.is_converted,
      quote_data: qd,
      is_urgent_override: isUrgentOverride,
      urgent_override_reason: urgentReason,
      items: r.items,
      pending_sync: Boolean(r.pending_sync),
      rawReq: { ...r, quote_data: qd, priority },
    };
  });
}

export function ApprovalTitleAndPriorityCells({ req }: { req: any }) {
  const isUrgent = Boolean(
    req.is_urgent_override || req.quote_data?.is_urgent_override || req.priority?.toUpperCase() === "URGENT"
  );
  const urgentReason = req.urgent_override_reason || req.quote_data?.urgent_override_reason || null;
  const prioUpper = String(req.priority || "Normal").toUpperCase();

  return (
    <>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-slate-900 dark:text-zinc-100 line-clamp-1">{req.description}</span>
          {isUrgent && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 font-semibold bg-red-50 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800 shrink-0"
            >
              Urgent
            </Badge>
          )}
        </div>
        {urgentReason && (
          <p className="text-[11px] font-medium text-red-600 dark:text-red-400 mt-0.5 line-clamp-2">
            Reason: {urgentReason}
          </p>
        )}
        {req.vendor && <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Vendor: {req.vendor}</span>}
      </td>
      <td className="py-3 px-4 text-center whitespace-nowrap">
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 font-medium ${
            prioUpper === "URGENT" || prioUpper === "HIGH"
              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
              : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          {req.priority || "Normal"}
        </Badge>
      </td>
    </>
  );
}

export function UrgentOverrideDetailBanner({ request }: { request: any }) {
  const isUrgent = Boolean(
    request?.quote_data?.is_urgent_override ||
      request?.is_urgent_override ||
      request?.quote_data?.urgent_override_reason ||
      request?.urgent_override_reason
  );
  if (!isUrgent) return null;
  const reason = request?.quote_data?.urgent_override_reason || request?.urgent_override_reason;

  return (
    <div className="p-3.5 bg-red-50/80 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/60 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-red-800 dark:text-red-200 text-xs">
          Urgent Account Payable — Approval Override
        </h4>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
          Urgent
        </Badge>
      </div>
      <p className="text-red-700 dark:text-red-300 font-medium whitespace-pre-wrap">
        {reason || "No override reason provided."}
      </p>
      {request?.quote_data?.urgent_override_by && (
        <p className="text-[11px] text-red-700/80 dark:text-red-300/80">
          Overridden by {request.quote_data.urgent_override_by}
        </p>
      )}
    </div>
  );
}
