import { View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { SafeAreaView } from "@/components/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export interface MobileNavItem {
  label: string;
  routeName: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  section: "MAIN" | "SYSTEM ADMINISTRATION";
  navigationCode?: string;
}

export const MOBILE_NAVIGATION: MobileNavItem[] = [
  { label: "Dashboard", routeName: "Dashboard", icon: "view-dashboard-outline", section: "MAIN", navigationCode: "DASHBOARD" },
  { label: "Customization", routeName: "Customization", icon: "view-grid-plus-outline", section: "MAIN", navigationCode: "DASHBOARD" },
  { label: "Mergers & Acquisitions", routeName: "MergersAcquisitions", icon: "briefcase-outline", section: "MAIN", navigationCode: "DASHBOARD" },
  { label: "Customize - M&A", routeName: "CustomizeMA", icon: "tune-variant", section: "MAIN", navigationCode: "DASHBOARD" },
  { label: "Administration", routeName: "Administration", icon: "office-building-cog-outline", section: "MAIN", navigationCode: "DASHBOARD" },
  { label: "Customize Administration", routeName: "CustomizeAdministration", icon: "tune-variant", section: "MAIN", navigationCode: "DASHBOARD" },
  { label: "Upload Files", routeName: "UploadFiles", icon: "folder-upload-outline", section: "MAIN", navigationCode: "UPLOAD_FILES" },
  { label: "Audit Log", routeName: "AuditLog", icon: "file-clock-outline", section: "SYSTEM ADMINISTRATION", navigationCode: "AUDIT_LOG" },
  { label: "Settings", routeName: "Settings", icon: "cog-outline", section: "SYSTEM ADMINISTRATION", navigationCode: "DASHBOARD" },
];

interface DrawerNavListProps {
  groupedNavigation: Record<string, MobileNavItem[]>;
  activeRoute: string;
  onNavigate: (routeName: string) => void;
}

function DrawerNavList({ groupedNavigation, activeRoute, onNavigate }: DrawerNavListProps) {
  return (
    <ScrollView style={styles.drawerNavList} showsVerticalScrollIndicator={false}>
      {Object.entries(groupedNavigation).map(([section, items], idx) => (
        <View key={section} style={idx > 0 ? { marginTop: 20 } : undefined}>
          <Text style={styles.drawerSectionLabel}>{section}</Text>
          {items.map((item) => {
            const isActive = activeRoute === item.routeName;
            return (
              <TouchableOpacity
                key={item.routeName}
                style={[styles.drawerNavItem, isActive && styles.drawerNavItemActive]}
                onPress={() => onNavigate(item.routeName)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name={item.icon} size={20} color={isActive ? "#2563eb" : "#64748b"} />
                <Text style={[styles.drawerNavText, isActive && styles.drawerNavTextActive]} numberOfLines={1}>
                  {item.label}
                </Text>
                {isActive && <View style={styles.activeIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

interface MobileShellDrawerProps {
  visible: boolean;
  onClose: () => void;
  initials: string;
  fullName?: string;
  email?: string;
  groupedNavigation: Record<string, MobileNavItem[]>;
  activeRoute: string;
  onNavigate: (routeName: string) => void;
  onSignOut: () => void;
}

export function MobileShellDrawer({
  visible,
  onClose,
  initials,
  fullName,
  email,
  groupedNavigation,
  activeRoute,
  onNavigate,
  onSignOut,
}: MobileShellDrawerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.drawerOverlay}>
        <TouchableOpacity style={styles.drawerBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.drawerContent}>
          <SafeAreaView style={styles.drawerSafeArea}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerBrandRow}>
                <View style={styles.drawerLogoBox}>
                  <MaterialCommunityIcons name="office-building" size={22} color="#2563eb" />
                </View>
                <View>
                  <Text style={styles.drawerBrandName}>ZENATECH</Text>
                  <Text style={styles.drawerBrandSub}>CEO Executive Portal</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.drawerCloseButton} onPress={onClose} accessibilityLabel="Close menu">
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.drawerUserCard}>
              <View style={styles.drawerAvatarCircle}>
                <Text style={styles.drawerAvatarText}>{initials}</Text>
              </View>
              <View style={styles.drawerUserInfo}>
                <Text style={styles.drawerUserName} numberOfLines={1}>
                  {fullName || "Chief Executive Officer"}
                </Text>
                <Text style={styles.drawerUserEmail} numberOfLines={1}>
                  {email || "executive@zenatech.com"}
                </Text>
                <View style={styles.drawerRoleBadge}>
                  <Text style={styles.drawerRoleText}>EXECUTIVE PORTAL</Text>
                </View>
              </View>
            </View>

            <DrawerNavList groupedNavigation={groupedNavigation} activeRoute={activeRoute} onNavigate={onNavigate} />

            <View style={styles.drawerFooter}>
              <TouchableOpacity style={styles.drawerSignOutBtn} onPress={onSignOut} activeOpacity={0.7}>
                <Ionicons name="log-out-outline" size={18} color="#dc2626" />
                <Text style={styles.drawerSignOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  drawerOverlay: { flex: 1, flexDirection: "row" },
  drawerBackdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.45)" },
  drawerContent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "82%",
    maxWidth: 320,
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  drawerSafeArea: { flex: 1 },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  drawerBrandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  drawerLogoBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
  drawerBrandName: { fontSize: 15, fontWeight: "800", color: "#0f172a", letterSpacing: 0.4 },
  drawerBrandSub: { fontSize: 11, color: "#64748b" },
  drawerCloseButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  drawerUserCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    margin: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  drawerAvatarCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  drawerAvatarText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  drawerUserInfo: { flex: 1, minWidth: 0 },
  drawerUserName: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  drawerUserEmail: { fontSize: 12, color: "#64748b", marginTop: 1 },
  drawerRoleBadge: { alignSelf: "flex-start", marginTop: 5, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: "#dbeafe" },
  drawerRoleText: { fontSize: 10, fontWeight: "700", color: "#1d4ed8", letterSpacing: 0.4 },
  drawerNavList: { flex: 1, paddingHorizontal: 14 },
  drawerSectionLabel: { fontSize: 10, fontWeight: "700", color: "#94a3b8", letterSpacing: 0.8, paddingHorizontal: 10, marginBottom: 8 },
  drawerNavItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12, marginBottom: 3 },
  drawerNavItemActive: { backgroundColor: "#eff6ff" },
  drawerNavText: { flex: 1, fontSize: 14, fontWeight: "500", color: "#334155" },
  drawerNavTextActive: { color: "#1d4ed8", fontWeight: "700" },
  activeIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#2563eb" },
  drawerFooter: { padding: 16, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  drawerSignOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  drawerSignOutText: { fontSize: 14, fontWeight: "600", color: "#dc2626" },
});
