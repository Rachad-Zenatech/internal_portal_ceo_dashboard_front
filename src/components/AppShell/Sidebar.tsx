import { Link, useLocation } from "react-router-dom";
import { navigation } from "./Navigation";
import { useState, useMemo } from "react";
import zenatechLogo from "@/assets/zenatech_logo.png";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "../../lib/AuthContext";
import { PanelRight, ChevronDown, ChevronRight } from "lucide-react";
import type { NavigationItem } from "./Navigation";

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
  const { hasPermission } = useAuth();

  const toggleExpand = (label: string) => {
    setExpandedItems(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const groupedNavigation = useMemo(() => {
    return navigation.reduce<Record<string, NavigationItem[]>>((acc, item) => {
      if (item.navigationCode && !hasPermission(`${item.navigationCode}_READ`)) return acc;

      const filteredSubItems = item.subItems 
        ? item.subItems.filter(sub => !sub.navigationCode || hasPermission(`${sub.navigationCode}_READ`))
        : undefined;

      if (item.subItems && (!filteredSubItems || filteredSubItems.length === 0)) {
        return acc;
      }

      const section = item.section || "GENERAL";
      if (!acc[section]) acc[section] = [];
      
      acc[section].push({ ...item, subItems: filteredSubItems });
      return acc;
    }, {});
  }, [hasPermission]);

  return (
    <aside
      className={`
        h-full flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground overflow-hidden whitespace-nowrap select-none
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
          aria-label="Toggle Sidebar"
          className="rounded-lg p-2 hover:bg-sidebar-accent flex-shrink-0 cursor-pointer"
        >
          <PanelRight size={20} />
        </button>
      </div>

      <TooltipProvider delayDuration={100}>
        <nav className="space-y-6 px-3 mt-6 pb-6 overflow-y-auto scrollbar-hide flex-1 min-h-0">
          {Object.entries(groupedNavigation).map(([section, items]) => (
            <div key={section} className="space-y-1">
              {isOpen ? (
                <div className="px-3 mb-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  {section}
                </div>
              ) : (
                <div className="h-4" />
              )}
              
              {items.map((item) => {
                const Icon = item.icon;

                if (item.subItems) {
                  const isExpanded = expandedItems[item.label];
                  return (
                    <div key={item.label} className="flex flex-col">
                      <button
                        onClick={() => {
                          if (!isOpen) onToggle();
                          toggleExpand(item.label);
                        }}
                        className={`
                          flex items-center justify-between h-12 overflow-hidden rounded-lg transition-colors hover:bg-sidebar-accent text-sidebar-foreground cursor-pointer
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
                      <div 
                        className={`ml-9 space-y-1 overflow-hidden transition-all duration-200 ease-in-out ${
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
                                flex items-center justify-between h-10 px-3 rounded-lg text-sm transition-colors cursor-pointer
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
                
                const linkElement = (
                  <Link
                    to={item.path!}
                    className={`
                      flex items-center h-12 overflow-hidden rounded-lg transition-colors cursor-pointer
                      ${isOpen ? "px-3 justify-start" : "px-0 justify-center"}
                      ${
                        isMainActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm font-semibold"
                          : "hover:bg-sidebar-accent text-sidebar-foreground font-medium"
                      }
                    `}
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
                );

                if (!isOpen) {
                  return (
                    <Tooltip key={item.path} delayDuration={50}>
                      <TooltipTrigger asChild>
                        {linkElement}
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={10} className="font-semibold z-50">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return <div key={item.path}>{linkElement}</div>;
              })}
            </div>
          ))}
        </nav>
      </TooltipProvider>
    </aside>
  );
}