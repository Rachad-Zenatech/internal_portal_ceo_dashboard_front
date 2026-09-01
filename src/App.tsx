import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./lib/AuthContext";
import { ServiceStatusProvider } from "./lib/ServiceStatusContext";
import { View, ActivityIndicator, StyleSheet, Platform } from "@/components/native";
import ProtectedRoute from "./components/ProtectedRoute";

import AppShell from "./components/AppShell/AppShell";
import Dashboard from "./pages/Dashboard";
import MergersAcquisitions from "./pages/MergersAcquisitions";
import Administration from "./pages/Administration";
import UploadFile from "./pages/UploadFiles";
import AuditLog from "./pages/Log/AuditLog";
import Login from "./pages/Login";
import PendingAccess from "./pages/PendingAccess";
import Settings from "./pages/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes stale time
      retry: (failureCount, error: unknown) => {
        const status =
          typeof error === "object" && error !== null && "status" in error
            ? (error as { status?: unknown }).status
            : undefined;

        // Never retry client-side authentication/permission/not-found errors
        if (status === 401 || status === 403 || status === 404) {
          return false;
        }

        // Retry server errors or network disconnects up to 2 times
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ServiceStatusProvider>
        <View style={styles.root}>
          <BrowserRouter>
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
                    path="/administration"
                    element={<Administration />}
                  />
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
                  <Route path="/settings" element={<ProtectedRoute navigationCode="DASHBOARD"><Settings /></ProtectedRoute>} />
                </Route>
              </Routes>
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
