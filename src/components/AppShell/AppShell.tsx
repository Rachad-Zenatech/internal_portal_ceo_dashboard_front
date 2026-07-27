import type { ReactNode } from "react";
import { useState, useEffect } from "react";
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
    
    // Set initial state
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen min-w-[375px] min-h-[400px] overflow-hidden bg-background text-foreground">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <TopBar />
        <main
          className="flex-1 overflow-auto p-8 bg-background flex flex-col min-h-0"
        >
          <Breadcrumbs />
          <div className="flex-1 flex flex-col min-h-0">
            {children}
          </div>
        </main>
        <FloatingChat />

      </div>

      <SessionTimeout />
    </div>
  );
}
