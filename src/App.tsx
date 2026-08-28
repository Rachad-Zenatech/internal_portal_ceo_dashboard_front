import { BrowserRouter, MemoryRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./lib/AuthContext";
import { View, ActivityIndicator, StyleSheet, Platform } from "@/components/native";
import ProtectedRoute from "./components/ProtectedRoute";

const AppShell = lazy(() => import("./components/AppShell/AppShell"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MergersAcquisitions = lazy(() => import("./pages/MergersAcquisitions"));
const UploadFile = lazy(() => import("./pages/UploadFiles"));
const AuditLog = lazy(() => import("./pages/Log/AuditLog"));
const Login = lazy(() => import("./pages/Login"));
const PendingAccess = lazy(() => import("./pages/PendingAccess"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error: unknown) => {
        const status =
          typeof error === "object" && error !== null && "status" in error
            ? (error as { status?: unknown }).status
            : undefined;
        if (status === 401 || status === 403) {
          return false;
        }
        return failureCount < 3;
      },
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

function App() {
  const RouterComponent = Platform.OS === "web" ? BrowserRouter : MemoryRouter;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <View style={styles.root}>
          <RouterComponent>
            <Suspense fallback={<FallbackLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/pending-access" element={<PendingAccess />} />

                {/* Main app layout routes */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppShell>
                        <Outlet />
                      </AppShell>
                    </ProtectedRoute>
                  }
                >
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute navigationCode="DASHBOARD">
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/mergers-acquisitions" element={<ProtectedRoute navigationCode="DASHBOARD"><MergersAcquisitions /></ProtectedRoute>} />
                  <Route
                    path="/upload-files"
                    element={
                      <ProtectedRoute navigationCode="UPLOAD_FILES">
                        <UploadFile />
                      </ProtectedRoute>
                    }
                  />

                  {/* Logs */}
                  <Route path="/log" element={<Navigate to="/log/audit-log" replace />} />
                  <Route
                    path="/log/audit-log"
                    element={
                      <ProtectedRoute navigationCode="AUDIT_LOG">
                        <AuditLog />
                      </ProtectedRoute>
                    }
                  />

                  {/* Settings redirect to dashboard */}
                  <Route path="/settings" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </RouterComponent>
        </View>
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



