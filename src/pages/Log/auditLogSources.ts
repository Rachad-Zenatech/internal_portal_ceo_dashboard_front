export interface AuditApplicationDef {
  key: string;
  label: string;
}

export interface AuditApplicationTab extends AuditApplicationDef {
  count: number;
}

export const AUDIT_APPLICATIONS: AuditApplicationDef[] = [
  { key: "ceo", label: "CEO Dashboard" },
  { key: "administration", label: "Administration" },
  { key: "ma", label: "M&A" },
  { key: "finance", label: "Finance" },
  { key: "marketing", label: "Marketing" },
  { key: "real_estate", label: "Real Estate" },
  { key: "social_media_compliance", label: "Compliance" },
  { key: "travel", label: "Travel" },
  { key: "sec_filing", label: "SEC Filing" },
  { key: "template_automation", label: "Templates" },
];

const CANONICAL_SOURCE_ALIASES: Record<string, string> = {
  ceo: "ceo",
  ceo_dashboard: "ceo",
  "ceo-dashboard": "ceo",
  administration: "administration",
  admin: "administration",
  ma: "ma",
  m7a: "ma",
  finance: "finance",
  marketing: "marketing",
  real_estate: "real_estate",
  "real-estate": "real_estate",
  social_media_compliance: "social_media_compliance",
  "social-media-compliance": "social_media_compliance",
  social_media: "social_media_compliance",
  "social-media": "social_media_compliance",
  compliance: "social_media_compliance",
  travel: "travel",
  sec_filing: "sec_filing",
  "sec-filing": "sec_filing",
  share_document: "sec_filing",
  "share-document": "sec_filing",
  template_automation: "template_automation",
  "template-automation": "template_automation",
};

export const AUDIT_SOURCE_LABELS: Record<string, string> = {
  ceo: "CEO Dashboard",
  administration: "Administration",
  admin: "Administration",
  ma: "M&A",
  m7a: "M&A",
  finance: "Finance",
  marketing: "Marketing",
  real_estate: "Real Estate",
  social_media_compliance: "Compliance",
  travel: "Travel",
  sec_filing: "SEC Filing",
  share_document: "SEC Filing",
  template_automation: "Templates",
};

export function normalizeAuditSource(raw: unknown): string {
  const cleaned = String(raw || "ceo").trim().toLowerCase().replace(/\s+/g, "_");
  return CANONICAL_SOURCE_ALIASES[cleaned] || cleaned || "ceo";
}

export function getAuditSourceLabel(raw: unknown): string {
  const key = normalizeAuditSource(raw);
  return AUDIT_SOURCE_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildApplicationTabs(logs: Array<{ source_service?: string | null }>): AuditApplicationTab[] {
  const counts = new Map<string, number>();
  for (const log of logs) {
    const key = normalizeAuditSource(log.source_service);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const knownKeys = new Set(AUDIT_APPLICATIONS.map((app) => app.key));
  const tabs: AuditApplicationTab[] = [
    { key: "all", label: "All", count: logs.length },
    ...AUDIT_APPLICATIONS.map((app) => ({
      ...app,
      count: counts.get(app.key) || 0,
    })),
  ];

  for (const [key, count] of counts.entries()) {
    if (!knownKeys.has(key)) {
      tabs.push({ key, label: getAuditSourceLabel(key), count });
    }
  }
  return tabs;
}
