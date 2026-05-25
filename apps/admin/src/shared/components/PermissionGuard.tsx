import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';

interface PermissionGuardProps {
  resource: string;
  action: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  resource,
  action,
  fallback = null,
  children,
}) => {
  const { user } = useAuth();

  const hasPermission = (resource: string, action: string) => {
    if (!user?.permissions) return false;
    return user.permissions.includes(`${resource}:${action}`);
  };

  if (!hasPermission(resource, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

interface RoleGuardProps {
  roles: string[];
  fallback?: ReactNode;
  children: ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ roles, fallback = null, children }) => {
  const { user } = useAuth();

  const hasRole = (roleName: string) => {
    if (!user?.roles) return false;
    return user.roles.some((r: any) => r.role.slug === roleName);
  };

  if (!roles.some((role) => hasRole(role))) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
