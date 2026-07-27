import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  navigationCode?: string;
  actionCode?: string;
  children?: React.ReactNode;
}

export default function ProtectedRoute({ navigationCode, actionCode = 'VIEW', children }: ProtectedRouteProps) {
  const { user, roles, isLoading, hasPermission } = useAuth();
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is pending (has only PENDING_USER role or no roles)
  const isPending = !user.is_super_admin && (
    roles.length === 0 || 
    roles.every(r => r.code === 'PENDING_USER')
  );

  if (isPending) {
    return <Navigate to="/pending-access" replace />;
  }

  const actionMap: Record<string, string> = {
    "VIEW": "READ",
    "CREATE": "CREATE",
    "EDIT": "UPDATE",
    "UPDATE": "UPDATE",
    "DELETE": "DELETE"
  };
  const mappedAction = actionMap[actionCode] || actionCode;
  const permissionCode = navigationCode ? `${navigationCode}_${mappedAction}` : null;

  if (permissionCode && !hasPermission(permissionCode)) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center p-8 text-center bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v-2m0 2h.01M12 9v2m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mb-2">Access Denied</h2>
        <p className="text-slate-500 dark:text-zinc-400 max-w-md">
          You do not have permission to view this page. If you believe this is an error, please contact your administrator.
        </p>
      </div>
    );
  }

  return <>{children ? children : <Outlet />}</>;
}
