import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { apiClient } from '../services/apiClient';
import { appStorage } from './storage';
import { getEnv } from './env';

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_super_admin: boolean;
  is_active?: boolean;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
  is_system_role?: boolean;
  parent_role_id?: string | null;
  display_order?: number;
  department?: string;
  children?: Role[];
}

interface PermissionsData {
  user: User;
  roles: Role[];
  navigation_permissions: Record<string, string[]>;
  mcp_tool_permissions: string[];
}

interface AuthContextType {
  user: User | null;
  roles: Role[];
  isLoading: boolean;
  canAccessNavigationItem: (navigationCode: string, actionCode?: string) => boolean;
  hasPermission: (permissionCode: string) => boolean;
  canUseMcpTool: (toolCode: string) => boolean;
  hasRole: (roleCode: string) => boolean;
  logout: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<PermissionsData | null>(null);
  const [isLoading, setIsLoading] = useState(() => !!appStorage.getItem('token'));

  const fetchRequestId = useRef(0);

  const fetchPermissions = useCallback(async () => {
    const requestId = ++fetchRequestId.current;
    const token = appStorage.getItem('token');
    if (!token) {
      setPermissions(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    if (token === "dev-session-token") {
      setPermissions({
        user: {
          id: "dev-user-1",
          email: "rachad.quintyne@zenatech.com",
          full_name: "Rachad Quintyne",
          is_super_admin: true,
          is_active: true,
        },
        roles: [
          {
            id: "role-1",
            name: "CEO & Super Admin",
            code: "SUPER_ADMIN",
            is_active: true,
            is_system_role: true,
          },
        ],
        navigation_permissions: { "*": ["*"] },
        mcp_tool_permissions: ["*"],
      });
      setIsLoading(false);
      return;
    }
    try {
      const data = await apiClient.get<PermissionsData>('/api/me/permissions');
      if (requestId === fetchRequestId.current) {
        setPermissions(data);
      }
    } catch {
      if (requestId === fetchRequestId.current) {
        setPermissions(null);
        appStorage.removeItem('token');
        appStorage.removeItem('user');
        appStorage.removeItem('ms_id_token');
        appStorage.clear();
      }
    } finally {
      if (requestId === fetchRequestId.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchPermissions();

    if (typeof window !== "undefined" && window.addEventListener) {
      const handleBeforeUnload = () => {
        const token = appStorage.getItem('token');
        if (token && typeof navigator !== "undefined" && navigator.sendBeacon) {
          const data = new FormData();
          data.append('token', token);
          const rawBaseUrl = getEnv("VITE_API_BASE_URL", "");
          const url = `${rawBaseUrl.replace(/\/$/, '')}/api/auth/logout`;
          navigator.sendBeacon(url, data);
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [fetchPermissions]);



  const canAccessNavigationItem = (navigationCode: string, actionCode = 'VIEW') => {
    if (!permissions) return false;
    if (permissions.user.is_super_admin) return true;
    if (permissions.roles.some((r) => r.code === 'SUPER_ADMIN')) return true;
    
    const pageActions = permissions.navigation_permissions[navigationCode];
    if (!pageActions) return false;
    
    return pageActions.includes(actionCode);
  };

  const hasPermission = (permissionCode: string) => {
    if (!permissions) return false;
    if (permissions.user.is_super_admin) return true;
    if (permissions.roles.some((r) => r.code === 'SUPER_ADMIN')) return true;
    
    const lastUnderscoreIndex = permissionCode.lastIndexOf('_');
    let navigationCode = permissionCode;
    let actionCode = 'PAGE_ACCESS';
    
    if (lastUnderscoreIndex !== -1) {
      navigationCode = permissionCode.substring(0, lastUnderscoreIndex);
      actionCode = permissionCode.substring(lastUnderscoreIndex + 1);
    }
    
    const actionMap: Record<string, string> = {
      "READ": "VIEW",
      "UPDATE": "UPDATE",
      "CREATE": "CREATE",
      "DELETE": "DELETE",
      "IMPORT": "CREATE",
      "EXPORT": "VIEW",
      "PROCESS": "UPDATE",
      "PAGE_ACCESS": "VIEW"
    };
    
    const dbActionCode = actionMap[actionCode] || actionCode;
    const pageActions = permissions.navigation_permissions[navigationCode];
    
    if (!pageActions) return false;
    return pageActions.includes(dbActionCode);
  };

  const canUseMcpTool = (toolCode: string) => {
    if (!permissions) return false;
    if (permissions.user.is_super_admin) return true;
    if (permissions.roles.some((r) => r.code === 'SUPER_ADMIN')) return true;
    
    return permissions.mcp_tool_permissions.includes(toolCode);
  };

  const hasRole = (roleCode: string) => {
    if (!permissions) return false;
    return permissions.roles.some((r) => r.code === roleCode);
  };

  const logout = async () => {

    try {
      await apiClient.post('/api/auth/logout', {});
    } catch (e) {
      console.error('Failed to logout on backend', e);
    }
    
    const authProvider = appStorage.getItem('auth_provider');
    
    appStorage.removeItem('token');
    appStorage.removeItem('user');
    appStorage.removeItem('ms_id_token');
    appStorage.removeItem('auth_provider');
    setPermissions(null);
    
    if (typeof window !== "undefined" && window.location) {
      if (authProvider === 'local') {
        window.location.href = '/login';
      } else {
        const postLogoutUri = encodeURIComponent(window.location.origin + '/login');
        window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=${postLogoutUri}`;
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: permissions?.user || null,
        roles: permissions?.roles || [],
        isLoading,
        canAccessNavigationItem,
        hasPermission,
        canUseMcpTool,
        hasRole,
        logout,
        refreshPermissions: fetchPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
