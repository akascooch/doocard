import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async getPermissionsByRole(role: string) {
    return this.prisma.permission.findMany({ where: { role } });
  }

  async setPermissionsBulk(role: string, permissions: any[]) {
    // حذف دسترسی‌های قبلی این نقش
    await this.prisma.permission.deleteMany({ where: { role } });
    // درج جدید
    await this.prisma.permission.createMany({ data: permissions.map(p => ({
      role,
      page: p.page,
      feature: p.feature,
      canView: !!p.canView,
      canEdit: !!p.canEdit,
      canDelete: !!p.canDelete,
      canCreate: !!p.canCreate,
    })) });
    return { success: true };
  }
} 