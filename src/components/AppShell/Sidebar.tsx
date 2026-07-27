import { ChevronDown, ChevronRight, PanelRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { navigation } from "./Navigation";
import { useState } from "react";
import zenatechLogo from "@/assets/zenatech_logo.png";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "../../lib/AuthContext";
import type { LucideIcon } from "lucide-react";

interface SidebarUser {
  is_super_admin?: boolean;
  assigned_roles?: Array<{ code: string }>;
}

interface SidebarNavigationItem {
  label: string;
  path?: string;
  icon: LucideIcon;
  section?: string;
  navigationCode?: string;
  subItems?: Array<{
    label: string;
    path: string;
    navigationCode?: string;
  }>;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function Sidebar({
  isOpen,
  onToggle,
}: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const location = useLocation();

  const { hasPermission, hasRole, user } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN") || user?.is_super_admin;


  const toggleExpand = (label: string) => {
    setExpandedItems(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const groupedNavigation = navigation.reduce<Record<string, SidebarNavigationItem[]>>((acc, item) => {
    if (item.navigationCode && !hasPermission(`${item.navigationCode}_READ`)) return acc;

    const filteredSubItems = item.subItems 
      ? item.subItems.filter(sub => !sub.navigationCode || hasPermission(`${sub.navigationCode}_READ`))
      : undefined;

    // If it had subItems but now they are all filtered out, don't show the parent if it relies on subItems
    if (item.subItems && (!filteredSubItems || filteredSubItems.length === 0)) {
      return acc;
    }

    const section = item.section || "GENERAL";
    if (!acc[section]) acc[section] = [];
    
    acc[section].push({ ...item, subItems: filteredSubItems });
    return acc;
  }, {});

  return (
    <aside
      className={`
        h-full flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground overflow-hidden whitespace-nowrap
        ${isOpen ? "w-72" : "w-20"}
      `}
    >
      <div className={`flex items-center h-16 px-4 transition-all duration-300 ease-in-out ${isOpen ? "justify-between" : "justify-center"}`}>
        <Link to="/" className={`transition-all duration-300 ease-in-out ${isOpen ? "opacity-100" : "opacity-0 w-0 h-0 overflow-hidden"}`}>
          <img
            src={zenatechLogo}
            alt="Zenatech Logo"
            className={`transition-all duration-300 ease-in-out object-contain cursor-pointer ${
              isOpen ? "h-20 w-auto -translate-x-4" : "w-0 h-0"
            }`}
          />
        </Link>

        <button
          onClick={onToggle}
          className="rounded-lg p-2 hover:bg-sidebar-accent flex-shrink-0"
        >
          <PanelRight size={20} />
        </button>
      </div>

      <TooltipProvider delayDuration={0}>
        <nav className="space-y-6 px-3 mt-6 pb-6 overflow-y-auto scrollbar-hide flex-1 min-h-0">
          {Object.entries(groupedNavigation).map(([section, items]) => (
          <div key={section} className="space-y-1">
            {isOpen ? (
              <div className="px-3 mb-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                {section}
              </div>
            ) : (
              <div className="h-4" /> // Spacing when collapsed
            )}
            
            {items.map((item) => {
              const Icon = item.icon;

          if (item.subItems) {
            const isExpanded = expandedItems[item.label];
            return (
              <div key={item.label} className="flex flex-col">
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        if (!isOpen) onToggle();
                        toggleExpand(item.label);
                      }}
                      className={`
                        flex items-center justify-between h-12 overflow-hidden rounded-lg transition-all duration-300 ease-in-out hover:bg-sidebar-accent text-sidebar-foreground
                        ${isOpen ? "px-3" : "px-0 justify-center"}
                      `}
                    >
                      <div className={`flex items-center ${isOpen ? "justify-start" : "justify-center"}`}>
                        <div className="flex items-center justify-center flex-shrink-0">
                          <Icon size={20} />
                        </div>
                        <span className={`text-sm font-medium transition-all duration-300 ease-in-out ${isOpen ? "opacity-100 ml-3 translate-x-0 w-auto" : "opacity-0 ml-0 -translate-x-4 w-0 overflow-hidden"}`}>
                          {item.label}
                        </span>
                      </div>
                      {isOpen && (
                        <div className="flex-shrink-0">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10} className={`font-semibold z-50 ${isOpen ? "hidden" : ""}`}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
                <div 
                  className={`ml-9 space-y-1 overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen && isExpanded ? "max-h-[1000px] mt-1 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  {item.subItems.map((sub) => {
                    const isSubActive = location.pathname === sub.path || location.pathname.startsWith(sub.path + "/");
                    return (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        className={`
                          flex items-center justify-between h-10 px-3 rounded-lg text-sm transition-all duration-300
                          ${isSubActive ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm font-semibold" : "text-muted-foreground hover:bg-sidebar-accent"}
                        `}
                      >
                        <span className="truncate">{sub.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          const isMainActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path + "/"));
          return (
            <Tooltip key={item.path} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  to={item.path!}
                  className={
                    `
                      flex items-center h-12 overflow-hidden rounded-lg transition-all duration-300 ease-in-out
                      ${isOpen ? "px-3 justify-start" : "px-0 justify-center"}
                      ${
                        isMainActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm font-semibold"
                          : "hover:bg-sidebar-accent text-sidebar-foreground font-medium"
                      }
                    `
                  }
                >
                  <div className="flex items-center justify-center flex-shrink-0">
                    <Icon size={20} />
                  </div>
                  <span
                    className={`text-sm font-medium transition-all duration-300 ease-in-out ${
                      isOpen ? "opacity-100 ml-3 translate-x-0 w-auto" : "opacity-0 ml-0 -translate-x-4 w-0 overflow-hidden"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10} className={`font-semibold z-50 ${isOpen ? "hidden" : ""}`}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
        </div>
        ))}
        </nav>
      </TooltipProvider>
    </aside>
  );
}
