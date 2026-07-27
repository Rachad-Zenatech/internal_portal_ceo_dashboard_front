import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useAccountDistribution, type DashboardFilters } from "@/hooks/useDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import type { AccountDistributionPoint } from "@/types/dashboard";

type AccountTooltipPayload = {
  color?: string;
  payload: AccountDistributionPoint;
};

type AccountTooltipProps = {
  active?: boolean;
  payload?: AccountTooltipPayload[];
};

const CustomTooltip = ({ active, payload }: AccountTooltipProps) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    return (
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-lg p-3 rounded-lg flex flex-col gap-1 text-sm z-[100]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: payload[0].color }} />
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{dataPoint.name}</span>
        </div>
        <div className="pl-5 text-zinc-600 dark:text-zinc-400">
          Value: <span className="font-medium text-zinc-900 dark:text-zinc-100">${dataPoint.value.toLocaleString()}</span>
        </div>
        <div className="pl-5 text-zinc-600 dark:text-zinc-400">
          Share: <span className="font-medium text-zinc-900 dark:text-zinc-100">{dataPoint.percentage}</span>
        </div>
      </div>
    );
  }
  return null;
};

const CenterLabel = ({ cx, cy, index, total }: any) => {
  if (index !== 0) return null;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="pointer-events-none fill-foreground">
      <tspan x={cx} dy="-0.2em" className="text-2xl font-bold">100%</tspan>
      <tspan x={cx} dy="1.5em" className="text-xs font-medium fill-muted-foreground">${total.toLocaleString()}</tspan>
    </text>
  );
};

type AccountTypeDonutProps = {
  filters?: DashboardFilters;
};

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#f97316", "#a855f7"];

export default function AccountTypeDonut({ filters }: AccountTypeDonutProps) {
  const { data, isLoading, isError } = useAccountDistribution(filters);

  if (isLoading) {
    return (
      <Card className="w-full h-full flex flex-col rounded-2xl border-slate-200/60 shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-[200px]" />
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          <Skeleton className="h-full w-full rounded-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="w-full h-full flex flex-col rounded-2xl border-slate-200/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Account Type Distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <h3 className="text-lg font-semibold">No data</h3>
          <p className="text-sm text-muted-foreground mt-1">Failed to load account distribution.</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate total for center label
  const total = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <Card className="w-full h-full flex flex-col rounded-2xl border-slate-200/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Account Type Distribution</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-6 flex flex-col min-h-0">
        <div className="flex-1 w-full relative min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <PieChart>
              <Pie
                data={data}
                cx="45%"
                cy="50%"
                innerRadius="65%"
                outerRadius="85%"
                paddingAngle={2}
                dataKey="value"
                stroke="none"
                labelLine={false}
                label={(props) => <CenterLabel {...props} total={total} />}
              >
                {data.map((_entry: AccountDistributionPoint, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                content={<CustomTooltip />} 
                allowEscapeViewBox={{ x: true, y: true }}
                wrapperStyle={{ zIndex: 100 }}
              />
              <Legend 
                layout="vertical" 
                verticalAlign="middle" 
                align="right"
                iconType="circle"
                wrapperStyle={{ fontSize: '12px', paddingLeft: '20px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
