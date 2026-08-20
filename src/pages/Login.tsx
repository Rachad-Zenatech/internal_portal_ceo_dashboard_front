import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { getApiBaseUrl } from "@/lib/env";
import { appStorage } from "@/lib/storage";
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
import { Building2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshPermissions } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const hasProcessedLogin = useRef(false);

  useEffect(() => {
    const handleSsoCallback = async () => {
      if (hasProcessedLogin.current) return;

      const error = searchParams.get("error");
      const status = searchParams.get("status");

      if (error === "account_not_found") {
        hasProcessedLogin.current = true;
        setTimeout(() => {
          toast.error("Account does not exist. Please contact your administrator to be added.");
        }, 100);
        navigate("/login", { replace: true });
        return;
      }

      if (error === "account_deactivated") {
        hasProcessedLogin.current = true;
        setTimeout(() => {
          toast.error("Your account is deactivated");
        }, 100);
        navigate("/login", { replace: true });
        return;
      }

      if (status === "success") {
        hasProcessedLogin.current = true;
        setIsLoading(true);
        try {
          const token = searchParams.get("token");
          if (token) {
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            if (isMobile) {
              const expoDeepLink = `exp://localhost:8090/--/login?status=success&token=${encodeURIComponent(token)}`;
              // Immediately redirect browser to Expo mobile app
              window.location.replace(expoDeepLink);
              return;
            }

            appStorage.removeItem("token");
            appStorage.removeItem("user");
            appStorage.removeItem("ms_id_token");
            appStorage.setItem("token", token);
          }
          await refreshPermissions();
          toast.success("Successfully logged in");
          window.history.replaceState({}, document.title, window.location.pathname);
          navigate("/");
        } catch (error) {
          console.error("Failed to process SSO login", error);
          toast.error("Failed to process login");
        } finally {
          setIsLoading(false);
        }
      }
    };

    handleSsoCallback();
  }, [searchParams, navigate, refreshPermissions]);

  const handleLogin = () => {
    const baseUrl = getApiBaseUrl();
    window.location.href = `${baseUrl}/api/auth/microsoft/login`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.cardWrapper}>
        <View style={styles.iconContainer}>
          <View style={styles.iconBox}>
            <Building2 size={32} color="#2563eb" />
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
              title="Sign in with Microsoft"
              onPress={handleLogin}
              isLoading={isLoading}
              size="lg"
              style={styles.loginButton}
            />
          </NativeCardContent>

          <NativeCardFooter style={styles.footer}>
            <Text style={styles.footerText}>
              Having trouble?{" "}
              <Text style={styles.footerLink}>Contact system administrator</Text>
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
    minHeight: "100vh" as unknown as number,
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
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
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
  loginButton: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
  },
  footer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "rgba(248, 250, 252, 0.6)",
  },
  footerText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  footerLink: {
    color: "#2563eb",
    fontWeight: "600",
  },
});
