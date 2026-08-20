import {
  LayoutDashboard,
  Upload,
  FileClock,
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
    label: "Upload Files",
    path: "/upload-files",
    icon: Upload,
    section: "MAIN",
    navigationCode: "UPLOAD_FILES",
  },
  {
    label: "Audit Log",
    path: "/log/audit-log",
    icon: FileClock,
    section: "ADMIN PORTAL",
    navigationCode: "AUDIT_LOG",
  },
];
