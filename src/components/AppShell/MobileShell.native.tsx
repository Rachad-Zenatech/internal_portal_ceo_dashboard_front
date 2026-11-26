import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "@/components/native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type NavigationProp } from "@react-navigation/native";
import { useAuth } from "@/lib/AuthContext";
import { MOBILE_NAVIGATION, MobileShellDrawer, type MobileNavItem } from "./MobileShellDrawer.native";

export interface MobileShellProps {
  title: string;
  subtitle?: string;
  isLive?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  children: React.ReactNode;
}

export default function MobileShell({
  title,
  subtitle,
  isLive,
  onRefresh,
  isRefreshing,
  children,
}: MobileShellProps) {
  const navigation = useNavigation<NavigationProp<Record<string, undefined>>>();
  const route = useRoute();
  const { user, logout, hasPermission } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const groupedNavigation = useMemo(() => {
    return MOBILE_NAVIGATION.reduce<Record<string, MobileNavItem[]>>((acc, item) => {
      if (item.navigationCode && !hasPermission(`${item.navigationCode}_READ`)) {
        return acc;
      }
      if (!acc[item.section]) acc[item.section] = [];
      acc[item.section].push(item);
      return acc;
    }, {});
  }, [hasPermission]);

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2)
    : "CE";

  const handleNavigate = (routeName: string) => {
    setIsDrawerOpen(false);
    if (route.name !== routeName) {
      navigation.navigate(routeName);
    }
  };

  const handleSignOut = () => {
    setIsDrawerOpen(false);
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => logout() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setIsDrawerOpen(true)}
          activeOpacity={0.7}
          accessibilityLabel="Open menu"
        >
          <Ionicons name="menu-outline" size={24} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.navTitle} numberOfLines={1}>{title}</Text>
            {isLive !== undefined && (
              <View style={styles.livePill}>
                <View style={[styles.liveDot, { backgroundColor: isLive ? "#10b981" : "#f59e0b" }]} />
                <Text style={styles.liveText}>{isLive ? "Live" : "Syncing"}</Text>
              </View>
            )}
          </View>
          {subtitle ? <Text style={styles.navSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>

        <View style={styles.rightActions}>
          {onRefresh && (
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onRefresh}
              disabled={isRefreshing}
              activeOpacity={0.7}
              accessibilityLabel="Refresh"
            >
              {isRefreshing ? <ActivityIndicator size="small" color="#2563eb" /> : <Ionicons name="refresh" size={20} color="#2563eb" />}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={() => setIsDrawerOpen(true)}
            activeOpacity={0.7}
            accessibilityLabel="Account menu"
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>{children}</View>

      <MobileShellDrawer
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        initials={initials}
        fullName={user?.full_name}
        email={user?.email}
        groupedNavigation={groupedNavigation}
        activeRoute={route.name}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 10,
  },
  menuButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  titleBlock: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  navTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a", letterSpacing: -0.3 },
  navSubtitle: { fontSize: 12, color: "#64748b", marginTop: 1 },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 11, fontWeight: "600", color: "#475569" },
  rightActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  refreshButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
  avatarButton: { padding: 2 },
  avatarCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  body: { flex: 1 },
});
