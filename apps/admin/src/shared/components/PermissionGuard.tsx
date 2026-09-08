import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';

interface PermissionGuardProps {
  resource?: string;
  action?: string;
  permission?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  resource,
  action,
  permission,
  fallback = null,
  children,
}) => {
  const { user } = useAuth();

  const isSuperAdmin = user?.roles?.some(
    (r: any) => r.role?.slug === 'super_admin' || r.slug === 'super_admin',
  );
  if (isSuperAdmin) return <>{children}</>;

  const permString = permission || (resource && action ? `${resource}:${action}` : null);
  if (!permString) return <>{children}</>;

  if (!user?.permissions?.includes(permString)) {
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

  const isSuperAdmin = user?.roles?.some(
    (r: any) => r.role?.slug === 'super_admin' || r.slug === 'super_admin',
  );
  if (isSuperAdmin) return <>{children}</>;

  const hasRole = (roleName: string) => {
    if (!user?.roles) return false;
    return user.roles.some((r: any) => r.role?.slug === roleName || r.slug === roleName);
  };

  if (!roles.some((role) => hasRole(role))) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
