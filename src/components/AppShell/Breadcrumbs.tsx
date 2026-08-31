import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { useEffect, useState } from "react";

export default function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);
  const [customTitles, setCustomTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    const handleSetTitle = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string; title: string }>;
      setCustomTitles((prev) => ({
        ...prev,
        [customEvent.detail.path]: customEvent.detail.title,
      }));
    };
    document.addEventListener("set-breadcrumb-title", handleSetTitle);
    return () => document.removeEventListener("set-breadcrumb-title", handleSetTitle);
  }, []);

  // Define custom mapping for breadcrumb names to ensure they look pretty
  const formatName = (name: string) => {
    return name
      .replace(/-/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Don't show breadcrumbs on the dashboard (root)
  if (pathnames.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center text-xs sm:text-sm text-slate-500 dark:text-zinc-400 px-4 sm:px-6 lg:px-7 pt-3.5 pb-2 overflow-x-auto whitespace-nowrap scrollbar-none min-h-[40px] select-none"
    >
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800/60"
        title="Command Center Home"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>

      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join("/")}`;
        const isLast = index === pathnames.length - 1;

        return (
          <div key={to} className="flex items-center">
            <ChevronRight className="h-3.5 w-3.5 mx-1.5 text-slate-400 dark:text-zinc-600 shrink-0" />
            {isLast ? (
              <span
                className="font-semibold text-slate-900 dark:text-zinc-100 px-1 py-0.5"
                aria-current="page"
              >
                {customTitles[to] || formatName(value)}
              </span>
            ) : (
              <Link
                to={to}
                className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline underline-offset-4 transition-colors px-1 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800/60"
              >
                {customTitles[to] || formatName(value)}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
