import { useState, useEffect } from "react";
import { apiClient as api } from "@/services/apiClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ShieldCheck,
  Search,
  Sparkles,
  ChevronDown,
  Check,
  X,
  AlertTriangle,
  UserPlus,
  UserCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface AssignApproversModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface WorkflowAssignment {
  id?: number;
  role: string;
  user_id?: string | null;
  user_ids?: string[];
  active?: boolean;
}

interface DirectoryUser {
  id: string;
  email: string;
  full_name?: string;
  display_name?: string;
  department?: string;
  job_title?: string;
  microsoft_object_id?: string;
  object_id?: string;
  user_principal_name?: string;
  is_active?: boolean;
}

const WORKFLOW_ROLES = [
  {
    role: "EXECUTIVE",
    label: "Senior Approver (≥ $10,000)",
    desc: "Authorized sign-off for high-value expenditures and capital purchases.",
    badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200",
  },
  {
    role: "MANAGER",
    label: "Standard Approver (< $10,000)",
    desc: "Initial line management review and standard spend approvals.",
    badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200",
  },
  {
    role: "PURCHASING",
    label: "Purchasing Lead",
    desc: "Vendor quote negotiations, purchase orders, and fulfillment.",
    badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200",
  },
  {
    role: "AP",
    label: "Accounts Payable (AP)",
    desc: "Invoice matching, vendor statement review, and GL validation.",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200",
  },
  {
    role: "TREASURY",
    label: "Treasury Officer",
    desc: "Bank disbursement, wire authorization, and final settlement.",
    badgeColor: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200",
  },
];

export function AssignApproversModal({
  isOpen,
  onClose,
  onSuccess,
}: AssignApproversModalProps) {
  const [workflowAssignments, setWorkflowAssignments] = useState<WorkflowAssignment[]>([]);
  const [allUsers, setAllUsers] = useState<DirectoryUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeDropdownRole, setActiveDropdownRole] = useState<string | null>(null);
  const [userSearchText, setUserSearchText] = useState("");
  const [graphSearchResults, setGraphSearchResults] = useState<DirectoryUser[]>([]);
  const [isSearchingGraph, setIsSearchingGraph] = useState(false);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);

  // Warning Dialog State for empty MANAGER role (auto approval)
  const [isManagerWarningOpen, setIsManagerWarningOpen] = useState(false);

  const fetchWorkflowAssignments = async () => {
    setIsLoading(true);
    try {
      const [assnRes, userRes] = await Promise.all([
        api.get<WorkflowAssignment[]>("/api/purchasing/assignments").catch(() => []),
        api.get<any>("/api/configuration/users?is_active=true").catch(() => []),
      ]);
      const rawAssns = Array.isArray(assnRes) ? assnRes : [];
      const canonicalRoles = WORKFLOW_ROLES.map((r) => r.role);
      
      const roleMap: Record<string, WorkflowAssignment> = {};
      for (const r of canonicalRoles) {
        roleMap[r] = { role: r, user_ids: [], user_id: null, active: true };
      }

      for (const item of rawAssns) {
        if (canonicalRoles.includes(item.role)) {
          const existing = roleMap[item.role];
          // Take the primary assignment record per role
          if (!existing.id || (item.user_ids && item.user_ids.length > 0 && (!existing.user_ids || existing.user_ids.length === 0))) {
            const itemUserIds: string[] = item.user_ids || (item.user_id ? [item.user_id] : []);
            roleMap[item.role] = {
              id: item.id,
              role: item.role,
              user_ids: itemUserIds,
              user_id: itemUserIds[0] || null,
              active: item.active !== false,
            };
          }
        }
      }

      setWorkflowAssignments(Object.values(roleMap));
      const userList = Array.isArray(userRes) ? userRes : (userRes as any)?.items || [];
      setAllUsers(userList);
    } catch (err) {
      console.error("Failed to fetch workflow assignments:", err);
      toast.error("Failed to load approver assignments. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWorkflowAssignments();
      setUserSearchText("");
      setGraphSearchResults([]);
      setIsManagerWarningOpen(false);
    }
  }, [isOpen]);

  // Live Microsoft Entra & Directory search
  useEffect(() => {
    const query = userSearchText.trim();
    if (!query) {
      setGraphSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingGraph(true);
      try {
        const res = await api.get<DirectoryUser[]>(`/api/graph/users/search?q=${encodeURIComponent(query)}`);
        setGraphSearchResults(res || []);
      } catch {
        setGraphSearchResults([]);
      } finally {
        setIsSearchingGraph(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [userSearchText]);

  const handleToggleUserInRole = (role: string, userId: string, extraUserObj?: any) => {
    if (isLoading || isSavingAssignments) return;
    if (extraUserObj && !allUsers.some((u) => u.id === userId || (u.email && extraUserObj.email && u.email.toLowerCase() === extraUserObj.email.toLowerCase()))) {
      setAllUsers((prev) => [
        ...prev,
        { id: userId, full_name: extraUserObj.display_name || extraUserObj.full_name, email: extraUserObj.email, ...extraUserObj },
      ]);
    }
    setWorkflowAssignments((prev) => {
      const existing = prev.find((a) => a.role === role);
      if (existing) {
        const currentIds: string[] = existing.user_ids || (existing.user_id ? [existing.user_id] : []);
        const nextIds = currentIds.includes(userId)
          ? currentIds.filter((id) => id !== userId)
          : [...currentIds, userId];
        return prev.map((a) => (a.role === role ? { ...a, user_ids: nextIds, user_id: nextIds[0] || null } : a));
      } else {
        return [...prev, { role, user_ids: [userId], user_id: userId, active: true }];
      }
    });
  };

  const handleToggleEntraUser = (role: string, entraUser: any) => {
    if (isLoading || isSavingAssignments) return;
    const matchingLocal = allUsers.find(
      (u) =>
        (u.microsoft_object_id && entraUser.object_id && u.microsoft_object_id === entraUser.object_id) ||
        (u.email && entraUser.email && u.email.toLowerCase() === entraUser.email.toLowerCase())
    );
    const userId = matchingLocal ? matchingLocal.id : (entraUser.object_id || entraUser.email);
    handleToggleUserInRole(role, userId, { ...entraUser, id: userId });
  };

  const handleAddCustomEntraUser = (role: string, rawInput: string) => {
    if (isLoading || isSavingAssignments) return;
    const cleanInput = rawInput.trim();
    if (!cleanInput) return;
    const email = cleanInput.includes("@") ? cleanInput.toLowerCase() : `${cleanInput.toLowerCase()}@zenatech.com`;
    const displayName = cleanInput.includes("@")
      ? cleanInput.split("@")[0].replace(".", " ").replace(/\b\w/g, (l) => l.toUpperCase())
      : cleanInput.replace(/\b\w/g, (l) => l.toUpperCase());

    const newEntraUser = {
      id: email,
      object_id: email,
      email: email,
      full_name: displayName,
      display_name: displayName,
      department: "Organization",
      is_active: true,
    };
    handleToggleEntraUser(role, newEntraUser);
    setUserSearchText("");
  };

  const handleSaveClick = () => {
    if (isLoading || isSavingAssignments) return;
    // Check if MANAGER role has no users assigned
    const managerAssignment = workflowAssignments.find((a) => a.role === "MANAGER");
    const managerIds = managerAssignment?.user_ids || (managerAssignment?.user_id ? [managerAssignment.user_id] : []);

    if (managerIds.length === 0) {
      setIsManagerWarningOpen(true);
      return;
    }

    performSave();
  };

  const performSave = async () => {
    setIsSavingAssignments(true);
    setIsManagerWarningOpen(false);
    try {
      const saveTasks = WORKFLOW_ROLES.map(async (roleDef) => {
        const role = roleDef.role;
        const item = workflowAssignments.find((a) => a.role === role);
        const userIds: string[] = item?.user_ids || (item?.user_id ? [item.user_id] : []);

        // Sync HIGH_LEVEL_APPROVER / LOW_LEVEL_APPROVER via PBAC approver role API concurrently
        const syncPbacPromise = (async () => {
          if (role === "EXECUTIVE" || role === "MANAGER") {
            const approverRoleCode = role === "EXECUTIVE" ? "HIGH_LEVEL_APPROVER" : "LOW_LEVEL_APPROVER";
            const membersToProvision = userIds
              .map((uid) => {
                const u = (allUsers.find((x) => x.id === uid || (x.email && x.email.toLowerCase() === uid.toLowerCase())) || {}) as Partial<DirectoryUser>;
                return {
                  object_id: u.microsoft_object_id || u.object_id || uid,
                  email: u.email || uid,
                  display_name: u.full_name || u.display_name || uid,
                  job_title: u.job_title || null,
                  department: u.department || null,
                };
              })
              .filter((m) => m.email);

            if (membersToProvision.length > 0) {
              try {
                await api.post(`/api/approver-roles/${approverRoleCode}/members`, membersToProvision);
              } catch (roleErr) {
                console.warn(`Approver role sync note for ${approverRoleCode}:`, roleErr);
              }
            }
          }
        })();

        const payload = {
          role: role,
          user_ids: userIds,
          user_id: userIds[0] || null,
          request_type: null,
          active: true,
        };

        const saveAssignmentPromise = (async () => {
          if (item?.id && item.id > 0) {
            try {
              await api.put(`/api/purchasing/assignments/${item.id}`, payload);
            } catch {
              await api.put(`/purchasing/assignments/${item.id}`, payload);
            }
          } else {
            try {
              await api.post("/api/purchasing/assignments", payload);
            } catch {
              await api.post("/purchasing/assignments", payload);
            }
          }
        })();

        await Promise.all([syncPbacPromise, saveAssignmentPromise]);
      });

      await Promise.all(saveTasks);

      toast.success("Approver assignments updated successfully");
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update approver assignments");
    } finally {
      setIsSavingAssignments(false);
    }
  };

  const isFormDisabled = isLoading || isSavingAssignments;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && !isSavingAssignments && onClose()}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto p-6 rounded-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 shrink-0">
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <ShieldCheck className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                    CEO / Executive Approver Assignment
                    {isLoading && (
                      <span className="text-[11px] font-normal text-indigo-600 dark:text-indigo-400 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full">
                        <Loader2 className="w-3 h-3 animate-spin" /> Fetching...
                      </span>
                    )}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Directly configure authorized approvers and delegation across core purchasing pipelines.
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Body: Skeleton Loading or Interactive List */}
          {isLoading ? (
            <div className="space-y-3.5 py-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/40 space-y-2.5 animate-pulse"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-40 rounded" />
                        <Skeleton className="h-4 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-3 w-3/4 rounded" />
                    </div>
                    <Skeleton className="h-8 w-24 rounded-lg shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Skeleton className="h-6 w-28 rounded-full" />
                    <Skeleton className="h-6 w-36 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`space-y-3.5 py-4 ${isFormDisabled ? "opacity-60 pointer-events-none" : ""}`}>
              {WORKFLOW_ROLES.map(({ role, label, desc, badgeColor }) => {
                const assignment = workflowAssignments.find((a) => a.role === role);
                const assignedIds: string[] = assignment?.user_ids || (assignment?.user_id ? [assignment.user_id] : []);
                const isManagerRole = role === "MANAGER";
                const isAutoApproved = isManagerRole && assignedIds.length === 0;

                return (
                  <div
                    key={role}
                    className={`p-4 rounded-xl border transition-all ${
                      isAutoApproved
                        ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40"
                        : "bg-slate-50/60 dark:bg-zinc-900/60 border-slate-200/80 dark:border-zinc-800"
                    } space-y-2`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900 dark:text-zinc-100">
                            {label}
                          </span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium ${badgeColor}`}>
                            {role}
                          </Badge>
                          {isAutoApproved && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border-amber-300 gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Auto-Approved
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>

                      {/* Popover Dropdown Selector */}
                      <Popover
                        open={activeDropdownRole === role}
                        onOpenChange={(open) => {
                          if (isFormDisabled) return;
                          setActiveDropdownRole(open ? role : null);
                          if (open) {
                            setUserSearchText("");
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isFormDisabled}
                            className="h-8 border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs gap-1.5 px-3 shrink-0"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Assign / Edit
                            <ChevronDown className="w-3 h-3 opacity-60" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="end"
                          sideOffset={6}
                          onWheel={(e) => e.stopPropagation()}
                          onTouchMove={(e) => e.stopPropagation()}
                          className="w-84 p-0 z-[100] shadow-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl pointer-events-auto"
                        >
                          <div className="p-2.5 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
                            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <input
                              type="text"
                              placeholder="Search name, email, or Entra directory..."
                              value={userSearchText}
                              onChange={(e) => setUserSearchText(e.target.value)}
                              className="w-full text-xs bg-transparent outline-none placeholder:text-muted-foreground"
                              autoFocus
                            />
                            {isSearchingGraph && (
                              <div className="w-3 h-3 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin shrink-0" />
                            )}
                          </div>

                          {/* Scrollable User List */}
                          <div
                            onWheel={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            className="max-h-64 overflow-y-auto overscroll-contain p-1.5 space-y-1 divide-y divide-slate-100 dark:divide-zinc-800 touch-pan-y"
                          >
                            {/* Portal Directory Users */}
                            <div className="space-y-0.5 pb-1">
                              {allUsers
                                .filter(
                                  (u) =>
                                    u.is_active !== false &&
                                    (u.full_name || u.display_name || u.email || "")
                                      .toLowerCase()
                                      .includes(userSearchText.toLowerCase())
                                )
                                .map((u) => {
                                  const isChecked = assignedIds.includes(u.id) || (u.email && assignedIds.includes(u.email));
                                  return (
                                    <button
                                      key={u.id}
                                      type="button"
                                      onClick={() => handleToggleUserInRole(role, u.id, u)}
                                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors text-left ${
                                        isChecked
                                          ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-medium"
                                          : "hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                                      }`}
                                    >
                                      <div className="flex flex-col min-w-0 pr-2">
                                        <span className="truncate">{u.full_name || u.display_name || "Unnamed"}</span>
                                        <span className="text-[10px] text-muted-foreground truncate">{u.email}</span>
                                      </div>
                                      {isChecked && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                                    </button>
                                  );
                                })}
                            </div>

                            {/* Microsoft Entra Graph Search Results */}
                            {graphSearchResults.length > 0 && (
                              <div className="pt-1.5 space-y-0.5">
                                <div className="px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  Microsoft Entra Directory
                                </div>
                                {graphSearchResults
                                  .filter(
                                    (gu) =>
                                      !allUsers.some(
                                        (u) =>
                                          (u.email && gu.email && u.email.toLowerCase() === gu.email.toLowerCase()) ||
                                          (u.id && gu.object_id && u.id === gu.object_id)
                                      )
                                  )
                                  .map((gu) => {
                                    const entraKey = gu.object_id || gu.email;
                                    const isChecked = assignedIds.includes(entraKey) || (gu.email && assignedIds.includes(gu.email));
                                    return (
                                      <button
                                        key={entraKey}
                                        type="button"
                                        onClick={() => handleToggleEntraUser(role, gu)}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors text-left ${
                                          isChecked
                                            ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-medium"
                                            : "hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                                        }`}
                                      >
                                        <div className="flex flex-col min-w-0 pr-2">
                                          <div className="flex items-center gap-1.5">
                                            <span className="truncate">{gu.display_name || "Unnamed"}</span>
                                            <span className="px-1 py-0.2 text-[9px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded font-medium">
                                              Entra
                                            </span>
                                          </div>
                                          <span className="text-[10px] text-muted-foreground truncate">
                                            {gu.email || gu.user_principal_name}
                                          </span>
                                        </div>
                                        {isChecked && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                                      </button>
                                    );
                                  })}
                              </div>
                            )}

                            {/* Quick-Add Entra / Company Email Option */}
                            {userSearchText.trim().length > 0 && (
                              <div className="pt-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleAddCustomEntraUser(role, userSearchText)}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-medium text-left border border-dashed border-indigo-200 dark:border-indigo-800/60 transition-colors"
                                >
                                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                                  <div className="flex flex-col min-w-0">
                                    <span className="truncate">Add & Assign Entra User "{userSearchText.trim()}"</span>
                                    <span className="text-[10px] text-muted-foreground truncate">
                                      {userSearchText.includes("@") ? userSearchText.trim() : `${userSearchText.trim()}@zenatech.com`}
                                    </span>
                                  </div>
                                </button>
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Assigned Users Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {assignedIds.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">
                          {isManagerRole ? "No approvers assigned (Purchases < $10,000 will be auto-approved)" : "No approvers assigned"}
                        </span>
                      ) : (
                        assignedIds.map((uid) => {
                          const userObj = allUsers.find((x) => x.id === uid || (x.email && x.email.toLowerCase() === uid.toLowerCase()));
                          const displayName = userObj?.full_name || userObj?.display_name || userObj?.email || uid;
                          const email = userObj?.email;
                          return (
                            <Badge
                              key={uid}
                              variant="secondary"
                              title={email ? `${displayName} (${email})` : displayName}
                              className="text-xs py-1 px-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-2xs flex items-center gap-1.5 font-normal text-slate-800 dark:text-zinc-200"
                            >
                              <span>{displayName}</span>
                              {email && email !== displayName && (
                                <span className="text-[10px] text-muted-foreground opacity-80">({email})</span>
                              )}
                              <button
                                type="button"
                                disabled={isFormDisabled}
                                onClick={() => handleToggleUserInRole(role, uid)}
                                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 ml-0.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter className="border-t border-slate-100 dark:border-zinc-800 pt-3">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isSavingAssignments}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveClick}
              disabled={isFormDisabled}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {isSavingAssignments ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Save Assignments
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning Alert Dialog when MANAGER role has 0 users assigned */}
      <AlertDialog open={isManagerWarningOpen} onOpenChange={setIsManagerWarningOpen}>
        <AlertDialogContent className="sm:max-w-[480px] rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <AlertDialogTitle className="text-base font-bold">
                Auto-Approval Warning (MANAGER Role)
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-slate-600 dark:text-zinc-400 pt-2 leading-relaxed">
              No approvers are assigned to the <strong>Standard Approver (&lt; $10,000) (MANAGER)</strong> role.
              <br /><br />
              Without an assigned manager, all purchasing requests under $10,000 will be <strong>automatically approved</strong> by default.
              <br /><br />
              Are you sure you want to save this configuration?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-2">
            <AlertDialogCancel className="text-xs h-9" disabled={isSavingAssignments}>
              Go Back & Assign Approver
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={performSave}
              disabled={isSavingAssignments}
              className="text-xs h-9 bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              {isSavingAssignments ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Confirm & Enable Auto-Approval"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
