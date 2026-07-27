import { useMemo } from "react";
import { ComposedChart, Bar, Line, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRevenueExpenseChart, type DashboardFilters } from "@/hooks/useDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import type { RevenueExpensePoint } from "@/types/dashboard";

type ExtendedPoint = RevenueExpensePoint & { netIncome: number };

type RevenueTooltipSeries = {
  color?: string;
  name: string;
  value: number;
  payload: ExtendedPoint;
};

type RevenueTooltipProps = {
  active?: boolean;
  payload?: RevenueTooltipSeries[];
};

const CustomTooltip = ({ active, payload }: RevenueTooltipProps) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    return (
      <div className="bg-white border shadow-md p-3 rounded-lg flex flex-col gap-1 text-sm">
        <p className="font-semibold">{dataPoint.date ?? dataPoint.month}</p>
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-600">{entry.name}:</span>
            <span className="font-medium">${entry.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

type RevenueExpenseChartProps = {
  filters?: DashboardFilters;
  period: string;
};

export default function RevenueExpenseChart({
  filters,
  period,
}: RevenueExpenseChartProps) {
  const { data, isLoading, isError } = useRevenueExpenseChart(
    period,
    filters
  );

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map(d => ({
      ...d,
      netIncome: d.revenue - d.expenses
    }));
  }, [data]);

  const formatCompactCurrency = (value: number) => {
    if (value === 0) return "$0";
    const absVal = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (absVal >= 1000000) return `${sign}${(absVal / 1000000).toFixed(1)}M`;
    if (absVal >= 1000) return `${sign}${(absVal / 1000).toFixed(0)}K`;
    return `${sign}$${absVal}`;
  };

  if (isLoading) {
    return (
      <Card className="w-full h-full rounded-2xl border-slate-200/60 shadow-sm flex flex-col">
        <CardHeader>
          <Skeleton className="h-6 w-[250px]" />
        </CardHeader>
        <CardContent className="flex-1">
          <Skeleton className="h-full min-h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !chartData.length) {
    return (
      <Card className="w-full h-full rounded-2xl border-slate-200/60 shadow-sm flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg">Monthly P&L Trend</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <h3 className="text-lg font-semibold">No data</h3>
          <p className="text-sm text-muted-foreground mt-1">Failed to load revenue vs expense data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full rounded-2xl border-slate-200/60 shadow-sm flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg capitalize">{period} P&L Trend</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-2">
        <div className="h-full min-h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              barGap={2}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tickMargin={10} 
                tick={{ fill: "#64748b", fontSize: 11 }} 
              />
              <YAxis 
                width={50}
                axisLine={false} 
                tickLine={false} 
                tickMargin={10} 
                tickFormatter={formatCompactCurrency}
                tick={{ fill: "#64748b", fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle" 
                wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }} 
              />
              <Bar 
                dataKey="revenue" 
                name="Revenue" 
                fill="#3b82f6" 
                barSize={12}
                radius={[2, 2, 0, 0]}
              />
              <Bar 
                dataKey="expenses" 
                name="Expenses" 
                fill="#f97316" 
                barSize={12}
                radius={[2, 2, 0, 0]}
              />
              <Line 
                type="monotone" 
                dataKey="netIncome" 
                name="Net Income" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, fill: "#fff", stroke: "#10b981" }}
                activeDot={{ r: 6, fill: "#10b981", stroke: "#fff" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
