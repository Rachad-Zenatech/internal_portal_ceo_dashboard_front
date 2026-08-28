import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "@/components/native";

import Login from "./pages/Login.native";
import PendingAccess from "./pages/PendingAccess.native";
import Dashboard from "./pages/Dashboard.native";
import MergersAcquisitions from "./pages/MergersAcquisitions.native";
import UploadFiles from "./pages/UploadFiles.native";
import AuditLog from "./pages/Log/AuditLog.native";

const Stack = createNativeStackNavigator();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: false,
    },
  },
});

function NavigationContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#f8fafc" },
        animation: "slide_from_right",
      }}
    >
      {!user ? (
        <Stack.Screen name="Login" component={Login} />
      ) : user.is_active === false ? (
        <Stack.Screen name="PendingAccess" component={PendingAccess} />
      ) : (
        <>
          <Stack.Screen
            name="Dashboard"
            component={Dashboard}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="MergersAcquisitions"
            component={MergersAcquisitions}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="UploadFiles"
            component={UploadFiles}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="AuditLog"
            component={AuditLog}
            options={{
              headerShown: false,
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NavigationContainer>
            <NavigationContent />
          </NavigationContainer>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
});
