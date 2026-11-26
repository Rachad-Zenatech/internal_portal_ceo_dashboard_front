import { ArrowUpRight, Briefcase, Building2, Home, Landmark, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/components/Dashboard/KpiCard";

interface Props {
  financeAssets?: number;
  financeNetIncome?: number;
  isFinanceLoading: boolean;
  pendingCount: number;
  pendingAmount: number;
  isAdminLoading: boolean;
  maTargets?: number;
  maLoiAccepted?: number;
  isMaLoading: boolean;
  approvedPostsCount: number;
  publicMoodTopicsCount: number;
  isComplianceLoading: boolean;
  realEstateCount: number;
  realEstateActiveCount: number;
  realEstateCitiesCount: number;
  isRealEstateLoading: boolean;
}

interface PulseCardProps {
  title: string;
  icon: React.ReactNode;
  primary: string | number;
  secondary: string;
  loading: boolean;
  onClick: () => void;
}

function PulseCard({ title, icon, primary, secondary, loading, onClick }: PulseCardProps) {
  return (
    <Card
      size="sm"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group cursor-pointer transition-colors hover:border-foreground/25 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardHeader className="pb-1">
        <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
          {icon}
          <span>{title}</span>
        </CardDescription>
        <CardAction>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
        </CardAction>
        {loading ? (
          <Skeleton className="h-7 w-28 rounded-md mt-1" />
        ) : (
          <CardTitle className="text-2xl font-semibold tracking-tight tabular-nums">
            {primary}
          </CardTitle>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground truncate">{secondary}</p>
      </CardContent>
    </Card>
  );
}

export function PlatformPulseCards({
  financeAssets,
  financeNetIncome,
  isFinanceLoading,
  pendingCount,
  pendingAmount,
  isAdminLoading,
  maTargets,
  maLoiAccepted,
  isMaLoading,
  approvedPostsCount,
  publicMoodTopicsCount,
  isComplianceLoading,
  realEstateCount,
  realEstateActiveCount,
  realEstateCitiesCount,
  isRealEstateLoading,
}: Props) {
  const navigate = useNavigate();

  return (
    <section aria-label="Cross-platform executive pulse" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      <PulseCard
        title="Finance"
        icon={<Landmark className="h-3.5 w-3.5 text-muted-foreground" />}
        primary={formatMoney(financeAssets)}
        secondary={`Net income: ${formatMoney(financeNetIncome)}`}
        loading={isFinanceLoading}
        onClick={() => navigate("/finance")}
      />
      <PulseCard
        title="Administration"
        icon={<Building2 className="h-3.5 w-3.5 text-muted-foreground" />}
        primary={`${pendingCount} Pending`}
        secondary={`${formatMoney(pendingAmount)} awaiting approval`}
        loading={isAdminLoading}
        onClick={() => navigate("/administration")}
      />
      <PulseCard
        title="M&A Pipeline"
        icon={<Briefcase className="h-3.5 w-3.5 text-muted-foreground" />}
        primary={`${maLoiAccepted ?? 0} LOI Accepted`}
        secondary={`${maTargets ?? 0} target companies tracked`}
        loading={isMaLoading}
        onClick={() => navigate("/mergers-acquisitions")}
      />
      <PulseCard
        title="Social Compliance"
        icon={<ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />}
        primary={`${approvedPostsCount} Approved`}
        secondary={`${publicMoodTopicsCount} live public mood topics`}
        loading={isComplianceLoading}
        onClick={() => navigate("/social-media-compliance")}
      />
      <PulseCard
        title="Real Estate"
        icon={<Home className="h-3.5 w-3.5 text-muted-foreground" />}
        primary={`${realEstateCount} Properties`}
        secondary={`${realEstateActiveCount} active · ${realEstateCitiesCount} ${realEstateCitiesCount === 1 ? "city" : "cities"}`}
        loading={isRealEstateLoading}
        onClick={() => navigate("/real-estate")}
      />
    </section>
  );
}
