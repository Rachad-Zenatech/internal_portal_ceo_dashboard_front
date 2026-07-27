import {
  LayoutDashboard,
  Upload,
  ShieldCheck,
  FileClock,
} from "lucide-react";

export const navigation = [
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
]
