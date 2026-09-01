import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { format } from "date-fns";
import type { DashboardOverview } from "@/types/dashboard";
import type { DateRange } from "react-day-picker";

export type DashboardFilters = {
  companyId?: number | null;
  dateRange?: DateRange;
};

export type DashboardQueryOptions = {
  enabled?: boolean;
};

function buildParams(endpoint: string, filters: DashboardFilters) {
  const params = new URLSearchParams();
  if (filters.companyId) {
    params.set("company_id", String(filters.companyId));
  }
  if (filters.dateRange?.from) {
    params.set("start_date", format(filters.dateRange.from, "yyyy-MM-dd"));
  }
  if (filters.dateRange?.to) {
    params.set("end_date", format(filters.dateRange.to, "yyyy-MM-dd"));
  }
  const qs = params.toString();
  return qs ? `${endpoint}?${qs}` : endpoint;
}

async function fetcher<T>(endpoint: string, filters: DashboardFilters, signal?: AbortSignal) {
  return apiClient.get<T>(`/dashboard${buildParams(endpoint, filters)}`, { signal });
}

function overviewQueryKey(period: string, filters: DashboardFilters) {
  return [
    "dashboard",
    "overview",
    period,
    filters.companyId ?? "all",
    filters.dateRange?.from,
    filters.dateRange?.to,
  ] as const;
}

function useDashboardOverview<T>(
  period: string,
  filters: DashboardFilters,
  select: (overview: any) => T,
  options?: DashboardQueryOptions,
) {
  return useQuery({
    queryKey: overviewQueryKey(period, filters),
    queryFn: ({ signal }) =>
      fetcher<DashboardOverview>(`/overview?period=${period}`, filters, signal),
    select,
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 60000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

const selectSummary = (overview: any) => overview?.summary || { assets: 0, liabilities: 0, equity: 0, netIncome: 0 };
const selectRevenueExpense = (overview: any) => overview?.revenueExpense || overview?.revenue_expense || [];
const selectBankBalances = (overview: any) => overview?.bankBalances || overview?.bank_balances || [];
const selectAccountDistribution = (overview: any) => overview?.accountDistribution || overview?.account_distribution || [];
const selectRecentTransactions = (overview: any) => overview?.recentTransactions || overview?.recent_transactions || [];

export function useDashboardSummary(filters: DashboardFilters = {}, options?: DashboardQueryOptions) {
  return useDashboardOverview("monthly", filters, selectSummary, options);
}

export function useRevenueExpenseChart(
  period: string = "monthly",
  filters: DashboardFilters = {},
  options?: DashboardQueryOptions
) {
  return useDashboardOverview(period, filters, selectRevenueExpense, options);
}

export function useBankBalancesChart(filters: DashboardFilters = {}, options?: DashboardQueryOptions) {
  return useDashboardOverview("monthly", filters, selectBankBalances, options);
}

export function useAccountDistribution(filters: DashboardFilters = {}, options?: DashboardQueryOptions) {
  return useDashboardOverview("monthly", filters, selectAccountDistribution, options);
}

export function useRecentTransactions(filters: DashboardFilters = {}, options?: DashboardQueryOptions) {
  return useDashboardOverview("monthly", filters, selectRecentTransactions, options);
}
