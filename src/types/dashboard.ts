export type DashboardSummary = {
  assets: number;
  assetsChange: number;
  liabilities: number;
  liabilitiesChange: number;
  equity: number;
  equityChange: number;
  netIncome: number;
  netIncomeChange: number;
};

export type RevenueExpensePoint = {
  month: string;
  date?: string;
  revenue: number;
  expenses: number;
};

export type BankBalancePoint = {
  account: string;
  beginning: number;
  ending: number;
};

export type AccountDistributionPoint = {
  name: string;
  value: number;
  percentage: string;
};

export type RecentTransaction = {
  id: number | string;
  date: string;
  description: string;
  amount: number;
};

export type DashboardOverview = {
  summary: DashboardSummary;
  revenueExpense: RevenueExpensePoint[];
  bankBalances: BankBalancePoint[];
  accountDistribution: AccountDistributionPoint[];
  recentTransactions: RecentTransaction[];
};
