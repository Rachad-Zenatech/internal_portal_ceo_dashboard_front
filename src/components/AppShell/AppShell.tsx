import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { View, StyleSheet } from "@/components/native";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import FloatingChat from "./FloatingChat";
import Breadcrumbs from "./Breadcrumbs";
import SessionTimeout from "./SessionTimeout";

interface Props {
  children: ReactNode;
}

export default function AppShell({ children }: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <View style={styles.root}>
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <View style={styles.mainContainer}>
        <TopBar />
        <View style={styles.contentArea}>
          <Breadcrumbs />
          <View style={styles.childContainer}>
            {children}
          </View>
        </View>
        <FloatingChat />
      </View>

      <SessionTimeout />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    height: "100vh" as unknown as number,
    minHeight: 400,
    minWidth: 375,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  mainContainer: {
    flex: 1,
    flexDirection: "column",
    minWidth: 0,
    overflow: "hidden",
    position: "relative",
  },
  contentArea: {
    flex: 1,
    flexDirection: "column",
    padding: 0,
    backgroundColor: "#f8fafc",
    overflow: "auto" as unknown as "hidden",
  },
  childContainer: {
    flex: 1,
    flexDirection: "column",
    minHeight: 0,
  },
});
