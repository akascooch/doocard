import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async getPermissionsByRole(role: string) {
    return this.prisma.permission.findMany({ where: { role } });
  }

  async getPermissionsByUser(userId: number) {
    // ابتدا نقش کاربر را پیدا کن
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) {
      throw new Error('کاربر یافت نشد');
    }

    // دسترسی‌های مخصوص کاربر را بگیر
    const userSpecificPermissions = await this.prisma.permission.findMany({
      where: { userId }
    });

    // دسترسی‌های نقش کاربر را بگیر
    const rolePermissions = await this.prisma.permission.findMany({
      where: { role: user.role }
    });

    // ترکیب دسترسی‌ها - دسترسی‌های مخصوص کاربر اولویت دارند
    const combinedPermissions = new Map();

    // ابتدا دسترسی‌های نقش را اضافه کن
    rolePermissions.forEach(perm => {
      const key = `${perm.page}_${perm.feature}`;
      combinedPermissions.set(key, perm);
    });

    // سپس دسترسی‌های مخصوص کاربر را اضافه کن (اولویت بالاتر)
    userSpecificPermissions.forEach(perm => {
      const key = `${perm.page}_${perm.feature}`;
      combinedPermissions.set(key, perm);
    });

    return Array.from(combinedPermissions.values());
  }

  async setPermissionsBulk(role: string, permissions: any[]) {
    // Start a transaction to ensure atomicity
    return this.prisma.$transaction(async (prisma) => {
      // 1. Delete all existing permissions for the given role
      await prisma.permission.deleteMany({ where: { role } });

      if (permissions.length === 0) {
        return { success: true, message: 'All permissions for this role have been revoked.' };
      }

      // 2. Prepare the data for the new permissions
      const newPermissionsData = permissions.map(p => ({
        role: role,
        page: p.page,
        feature: p.feature,
        canView: p.canView || false,
        canCreate: p.canCreate || false,
        canEdit: p.canEdit || false,
        canDelete: p.canDelete || false,
      }));

      // 3. Insert the new permissions
      await prisma.permission.createMany({
        data: newPermissionsData,
      });

      return { success: true };
    });
  }

  async setUserPermissions(userId: number, permissions: any[]) {
    // Start a transaction to ensure atomicity
    return this.prisma.$transaction(async (prisma) => {
      // 1. Delete all existing user-specific permissions
      await prisma.permission.deleteMany({ where: { userId } });

      if (permissions.length === 0) {
        return { success: true, message: 'All user-specific permissions have been revoked.' };
      }

      // 2. Prepare the data for the new permissions
      const newPermissionsData = permissions.map(p => ({
        userId: userId,
        role: '', // برای دسترسی‌های مخصوص کاربر، role خالی می‌گذاریم
        page: p.page,
        feature: p.feature,
        canView: p.canView || false,
        canCreate: p.canCreate || false,
        canEdit: p.canEdit || false,
        canDelete: p.canDelete || false,
      }));

      // 3. Insert the new permissions
      await prisma.permission.createMany({
        data: newPermissionsData,
      });

      return { success: true };
    });
  }

  async checkPermission(userId: number, page: string, feature: string): Promise<boolean> {
    try {
      const permissions = await this.getPermissionsByUser(userId);
      const permission = permissions.find(p => p.page === page && p.feature === feature);
      
      if (!permission) return false;

      switch (feature) {
        case 'view':
          return permission.canView;
        case 'create':
          return permission.canCreate;
        case 'edit':
          return permission.canEdit;
        case 'delete':
          return permission.canDelete;
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  async getAvailablePages() {
    return [
      { key: 'dashboard', label: 'داشبورد' },
      { key: 'appointments', label: 'نوبت‌ها' },
      { key: 'customers', label: 'مشتریان' },
      { key: 'barbers', label: 'آرایشگران' },
      { key: 'services', label: 'خدمات' },
      { key: 'accounting', label: 'حسابداری' },
      { key: 'users', label: 'مدیریت کاربران' },
      { key: 'settings', label: 'تنظیمات' },
      { key: 'sms', label: 'پیامک' },
      { key: 'permissions', label: 'دسترسی‌ها' },
    ];
  }

  async getAvailableFeatures() {
    return [
      { key: 'view', label: 'مشاهده' },
      { key: 'create', label: 'ایجاد' },
      { key: 'edit', label: 'ویرایش' },
      { key: 'delete', label: 'حذف' },
    ];
  }

  async resetToDefaultPermissions(role: string) {
    // حذف تمام دسترسی‌های موجود برای این نقش
    await this.prisma.permission.deleteMany({ where: { role } });

    // اجرای مجدد اسکریپت seed برای این نقش
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const defaultPermissions = {
      ADMIN: {
        dashboard: ['view', 'create', 'edit', 'delete'],
        appointments: ['view', 'create', 'edit', 'delete'],
        customers: ['view', 'create', 'edit', 'delete'],
        barbers: ['view', 'create', 'edit', 'delete'],
        services: ['view', 'create', 'edit', 'delete'],
        accounting: ['view', 'create', 'edit', 'delete'],
        users: ['view', 'create', 'edit', 'delete'],
        settings: ['view', 'create', 'edit', 'delete'],
        sms: ['view', 'create', 'edit', 'delete'],
        permissions: ['view', 'create', 'edit', 'delete'],
      },
      BARBER: {
        dashboard: ['view'],
        appointments: ['view', 'create', 'edit'],
        customers: ['view', 'create', 'edit'],
        barbers: ['view'],
        services: ['view'],
        accounting: ['view'],
        users: [],
        settings: [],
        sms: [],
        permissions: [],
      },
      CUSTOMER: {
        dashboard: ['view'],
        appointments: ['view', 'create'],
        customers: ['view'],
        barbers: ['view'],
        services: ['view'],
        accounting: [],
        users: [],
        settings: [],
        sms: [],
        permissions: [],
      },
    };

    const features = [
      { key: 'view', label: 'مشاهده' },
      { key: 'create', label: 'ایجاد' },
      { key: 'edit', label: 'ویرایش' },
      { key: 'delete', label: 'حذف' },
    ];

    const rolePermissions = defaultPermissions[role];
    if (!rolePermissions) {
      throw new Error('نقش نامعتبر');
    }

    const permissionsToCreate = [];
    
    for (const [page, allowedFeatures] of Object.entries(rolePermissions)) {
      for (const feature of features) {
        const hasPermission = (allowedFeatures as string[]).includes(feature.key);
        
        permissionsToCreate.push({
          role: role,
          page: page,
          feature: feature.key,
          canView: feature.key === 'view' ? hasPermission : false,
          canCreate: feature.key === 'create' ? hasPermission : false,
          canEdit: feature.key === 'edit' ? hasPermission : false,
          canDelete: feature.key === 'delete' ? hasPermission : false,
        });
      }
    }
    
    await prisma.permission.createMany({
      data: permissionsToCreate,
    });

    await prisma.$disconnect();
    
    return { success: true, message: `دسترسی‌های پیش‌فرض برای نقش ${role} بازگردانی شد` };
  }
} 