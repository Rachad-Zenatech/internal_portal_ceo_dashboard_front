import { useState, useEffect } from "react";
import { Alert, View, Text, StyleSheet, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import {
  NativeCard,
  NativeCardHeader,
  NativeCardTitle,
  NativeCardDescription,
  NativeCardContent,
  NativeCardFooter,
  NativeButton,
} from "@/components/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getApiBaseUrl } from "@/lib/env";
import { useAuth } from "@/lib/AuthContext";
import { appStorage } from "@/lib/storage";

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const { refreshPermissions } = useAuth();

  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const match = event.url.match(/[?&]token=([^&]+)/);
      if (match && match[1]) {
        const token = decodeURIComponent(match[1]);
        appStorage.setItem("token", token);
        await refreshPermissions();
        if (Platform.OS === "ios") {
          try {
            WebBrowser.dismissAuthSession();
          } catch {}
        }
      }
    };

    const sub = Linking.addEventListener("url", handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => {
      sub.remove();
    };
  }, [refreshPermissions]);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const baseUrl = getApiBaseUrl();
      const ssoUrl = `${baseUrl}/api/auth/microsoft/login`;
      const redirectUrl = Linking.createURL("login");
      
      // In-app authentication browser: automatically intercepts redirect and dismisses popup
      const result = await WebBrowser.openAuthSessionAsync(
        ssoUrl,
        redirectUrl
      );

      if (result.type === "success" && result.url) {
        // Extract token from redirect URL
        const match = result.url.match(/[?&]token=([^&]+)/);
        if (match && match[1]) {
          const token = decodeURIComponent(match[1]);
          appStorage.setItem("token", token);
          await refreshPermissions();
        }
      }
    } catch (err: unknown) {
      Alert.alert(
        "Sign In Error",
        (err as Error)?.message || "Failed to complete sign in"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectLogin = async () => {
    setIsLoading(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/developer/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "rachad.quintyne@zenatech.com" }),
      });
      const data = await res.json();
      if (data.token) {
        appStorage.setItem("token", data.token);
        await refreshPermissions();
      } else {
        Alert.alert("Login Failed", data.detail || "Unable to sign in");
      }
    } catch (err: unknown) {
      Alert.alert("Login Error", (err as Error)?.message || "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

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
            <NativeCardTitle style={styles.title}>Welcome</NativeCardTitle>
            <NativeCardDescription style={styles.description}>
              Sign in with your @zenatech.com account
            </NativeCardDescription>
          </NativeCardHeader>

          <NativeCardContent style={styles.content}>
            <NativeButton
              onPress={handleLogin}
              disabled={isLoading}
              variant="default"
              size="lg"
              style={styles.signInButton}
            >
              <View style={styles.buttonContent}>
                <MaterialCommunityIcons
                  name="microsoft"
                  size={20}
                  color="#ffffff"
                  style={styles.buttonIcon}
                />
                <Text style={styles.buttonText}>
                  {isLoading ? "Signing in..." : "Sign in with Microsoft"}
                </Text>
              </View>
            </NativeButton>

            <NativeButton
              onPress={handleDirectLogin}
              disabled={isLoading}
              variant="outline"
              size="lg"
              style={[styles.signInButton, { marginTop: 12, backgroundColor: "#f1f5f9" }]}
            >
              <View style={styles.buttonContent}>
                <MaterialCommunityIcons
                  name="shield-account"
                  size={20}
                  color="#2563eb"
                  style={styles.buttonIcon}
                />
                <Text style={[styles.buttonText, { color: "#1e293b" }]}>
                  {isLoading ? "Signing in..." : "Direct Dev Sign In"}
                </Text>
              </View>
            </NativeButton>
          </NativeCardContent>

          <NativeCardFooter style={styles.footer}>
            <Text style={styles.footerText}>
              Having trouble?{" "}
              <Text style={styles.contactLink}>Contact system administrator</Text>
            </Text>
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
    maxWidth: 420,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 24,
    alignItems: "center",
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  card: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
  },
  header: {
    alignItems: "center",
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  signInButton: {
    width: "100%",
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  footer: {
    paddingTop: 8,
    paddingBottom: 16,
    alignItems: "center",
  },
  footerText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
  contactLink: {
    color: "#2563eb",
    fontWeight: "500",
  },
});
