import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { apiClient } from "@/services/apiClient";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: loginActivities = [], isLoading: isLoginLoading } = useQuery({
    queryKey: ["loginActivities"],
    queryFn: () => apiClient.get<any[]>('/api/login-activities'),
  });

  // We now pass all activities to the DataTable to allow pagination

  const loginColumns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: "created_at",
      header: "Date & Time",
      cell: ({ row }) => <span className="font-medium whitespace-nowrap">{new Date(row.original.created_at).toLocaleString()}</span>,
    },
    {
      accessorKey: "email",
      header: "Account",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-900 dark:text-slate-100">{row.original.user_full_name || 'Unknown'}</span>
          <span className="text-xs text-slate-500">{row.original.email}</span>
        </div>
      ),
    },
    {
      accessorKey: "success",
      header: "Status",
      cell: ({ row }) => {
        const log = row.original;
        return log.success ? (
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 gap-1.5 w-fit">
              <CheckCircle2 className="h-3 w-3" />
              Success
            </Badge>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 gap-1.5 w-fit">
              <XCircle className="h-3 w-3" />
              Failed
            </Badge>
            <span className="text-xs text-red-600 dark:text-red-400 font-medium truncate max-w-[200px]" title={log.failure_reason}>
              {log.failure_reason}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "ip_address",
      header: "IP Address",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.ip_address || 'N/A'}</span>,
    },
  ], []);

  return (
    <div className="w-full space-y-8 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out p-6 lg:p-10 max-w-[1600px] mx-auto">
      <header className="flex flex-col gap-4 border-b border-slate-200/60 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Welcome back, {user?.full_name || "Admin"}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          This is your central CEO dashboard, providing an overview of all portals and connected systems.
        </p>
      </header>
      
      <Card className="flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm flex flex-col">
        <CardHeader className="bg-slate-50/50 dark:bg-zinc-950/50 border-b">
          <CardTitle>CEO Portal Activity</CardTitle>
          <CardDescription>Recent login activities from the CEO Portal.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 overflow-auto flex-1 flex flex-col min-h-[500px]">
          <DataTable columns={loginColumns} data={loginActivities} isLoading={isLoginLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
