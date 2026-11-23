import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
} from "@tanstack/react-table";
import type { SortingState, ColumnFiltersState, VisibilityState } from "@tanstack/react-table";
import { buildCeoAuditColumns, buildCeoLoginColumns } from "./auditLogColumns";
import { buildApplicationTabs, getAuditSourceLabel, normalizeAuditSource } from "./auditLogSources";
import { AuditApplicationTabs } from "./AuditApplicationTabs";
import { AuditLogTableSection } from "./AuditLogTableSection";

export default function AuditLog() {
  const { data: auditLogs = [], isLoading: isAuditLoading } = useQuery({
    queryKey: ["auditLogs"],
    queryFn: () => apiClient.get<any[]>("/api/audit-logs"),
  });

  const { data: loginActivities = [], isLoading: isLoginLoading } = useQuery({
    queryKey: ["loginActivities"],
    queryFn: () => apiClient.get<any[]>("/api/login-activities"),
  });

  const [selectedApp, setSelectedApp] = useState<string>("all");
  const [auditSorting, setAuditSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
  const [auditColumnFilters, setAuditColumnFilters] = useState<ColumnFiltersState>([]);
  const [auditColumnVisibility, setAuditColumnVisibility] = useState<VisibilityState>({});
  const [auditGlobalFilter, setAuditGlobalFilter] = useState("");

  const [loginSorting, setLoginSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
  const [loginColumnFilters, setLoginColumnFilters] = useState<ColumnFiltersState>([]);
  const [loginColumnVisibility, setLoginColumnVisibility] = useState<VisibilityState>({});
  const [loginGlobalFilter, setLoginGlobalFilter] = useState("");

  const safeAuditLogs = useMemo(() => (Array.isArray(auditLogs) ? auditLogs : []), [auditLogs]);
  const safeLoginActivities = useMemo(() => (Array.isArray(loginActivities) ? loginActivities : []), [loginActivities]);

  const applicationTabs = useMemo(() => buildApplicationTabs(safeAuditLogs), [safeAuditLogs]);
  const activeAppLabel = useMemo(
    () => applicationTabs.find((t) => t.key === selectedApp)?.label || getAuditSourceLabel(selectedApp),
    [applicationTabs, selectedApp]
  );

  const filteredByAppLogs = useMemo(() => {
    if (selectedApp === "all") return safeAuditLogs;
    return safeAuditLogs.filter((log) => normalizeAuditSource(log.source_service) === selectedApp);
  }, [safeAuditLogs, selectedApp]);

  const auditColumns = useMemo(
    () => buildCeoAuditColumns({ showProject: selectedApp === "all" }),
    [selectedApp]
  );
  const loginColumns = useMemo(() => buildCeoLoginColumns(), []);

  const auditTable = useReactTable({
    data: filteredByAppLogs,
    columns: auditColumns,
    initialState: { pagination: { pageSize: 50 } },
    onSortingChange: setAuditSorting,
    onColumnFiltersChange: setAuditColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setAuditColumnVisibility,
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue || "").toLowerCase();
      const actor = String(row.original.actor_name || "").toLowerCase();
      const actorEmail = String(row.original.actor_email || "").toLowerCase();
      const action = String(row.original.action || "").toLowerCase();
      const entity = String(row.original.entity_type || "").toLowerCase();
      const entityId = String(row.original.entity_id || "").toLowerCase();
      const source = normalizeAuditSource(row.original.source_service);
      const sourceLabel = getAuditSourceLabel(source).toLowerCase();
      const details = JSON.stringify(row.original.new_value || "").toLowerCase();
      return (
        actor.includes(search) ||
        actorEmail.includes(search) ||
        action.includes(search) ||
        entity.includes(search) ||
        entityId.includes(search) ||
        source.includes(search) ||
        sourceLabel.includes(search) ||
        details.includes(search)
      );
    },
    state: {
      sorting: auditSorting,
      columnFilters: auditColumnFilters,
      columnVisibility: auditColumnVisibility,
      globalFilter: auditGlobalFilter,
    },
    onGlobalFilterChange: setAuditGlobalFilter,
  });

  const loginTable = useReactTable({
    data: safeLoginActivities,
    columns: loginColumns,
    initialState: { pagination: { pageSize: 50 } },
    onSortingChange: setLoginSorting,
    onColumnFiltersChange: setLoginColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setLoginColumnVisibility,
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue || "").toLowerCase();
      const name = String(row.original.user_full_name || "").toLowerCase();
      const email = String(row.original.email || "").toLowerCase();
      const ip = String(row.original.ip_address || "").toLowerCase();
      const reason = String(row.original.failure_reason || "").toLowerCase();
      return name.includes(search) || email.includes(search) || ip.includes(search) || reason.includes(search);
    },
    state: {
      sorting: loginSorting,
      columnFilters: loginColumnFilters,
      columnVisibility: loginColumnVisibility,
      globalFilter: loginGlobalFilter,
    },
    onGlobalFilterChange: setLoginGlobalFilter,
  });

  const handleSelectApp = (appKey: string) => {
    setSelectedApp(appKey);
    auditTable.setPageIndex(0);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full gap-5 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Audit & Security Logs
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Track cross-application system activity, configuration changes, and login attempts.
        </p>
      </div>

      <Tabs defaultValue="actions" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-[400px] grid-cols-2 mb-4" variant="line">
          <TabsTrigger value="actions">Actions ({safeAuditLogs.length})</TabsTrigger>
          <TabsTrigger value="logins">Login Activities ({safeLoginActivities.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="flex-1 flex flex-col min-h-0 m-0 gap-4 data-[state=active]:flex">
          <AuditApplicationTabs tabs={applicationTabs} selectedApp={selectedApp} onSelect={handleSelectApp} />
          <AuditLogTableSection
            table={auditTable}
            columnCount={auditColumns.length}
            isLoading={isAuditLoading}
            globalFilter={auditGlobalFilter}
            onGlobalFilterChange={setAuditGlobalFilter}
            searchPlaceholder={selectedApp === "all" ? "Search all actions..." : `Search ${activeAppLabel} actions...`}
            emptyMessage={
              selectedApp === "all" ? "No audit logs found." : `No audit logs found for ${activeAppLabel}.`
            }
            paginationNoun="action(s)"
          />
        </TabsContent>

        <TabsContent value="logins" className="flex-1 flex flex-col min-h-0 m-0 data-[state=active]:flex">
          <AuditLogTableSection
            table={loginTable}
            columnCount={loginColumns.length}
            isLoading={isLoginLoading}
            globalFilter={loginGlobalFilter}
            onGlobalFilterChange={setLoginGlobalFilter}
            searchPlaceholder="Search activities..."
            emptyMessage="No login activities found."
            paginationNoun="activity(ies)"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
