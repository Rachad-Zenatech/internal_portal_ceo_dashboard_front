import { useState, useEffect, useRef } from "react";
import { Search, Bell, Building2, BookText, FileText, Banknote, Loader2, LogOut, User, Bot, Sparkles, Mail, BellRing, Settings2, CheckCheck, X, CloudDownload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import ThemeSwitch from "./ThemeSwitch";
import { useGlobalSearch } from "@/hooks/useSearch";
import { useAuth } from "@/lib/AuthContext";
import { useNotifications, useUnreadNotificationCount, useMarkNotificationAsRead, useMarkAllNotificationsAsRead, useClearAllNotifications } from "@/hooks/useNotifications";
import { useCeoRealtimeStream } from "@/hooks/useCeoRealtimeStream";


function TopBarClock() {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dayName = currentTime.toLocaleDateString("en-US", { weekday: "short" });
  const monthName = currentTime.toLocaleDateString("en-US", { month: "short" });
  const formattedDate = `${monthName}, ${currentTime.getDate()} ${currentTime.getFullYear()} (${dayName})`;
  const formattedTime = currentTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <div className="hidden lg:flex flex-col items-end justify-center mr-2">
      <span className="text-sm font-bold text-foreground leading-tight tracking-tight">
        {formattedTime}
      </span>
      <span className="text-[11px] font-semibold text-muted-foreground mt-0.5">
        {formattedDate}
      </span>
    </div>
  );
}


export default function TopBar() {
  const [inputValue, setInputValue] = useState("");
  const [debouncedValue, setDebouncedValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [inAppAlerts, setInAppAlerts] = useState(() => localStorage.getItem("inAppAlerts") !== "false");
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, roles, logout } = useAuth();
  // Debounce input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, 300);
    return () => clearTimeout(handler);
  }, [inputValue]);

  const { data: results = [], isLoading, isFetching } = useGlobalSearch(debouncedValue);
  useCeoRealtimeStream();
  const { data: notifications = [] } = useNotifications();
  const { data: unreadCountData } = useUnreadNotificationCount();
  const { mutate: markAsRead } = useMarkNotificationAsRead();
  const { mutate: markAllAsRead, isPending: isMarkingAll } = useMarkAllNotificationsAsRead();
  const { mutate: clearAll, isPending: isClearingAll } = useClearAllNotifications();
  const unreadCount = unreadCountData?.count ?? 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case "company": return <Building2 className="h-4 w-4 text-blue-500" />;
      case "gl_account": return <BookText className="h-4 w-4 text-emerald-500" />;
      case "gl_entry": return <FileText className="h-4 w-4 text-amber-500" />;
      case "bank_transaction": return <Banknote className="h-4 w-4 text-purple-500" />;
      default: return <Search className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleResultClick = (url: string) => {
    setIsOpen(false);
    setInputValue("");
    setDebouncedValue("");
    if (url) {
      navigate(url);
    }
  };

  return (
    <header className="h-20 border-b border-border bg-card text-card-foreground flex items-center justify-between px-4 sm:px-6 md:px-8 shrink-0 transition-all duration-300 gap-4">
      <div className="flex-1 flex items-center min-w-0">
        <div ref={containerRef} className="relative w-full max-w-md z-50">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search for anything here..." 
            className="w-full pl-11 bg-muted border-none rounded-full h-11 text-sm shadow-inner focus-visible:ring-1 focus-visible:ring-ring"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (inputValue.trim().length > 0) setIsOpen(true);
            }}
          />
          
          {isOpen && debouncedValue.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border shadow-lg rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {isLoading || isFetching ? (
                <div className="p-6 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm">Searching...</span>
                </div>
              ) : results.length > 0 ? (
                <div className="max-h-[400px] overflow-y-auto py-2">
                  {results.map((result, idx) => (
                    <div 
                      key={`${result.type}-${result.id}-${idx}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleResultClick(result.url || "/")}
                    >
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border/50 shadow-sm">
                        {getIcon(result.type)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-foreground truncate">{result.title}</span>
                        {result.subtitle && (
                          <span className="text-xs text-muted-foreground truncate">{result.subtitle}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  <div className="px-4 py-2 border-t border-border/50 mt-2">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start gap-3 h-14 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-300"
                      onClick={() => {
                        setIsOpen(false);
                        setInputValue("");
                        setDebouncedValue("");
                        window.dispatchEvent(new CustomEvent('ask-ai', { detail: { query: debouncedValue } }));
                      }}
                    >
                      <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col items-start min-w-0">
                        <span className="text-sm font-semibold truncate">Ask AI "{debouncedValue}"</span>
                        <span className="text-xs opacity-80 truncate">Can't find what you need? Ask our AI assistant</span>
                      </div>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-8 flex flex-col items-center justify-center text-center">
                  <span className="text-sm text-muted-foreground mb-4">
                    No results found for "{debouncedValue}"
                  </span>
                  <Button 
                    variant="outline" 
                    className="gap-2 rounded-xl border-blue-200 hover:border-blue-300 hover:bg-blue-50 dark:border-blue-900/50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors"
                    onClick={() => {
                      setIsOpen(false);
                      setInputValue("");
                      setDebouncedValue("");
                      window.dispatchEvent(new CustomEvent('ask-ai', { detail: { query: debouncedValue } }));
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    Ask AI "{debouncedValue}"
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
        {/* TopBar Ask AI Copilot Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.dispatchEvent(new CustomEvent("open-ai-chat"))}
          className="h-9 px-3 rounded-xl border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/70 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-medium text-xs gap-2 transition-all shadow-2xs group"
          title="Open AI Executive Assistant (Say 'Hey Zena')"
        >
          <div className="relative flex items-center justify-center">
            <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <span className="hidden sm:inline">Ask AI</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-200/60 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 font-bold hidden md:inline">
            Hey Zena
          </span>
        </Button>

        <TopBarClock />
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div><ThemeSwitch /></div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle Theme</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="hidden sm:flex items-center gap-1.5 border-r pr-2 sm:pr-4 md:pr-5 mr-1">
          <DropdownMenu open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground hover:bg-muted rounded-full h-8.5 w-8.5 outline-none focus-visible:ring-0">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-card" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[480px] p-0 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950 shadow-2xl border border-slate-200 dark:border-zinc-800">
              {/* Header */}
              <div className="flex items-center justify-between pt-5 px-5 pb-3">
                <span className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">Notifications</span>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-slate-200 dark:border-zinc-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800" onClick={() => setIsNotificationsOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Tabs */}
              <div className="px-5 border-b border-slate-100 dark:border-zinc-800 flex gap-6">
                <button className="text-sm font-semibold text-slate-900 dark:text-zinc-100 border-b-2 border-slate-900 dark:border-zinc-100 pb-3">View all</button>
              </div>

              {/* List */}
              <div className="max-h-[400px] overflow-y-auto py-2">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500 dark:text-zinc-400">
                    You have no notifications.
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const isUnread = !notification.is_read;
                    const dateObj = new Date(notification.created_at);
                    const dayString = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                    const timeString = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
                    const fullDateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const capitalizedTitle = notification.title ? notification.title.charAt(0).toUpperCase() + notification.title.slice(1) : "";

                    return (
                      <div
                        key={notification.id}
                        onClick={() => {
                          if (!notification.is_read) {
                            markAsRead(notification.id);
                          }
                          if (notification.link_url) {
                            setIsNotificationsOpen(false);
                            navigate(notification.link_url);
                          }
                        }}
                        className={`px-5 py-5 cursor-pointer transition-colors duration-200 flex gap-4 group ${
                          isUnread ? "bg-slate-50/50 hover:bg-slate-50 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/50" : "hover:bg-slate-50 dark:hover:bg-zinc-900/30"
                        }`}
                      >
                        {/* Avatar */}
                        <div className="shrink-0 relative">
                          {(notification as any).sender_avatar ? (
                            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden shadow-sm">
                              <img src={(notification as any).sender_avatar} alt={(notification as any).sender_name || "Sender"} className="h-full w-full object-cover" />
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800 shadow-sm">
                              <Bell className="h-4 w-4" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Sender name + action */}
                          <div className="flex justify-between items-start">
                            <p className="text-sm font-medium text-slate-900 dark:text-zinc-100 leading-snug pr-4">
                              {capitalizedTitle}
                            </p>
                            {/* Unread Dot */}
                            {isUnread && <div className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-500 shrink-0 mt-1 shadow-sm" />}
                          </div>

                          {/* Message box if present */}
                          {notification.message && (!(notification as any).attachments || (notification as any).attachments.length === 0) && (
                            <div className="mt-2.5 p-3.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm font-medium text-slate-700 dark:text-zinc-300 shadow-sm leading-relaxed whitespace-pre-line">
                              {notification.message}
                            </div>
                          )}

                          {/* Attachments if present */}
                          {(notification as any).attachments && (notification as any).attachments.length > 0 && (
                            <div className="mt-3 flex flex-col gap-2">
                              {(notification as any).attachments.map((att: any, i: number) => (
                                <div key={i} className="flex items-center justify-between bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-12 h-10 bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-lg flex items-center justify-center shrink-0">
                                      <FileText className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">{att.filename || 'Attachment'}</span>
                                      <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-0.5">{att.size ? `${Math.round(att.size / 1024 / 1024)} MB` : '14 MB'}</span>
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-zinc-100 shrink-0">
                                    <CloudDownload className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Footer times */}
                          <div className="flex items-center justify-between mt-3 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                            <span>{dayString} {timeString}</span>
                            <span>{fullDateString}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-950">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    className="h-9 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-bold tracking-tight transition-colors gap-2" 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAllAsRead(); }} 
                    disabled={isMarkingAll}
                  >
                    <CheckCheck className={`h-4 w-4 ${isMarkingAll ? "animate-pulse" : ""}`} />
                    Mark all as read
                  </Button>
                </div>
                <Button 
                  className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearAll(); }}
                  disabled={notifications.length === 0 || isClearingAll}
                >
                  {isClearingAll ? "Clearing..." : "Clear All"}
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:bg-muted p-1.5 sm:p-2 sm:pr-3 rounded-xl transition-colors border border-transparent hover:border-border outline-none">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0 border border-border shadow-sm">
                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || user?.email || "User")}&background=eff6ff&color=2563eb&rounded=true&bold=true`} alt="User avatar" className="h-full w-full object-cover" />
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-sm font-bold text-foreground leading-tight">{user?.full_name || "User"}</span>
                <span className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                  {user?.is_super_admin ? "Super Admin" : roles.length > 0 ? roles[0].name : "Standard User"}
                </span>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setIsProfileOpen(true)} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => setIsLogoutOpen(true)} 
              className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-100 dark:focus:bg-red-900/30"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[600px] p-0 overflow-hidden border-border/50 shadow-2xl rounded-2xl flex flex-col">
          <div className="bg-muted/30 border-b px-8 py-8 flex items-center gap-5">
            <div className="h-20 w-20 rounded-full border-2 border-border bg-muted overflow-hidden shadow-sm relative group">
              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || user?.email || "User")}&background=eff6ff&color=2563eb&rounded=true&bold=true`} alt="User avatar" className="h-full w-full object-cover" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold">{user?.full_name || "User"}</DialogTitle>
              <DialogDescription className="text-sm mt-1">
                {user?.email} • {user?.is_super_admin ? "Super Admin" : roles.length > 0 ? roles.map(r => r.name).join(", ") : "Standard User"}
              </DialogDescription>
            </div>
          </div>
          
          <Tabs defaultValue="general" className="w-full flex-1 flex flex-col">
            <div className="px-8 pt-6">
              <TabsList className="grid w-full grid-cols-2 h-11 bg-muted/50">
                <TabsTrigger value="general" className="rounded-md font-semibold text-xs uppercase tracking-wider">General</TabsTrigger>
                <TabsTrigger value="preferences" className="rounded-md font-semibold text-xs uppercase tracking-wider">Preferences</TabsTrigger>
              </TabsList>
            </div>

            <div className="px-8 py-6 flex-1 overflow-y-auto max-h-[60vh]">
              <TabsContent value="general" className="space-y-6 mt-0 border-none outline-none">
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name</Label>
                    <Input id="firstName" readOnly defaultValue={user?.full_name || ""} className="bg-muted/30 border-border focus-visible:ring-primary/30 h-11" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</Label>
                      <Input readOnly defaultValue="Finance & Operations" className="bg-muted/30 border-border text-muted-foreground h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Roles</Label>
                      <Input readOnly value={user?.is_super_admin ? "Super Admin" : roles.length > 0 ? roles.map(r => r.name).join(", ") : "Standard User"} className="bg-muted/30 border-border text-muted-foreground h-11" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</Label>
                    <Input id="email" type="text" readOnly defaultValue={user?.email || ""} className="bg-muted/30 border-border h-10" />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preferences" className="space-y-6 mt-0 border-none outline-none">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" /> App Settings
                  </h4>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Theme Preference</Label>
                      <p className="text-xs text-muted-foreground">Select your preferred interface theme</p>
                    </div>
                    <ThemeSwitch />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card opacity-70">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" /> Email Notifications
                      </Label>
                      <p className="text-xs text-muted-foreground">Receive daily digest emails</p>
                    </div>
                    <div className="h-5 w-9 bg-primary/20 rounded-full relative cursor-not-allowed">
                      <div className="h-4 w-4 bg-primary rounded-full absolute right-0.5 top-0.5" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <BellRing className="h-3.5 w-3.5" /> In-App Alerts
                      </Label>
                      <p className="text-xs text-muted-foreground">Show push notifications</p>
                    </div>
                    <div 
                      className={`h-5 w-9 rounded-full relative cursor-pointer transition-colors ${inAppAlerts ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                      onClick={() => {
                        const newVal = !inAppAlerts;
                        setInAppAlerts(newVal);
                        localStorage.setItem("inAppAlerts", String(newVal));
                      }}
                    >
                      <div className={`h-4 w-4 bg-background rounded-full absolute top-0.5 transition-all ${inAppAlerts ? 'right-0.5' : 'left-0.5'}`} />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
          
        </DialogContent>
      </Dialog>

      <Dialog open={isLogoutOpen} onOpenChange={setIsLogoutOpen}>
        <DialogContent className="sm:max-w-[425px] outline-none">
          <DialogHeader className="flex flex-col items-center space-y-4 pt-4">
            <div className="h-16 w-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center">
              <LogOut className="h-8 w-8 ml-1" />
            </div>
            <DialogTitle className="text-xl text-center">Log Out</DialogTitle>
            <DialogDescription className="text-center px-2">
              Are you sure you want to log out of your account? You will need to sign back in to access the portal.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-3 sm:justify-center mt-4 pb-2 px-2">
            <Button variant="outline" onClick={() => setIsLogoutOpen(false)} className="flex-1 rounded-xl h-11 font-semibold">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                setIsLogoutOpen(false);
                logout();
              }} 
              className="flex-1 rounded-xl h-11 bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-lg transition-all font-semibold"
            >
              Log Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
