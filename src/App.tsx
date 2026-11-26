import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./lib/AuthContext";
import { ServiceStatusProvider } from "./lib/ServiceStatusContext";
import { View, ActivityIndicator, StyleSheet, Platform } from "@/components/native";
import ProtectedRoute from "./components/common/ProtectedRoute";

import AppShell from "./components/AppShell/AppShell";
import Dashboard from "./pages/Dashboard/Dashboard";
import FinancePage from "./pages/Finance/FinancePage";
import ApprovedContentPage from "./pages/SocialMediaCompliance/ApprovedContentPage";
import PublicMoodPage from "./pages/SocialMediaCompliance/PublicMoodPage";
import RealEstatePage from "./pages/RealEstate/RealEstatePage";
import MergersAcquisitions from "./pages/MergersAcquisitions/MergersAcquisitions";
import Administration from "./pages/Administration/Administration";
import UploadFile from "./pages/UploadFiles/UploadFiles";
import AuditLog from "./pages/Log/AuditLog";
import Login from "./pages/Auth/Login";
import PendingAccess from "./pages/Auth/PendingAccess";
import Settings from "./pages/Settings/Settings";
const AiStatusPage = lazy(() => import("./pages/Configurations/AiStatusPage"));

// Customizable boards pull in the grid/drag library, so load them on demand.
const Customization = lazy(() => import("./pages/Customization/Customization"));
const CustomizeFinance = lazy(() => import("./pages/Customization/CustomizeFinance"));
const CustomizeMA = lazy(() => import("./pages/Customization/CustomizeMA"));
const CustomizeAdministration = lazy(() => import("./pages/Customization/CustomizeAdministration"));
const CustomizeCompliance = lazy(() => import("./pages/Customization/CustomizeCompliance"));
const CustomizeRealEstate = lazy(() => import("./pages/Customization/CustomizeRealEstate"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: (failureCount, error: unknown) => {
        const status =
          typeof error === "object" && error !== null && "status" in error
            ? (error as { status?: unknown }).status
            : undefined;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

function FallbackLoader() {
  return (
    <View style={styles.loaderContainer}>
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  );
}

function ShellLayout() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  );
}

function guarded(navigationCode: string, element: React.ReactNode) {
  return <ProtectedRoute navigationCode={navigationCode}>{element}</ProtectedRoute>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/pending-access" element={<PendingAccess />} />
      <Route element={<ShellLayout />}>
        <Route path="/" element={guarded("DASHBOARD", <Dashboard />)} />
        <Route path="/finance" element={guarded("DASHBOARD", <FinancePage />)} />
        <Route path="/customize-finance" element={guarded("DASHBOARD", <CustomizeFinance />)} />
        <Route path="/social-media-compliance" element={guarded("DASHBOARD", <ApprovedContentPage />)} />
        <Route path="/social-media-compliance/public-mood" element={guarded("DASHBOARD", <PublicMoodPage />)} />
        <Route path="/real-estate" element={guarded("DASHBOARD", <RealEstatePage />)} />
        <Route path="/real-estate/properties" element={guarded("DASHBOARD", <RealEstatePage />)} />
        <Route path="/real-estate/properties/:propertyId" element={guarded("DASHBOARD", <RealEstatePage />)} />
        <Route path="/mergers-acquisitions" element={guarded("DASHBOARD", <MergersAcquisitions />)} />
        <Route path="/administration" element={<Administration />} />
        <Route path="/customization" element={guarded("DASHBOARD", <Customization />)} />
        <Route path="/customize-ma" element={guarded("DASHBOARD", <CustomizeMA />)} />
        <Route path="/customize-administration" element={guarded("DASHBOARD", <CustomizeAdministration />)} />
        <Route path="/customize-compliance" element={guarded("DASHBOARD", <CustomizeCompliance />)} />
        <Route path="/customize-real-estate" element={guarded("DASHBOARD", <CustomizeRealEstate />)} />
        <Route path="/upload-files" element={guarded("UPLOAD_FILES", <UploadFile />)} />
        <Route path="/log" element={<Navigate to="/log/audit-log" replace />} />
        <Route path="/log/audit-log" element={guarded("AUDIT_LOG", <AuditLog />)} />
        <Route path="/settings" element={guarded("DASHBOARD", <Settings />)} />
        <Route path="/configurations/ai-status" element={guarded("SYSTEM_LOGS", <AiStatusPage />)} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ServiceStatusProvider>
          <View style={styles.root}>
            <BrowserRouter>
              <Suspense fallback={<FallbackLoader />}>
                <AppRoutes />
              </Suspense>
            </BrowserRouter>
          </View>
        </ServiceStatusProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    height: Platform.OS === "web" ? ("100vh" as unknown as number) : "100%",
    width: "100%",
    backgroundColor: "#ffffff",
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
});

export default App;
