export interface PurchaseOrderDetail {
  id?: string | null;
  item?: string | null;
  description?: string | null;
  quote_number?: string | null;
  payment_method?: string | null;
  vendor?: string | null;
  shipped_to_location?: string | null;
  approval_status?: string | null;
  expected_delivery_date?: string | null;
  tracking_number?: string | null;
}

export interface PoSummary {
  hasPo: boolean;
  poNumber: string;
  quoteRef: string | null;
  vendor: string | null;
  status: string | null;
  shippedTo: string | null;
  trackingNumber: string | null;
  expectedDelivery: string | null;
}

export function normalizeRequestDetailResponse(res: any): any {
  if (res?.request) {
    return {
      ...res.request,
      purchase_order: res.purchase_order ?? null,
      invoice: res.invoice ?? null,
      wire_transfer: res.wire_transfer ?? null,
    };
  }
  return res;
}

export function isUrgentRequest(req: any): boolean {
  return Boolean(
    req?.is_urgent_override ||
      req?.quote_data?.is_urgent_override ||
      String(req?.priority || "").toUpperCase() === "URGENT",
  );
}

export function getRequestTitle(req: any): string {
  const candidates = [
    req?.title,
    req?.product_name,
    req?.purchase_order?.item,
    req?.rawReq?.title,
    req?.rawReq?.product_name,
  ];
  for (const val of candidates) {
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "-";
}

export function getRequestDescription(req: any): string {
  const candidates = [req?.description, req?.purchase_order?.description];
  for (const val of candidates) {
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "";
}

function formatPoId(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return /^po[-#\s]/i.test(trimmed) ? trimmed : `PO #${trimmed}`;
}

export function getPoSummary(req: any): PoSummary {
  const po = req?.purchase_order;
  const poIdLabel = formatPoId(po?.id);
  const quotePo =
    (typeof po?.quote_number === "string" && po.quote_number.trim()) ||
    (typeof req?.quote_data?.po_number === "string" && req.quote_data.po_number.trim()) ||
    null;
  const invoicePoLabel = formatPoId(req?.invoice?.po_id);

  const poNumber = poIdLabel || quotePo || invoicePoLabel || "Not generated";
  const hasPo = Boolean(po || quotePo || invoicePoLabel);
  const quoteRef =
    typeof po?.quote_number === "string" && po.quote_number.trim() && po.quote_number.trim() !== poNumber
      ? po.quote_number.trim()
      : null;

  const rawTracking = typeof po?.tracking_number === "string" ? po.tracking_number.trim() : "";
  const trackingNumber = rawTracking && rawTracking.toUpperCase() !== "SHIPPED" ? rawTracking : null;

  return {
    hasPo,
    poNumber,
    quoteRef,
    vendor: typeof po?.vendor === "string" && po.vendor.trim() ? po.vendor.trim() : null,
    status: typeof po?.approval_status === "string" && po.approval_status.trim() ? po.approval_status.trim() : null,
    shippedTo:
      typeof po?.shipped_to_location === "string" && po.shipped_to_location.trim()
        ? po.shipped_to_location.trim()
        : null,
    trackingNumber,
    expectedDelivery:
      typeof po?.expected_delivery_date === "string" && po.expected_delivery_date.trim()
        ? po.expected_delivery_date.trim()
        : null,
  };
}
