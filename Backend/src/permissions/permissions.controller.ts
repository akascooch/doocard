import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  async getPermissions(@Query('role') role: string) {
    return this.permissionsService.getPermissionsByRole(role);
  }

  @Post('bulk')
  async setPermissions(@Body() body: { role: string; permissions: any[] }) {
    return this.permissionsService.setPermissionsBulk(body.role, body.permissions);
  }
} 