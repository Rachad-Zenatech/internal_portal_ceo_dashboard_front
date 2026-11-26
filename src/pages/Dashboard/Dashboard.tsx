import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { apiClient } from "@/services/apiClient";
import { useCeoRealtimeStream } from "@/hooks/useCeoRealtimeStream";
import { useMessageHubLiveStatus } from "@/components/AppShell/MessageHubStatusDropdown";
import { useApprovedComplianceContent, useCompliancePublicMood } from "@/hooks/useSocialCompliance";
import { useRealEstateProperties } from "@/hooks/useRealEstate";
import { DASHBOARD_DEFAULTS } from "@/lib/boardDefaults";
import { WidgetErrorBoundary } from "@/components/common/WidgetErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { ExecutiveHeroBanner, type DashboardVisibilityPrefs } from "./ExecutiveHeroBanner";
import { PlatformPulseCards } from "./PlatformPulseCards";
import { ConnectedPlatformsHub } from "./ConnectedPlatformsHub";

const CustomBoard = lazy(() => import("@/components/Customize/CustomBoard"));

const PREFS_STORAGE_KEY = "ceo_dashboard_section_prefs_v2";
const DEFAULT_PREFS: DashboardVisibilityPrefs = {
  showPulse: true,
  showPlatforms: true,
  showCanvas: true,
};

function loadPrefs(): DashboardVisibilityPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export default function Dashboard() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<DashboardVisibilityPrefs>(loadPrefs);

  const { isConnected, lastSyncedAt, triggerManualSync } = useCeoRealtimeStream();
  const { data: hubStatus } = useMessageHubLiveStatus();
  const hubServers = hubStatus?.servers ?? [];
  const onlineCount = hubServers.filter((s) => s.status !== "offline").length;

  const { data: financeSummary, isLoading: isFinanceLoading, refetch: refetchFinance } = useQuery<{
    assets: number;
    netIncome: number;
  }>({
    queryKey: ["summaryMetrics"],
    queryFn: () => apiClient.get("/api/dashboard/summary"),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: rawApprovals = [], isLoading: isAdminLoading, isFetching: isFetchingApprovals, refetch: refetchApprovals } = useQuery<
    Array<{ amount?: number }>
  >({
    queryKey: ["admin", "pendingApprovals"],
    queryFn: ({ signal }) => apiClient.get("/api/v1/ceo/approvals/pending", { signal }),
    staleTime: 30000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: maSummary, isLoading: isMaLoading, refetch: refetchMa } = useQuery<{
    total_target_companies?: number;
    loi_accepted_count?: number;
  }>({
    queryKey: ["ma", "summary"],
    queryFn: ({ signal }) => apiClient.get("/api/v1/ceo/ma/summary", { signal }),
    staleTime: 60000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: approvedRes, isLoading: isApprovedLoading, refetch: refetchApproved } = useApprovedComplianceContent();
  const { data: moodRes, isLoading: isMoodLoading, refetch: refetchMood } = useCompliancePublicMood();
  const { data: realEstateRes, isLoading: isRealEstateLoading, refetch: refetchRealEstate } = useRealEstateProperties();

  const pendingApprovals = useMemo(() => (Array.isArray(rawApprovals) ? rawApprovals : []), [rawApprovals]);
  const pendingAmount = useMemo(
    () => pendingApprovals.reduce((sum, item) => sum + (Number(item?.amount) || 0), 0),
    [pendingApprovals]
  );

  const approvedPostsCount = approvedRes?.data?.total ?? approvedRes?.data?.items?.length ?? 0;
  const publicMoodTopicsCount =
    (moodRes?.data?.financial_zenatech?.trends?.length ?? 0) +
    (moodRes?.data?.today_posts?.trends?.length ?? 0);
  const realEstateItems = useMemo(
    () => (Array.isArray(realEstateRes?.data?.items) ? realEstateRes.data.items : []),
    [realEstateRes]
  );
  const realEstateActiveCount = useMemo(
    () => realEstateItems.filter((p) => p.record_status === "active").length,
    [realEstateItems]
  );
  const realEstateCitiesCount = useMemo(
    () => new Set(realEstateItems.map((p) => p.city?.trim()).filter(Boolean)).size,
    [realEstateItems]
  );

  const togglePref = (key: keyof DashboardVisibilityPrefs) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const refreshAll = () => {
    triggerManualSync();
    void Promise.all([
      refetchFinance(),
      refetchApprovals(),
      refetchMa(),
      refetchApproved(),
      refetchMood(),
      refetchRealEstate(),
    ]);
    toast.info("Refreshed all connected platform feeds");
  };

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 bg-background p-4 sm:p-6 lg:p-8 pb-12">
      <ExecutiveHeroBanner
        userName={user?.full_name || "Chief Executive Officer"}
        isConnected={isConnected}
        onlineCount={onlineCount}
        totalServers={hubServers.length}
        lastSyncedAt={lastSyncedAt}
        isRefreshing={isFetchingApprovals}
        prefs={prefs}
        onTogglePref={togglePref}
        onRefresh={refreshAll}
      />

      {prefs.showPulse && (
        <PlatformPulseCards
          financeAssets={financeSummary?.assets}
          financeNetIncome={financeSummary?.netIncome}
          isFinanceLoading={isFinanceLoading}
          pendingCount={pendingApprovals.length}
          pendingAmount={pendingAmount}
          isAdminLoading={isAdminLoading}
          maTargets={maSummary?.total_target_companies}
          maLoiAccepted={maSummary?.loi_accepted_count}
          isMaLoading={isMaLoading}
          approvedPostsCount={approvedPostsCount}
          publicMoodTopicsCount={publicMoodTopicsCount}
          isComplianceLoading={isApprovedLoading || isMoodLoading}
          realEstateCount={realEstateItems.length}
          realEstateActiveCount={realEstateActiveCount}
          realEstateCitiesCount={realEstateCitiesCount}
          isRealEstateLoading={isRealEstateLoading}
        />
      )}

      {prefs.showPlatforms && <ConnectedPlatformsHub servers={hubServers} />}

      {prefs.showCanvas && (
        <WidgetErrorBoundary widgetName="Customizable Executive Canvas">
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-2xl" />}>
            <CustomBoard
              embedded
              boardKey="dashboard"
              title="Customizable Executive Canvas"
              subtitle="Drag, resize, add, or configure live KPIs, charts, and tables across Finance, Administration, M&A, Social Media Compliance, and Real Estate."
              defaults={DASHBOARD_DEFAULTS}
            />
          </Suspense>
        </WidgetErrorBoundary>
      )}
    </div>
  );
}
