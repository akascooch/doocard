import React from 'react';
import { usePermissions } from '@/lib/use-permissions';

interface PermissionGateProps {
  page: string;
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  page,
  feature,
  children,
  fallback = null,
}) => {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return null; // یا loading spinner
  }

  if (!hasPermission(page, feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

// Helper components for common permission checks
export const CanView: React.FC<{ page: string; children: React.ReactNode; fallback?: React.ReactNode }> = ({ page, children, fallback }) => (
  <PermissionGate page={page} feature="view" fallback={fallback}>
    {children}
  </PermissionGate>
);

export const CanCreate: React.FC<{ page: string; children: React.ReactNode; fallback?: React.ReactNode }> = ({ page, children, fallback }) => (
  <PermissionGate page={page} feature="create" fallback={fallback}>
    {children}
  </PermissionGate>
);

export const CanEdit: React.FC<{ page: string; children: React.ReactNode; fallback?: React.ReactNode }> = ({ page, children, fallback }) => (
  <PermissionGate page={page} feature="edit" fallback={fallback}>
    {children}
  </PermissionGate>
);

export const CanDelete: React.FC<{ page: string; children: React.ReactNode; fallback?: React.ReactNode }> = ({ page, children, fallback }) => (
  <PermissionGate page={page} feature="delete" fallback={fallback}>
    {children}
  </PermissionGate>
); 