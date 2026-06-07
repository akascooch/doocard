import { Controller, Get, Post, Body, Query, Param, ParseIntPipe, Req } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  async getPermissions(@Query('role') role: string, @Query('userId') userId?: string) {
    if (userId) {
      return this.permissionsService.getPermissionsByUser(parseInt(userId));
    }
    return this.permissionsService.getPermissionsByRole(role);
  }

  @Post('bulk')
  async setPermissions(@Body() body: { role: string; permissions: any[] }) {
    return this.permissionsService.setPermissionsBulk(body.role, body.permissions);
  }

  @Post('user/:userId')
  async setUserPermissions(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { permissions: any[] }
  ) {
    return this.permissionsService.setUserPermissions(userId, body.permissions);
  }

  @Get('check/:userId/:page/:feature')
  async checkPermission(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('page') page: string,
    @Param('feature') feature: string
  ) {
    const hasPermission = await this.permissionsService.checkPermission(userId, page, feature);
    return { hasPermission };
  }

  @Get('pages')
  async getAvailablePages() {
    return this.permissionsService.getAvailablePages();
  }

  @Get('features')
  async getAvailableFeatures() {
    return this.permissionsService.getAvailableFeatures();
  }

  @Post('reset/:role')
  async resetToDefaultPermissions(@Param('role') role: string) {
    return this.permissionsService.resetToDefaultPermissions(role);
  }

  @Get('user/:userId/summary')
  async getUserPermissionsSummary(@Param('userId', ParseIntPipe) userId: number) {
    const permissions = await this.permissionsService.getPermissionsByUser(userId);
    
    // گروه‌بندی دسترسی‌ها بر اساس صفحه
    const summary = {};
    
    permissions.forEach(perm => {
      if (!summary[perm.page]) {
        summary[perm.page] = {
          view: false,
          create: false,
          edit: false,
          delete: false
        };
      }
      
      summary[perm.page][perm.feature] = perm[`can${perm.feature.charAt(0).toUpperCase() + perm.feature.slice(1)}`];
    });
    
    return summary;
  }

  @Get('me/summary')
  async getCurrentUserPermissionsSummary(@Req() req: any) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new Error('کاربر یافت نشد');
    }
    
    const permissions = await this.permissionsService.getPermissionsByUser(userId);
    
    // گروه‌بندی دسترسی‌ها بر اساس صفحه
    const summary = {};
    
    permissions.forEach(perm => {
      if (!summary[perm.page]) {
        summary[perm.page] = {
          view: false,
          create: false,
          edit: false,
          delete: false
        };
      }
      
      summary[perm.page][perm.feature] = perm[`can${perm.feature.charAt(0).toUpperCase() + perm.feature.slice(1)}`];
    });
    
    return summary;
  }
} 