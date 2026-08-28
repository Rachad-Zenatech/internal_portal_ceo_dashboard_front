import {
  LayoutDashboard,
  Upload,
  FileClock,
  Briefcase,
  Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavigationItem {
  label: string;
  path?: string;
  icon: LucideIcon;
  section?: string;
  navigationCode?: string;
  subItems?: Array<{
    label: string;
    path: string;
    navigationCode?: string;
  }>;
}

export const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
    section: "MAIN",
    navigationCode: "DASHBOARD",
  },
  {
    label: "Mergers & Acquisitions",
    path: "/mergers-acquisitions",
    icon: Briefcase,
    section: "MAIN",
    navigationCode: "DASHBOARD",
  },
  {
    label: "Upload Files",
    path: "/upload-files",
    icon: Upload,
    section: "MAIN",
    navigationCode: "UPLOAD_FILES",
  },
  {
    label: "Administration",
    path: "/administration",
    icon: Building2,
    section: "ADMIN PORTAL",
  },
  {
    label: "Audit Log",
    path: "/log/audit-log",
    icon: FileClock,
    section: "ADMIN PORTAL",
    navigationCode: "AUDIT_LOG",
  },
];

