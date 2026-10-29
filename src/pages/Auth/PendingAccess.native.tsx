import { useAuth } from "@/lib/AuthContext";
import {
  View,
  Text,
  StyleSheet,
  NativeCard,
  NativeCardHeader,
  NativeCardTitle,
  NativeCardDescription,
  NativeCardContent,
  NativeCardFooter,
  NativeButton,
} from "@/components/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function PendingAccess() {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.cardWrapper}>
        <View style={styles.iconContainer}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="office-building" size={32} color="#2563eb" />
          </View>
        </View>

        <NativeCard style={styles.card}>
          <NativeCardHeader style={styles.header}>
            <NativeCardTitle style={styles.title}>Access Pending</NativeCardTitle>
            <NativeCardDescription style={styles.description}>
              Your account has been created successfully, but requires administrator approval for access.
            </NativeCardDescription>
          </NativeCardHeader>

          <NativeCardContent style={styles.content}>
            <Text style={styles.contentText}>
              Please contact your system administrator to assign the appropriate roles and permissions to your account.
            </Text>
          </NativeCardContent>

          <NativeCardFooter style={styles.footer}>
            <NativeButton
              variant="outline"
              title="Sign out"
              leftIcon={<MaterialCommunityIcons name="logout" size={16} color="#334155" />}
              size="lg"
              style={styles.logoutButton}
              onPress={() => {
                logout();
              }}
            />
          </NativeCardFooter>
        </NativeCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  cardWrapper: {
    width: "100%",
    maxWidth: 440,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconBox: {
    width: 64,
    height: 64,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.08)",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
  },
  header: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  description: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 6,
    textAlign: "center",
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  contentText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
  },
  footer: {
    justifyContent: "center",
    paddingVertical: 20,
    backgroundColor: "rgba(248, 250, 252, 0.6)",
  },
  logoutButton: {
    width: "100%",
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },
});
