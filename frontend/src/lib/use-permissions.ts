import { useState, useEffect } from 'react';
import axios from '@/lib/axios';

interface Permission {
  page: string;
  feature: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface UserPermissions {
  [key: string]: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
}

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserPermissions();
  }, []);

  const fetchUserPermissions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // دریافت خلاصه دسترسی‌های کاربر
      const response = await axios.get('/permissions/user/me/summary');
      setPermissions(response.data);
    } catch (err) {
      console.error('Error fetching user permissions:', err);
      setError('خطا در بارگذاری دسترسی‌ها');
      setPermissions({});
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (page: string, feature: string): boolean => {
    if (loading || error) return false;
    
    const pagePermissions = permissions[page];
    if (!pagePermissions) return false;
    
    return pagePermissions[feature as keyof typeof pagePermissions] || false;
  };

  const canView = (page: string): boolean => hasPermission(page, 'view');
  const canCreate = (page: string): boolean => hasPermission(page, 'create');
  const canEdit = (page: string): boolean => hasPermission(page, 'edit');
  const canDelete = (page: string): boolean => hasPermission(page, 'delete');

  return {
    permissions,
    loading,
    error,
    hasPermission,
    canView,
    canCreate,
    canEdit,
    canDelete,
    refetch: fetchUserPermissions,
  };
}; 