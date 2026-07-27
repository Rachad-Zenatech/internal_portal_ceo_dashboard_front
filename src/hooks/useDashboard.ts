import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { format } from "date-fns";
import type { DashboardOverview } from "@/types/dashboard";
import type { DateRange } from "react-day-picker";

export type DashboardFilters = {
  companyId?: number | null;
  dateRange?: DateRange;
};

function buildParams(endpoint: string, filters: DashboardFilters) {
  const url = new URL(endpoint, "http://localhost"); // Dummy base for URL API
  if (filters.companyId) {
    url.searchParams.set("company_id", String(filters.companyId));
  }
  if (filters.dateRange?.from) {
    url.searchParams.set("start_date", format(filters.dateRange.from, "yyyy-MM-dd"));
  }
  if (filters.dateRange?.to) {
    url.searchParams.set("end_date", format(filters.dateRange.to, "yyyy-MM-dd"));
  }
  return `${url.pathname}${url.search}`;
}

async function fetcher<T>(endpoint: string, filters: DashboardFilters) {
  return apiClient.get<T>(`/dashboard${buildParams(endpoint, filters)}`);
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
  select: (overview: DashboardOverview) => T,
) {
  return useQuery({
    queryKey: overviewQueryKey(period, filters),
    queryFn: () =>
      fetcher<DashboardOverview>(`/overview?period=${period}`, filters),
    select,
  });
}

const selectSummary = (overview: DashboardOverview) => overview.summary;
const selectRevenueExpense = (overview: DashboardOverview) => overview.revenueExpense;
const selectBankBalances = (overview: DashboardOverview) => overview.bankBalances;
const selectAccountDistribution = (overview: DashboardOverview) => overview.accountDistribution;
const selectRecentTransactions = (overview: DashboardOverview) => overview.recentTransactions;

export function useDashboardSummary(filters: DashboardFilters = {}) {
  return useDashboardOverview("monthly", filters, selectSummary);
}

export function useRevenueExpenseChart(
  period: string = "monthly",
  filters: DashboardFilters = {}
) {
  return useDashboardOverview(period, filters, selectRevenueExpense);
}

export function useBankBalancesChart(filters: DashboardFilters = {}) {
  return useDashboardOverview("monthly", filters, selectBankBalances);
}

export function useAccountDistribution(filters: DashboardFilters = {}) {
  return useDashboardOverview("monthly", filters, selectAccountDistribution);
}

export function useRecentTransactions(filters: DashboardFilters = {}) {
  return useDashboardOverview("monthly", filters, selectRecentTransactions);
}
