import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  Param,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ImportService } from './import.service';
import { CommitImportDto } from './dto';
import { parseUploadImportBody } from './dto/parse-upload-import-body';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('import')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Roles('ADMIN')
export class ImportController {
  constructor(
    private readonly service: ImportService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Download Excel template for customers
   */
  @Get('templates/customers')
  async downloadCustomersTemplate(@Res() res: Response) {
    const workbook = await this.service.generateCustomersTemplate();
    
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=customers-template.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  /**
   * Upload and parse Excel file (with validation)
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: { sub?: number; id?: number }; body?: Record<string, unknown> },
  ) {
    if (!file) {
      throw new BadRequestException('فایلی انتخاب نشده است');
    }

    const dto = await parseUploadImportBody(req.body);
    const userId = req.user.sub || req.user.id;
    console.log('📥 Upload import file:', file.originalname, dto.entity);

    if (dto.entity === 'CUSTOMERS') {
      return this.service.previewCustomers(file.buffer, file.originalname, userId);
    }

    if (dto.entity === 'APPOINTMENTS') {
      return this.service.previewRawAppointments(file.buffer, file.originalname, userId);
    }

    throw new BadRequestException('نوع entity پشتیبانی نمی‌شود');
  }

  /**
   * Commit a previewed import (requires previewToken from upload response).
   */
  @Post('commit')
  async commit(@Body() dto: CommitImportDto, @Req() req: any) {
    const userId = req.user.sub || req.user.id;

    if (!dto.batchId) {
      throw new BadRequestException('شناسه پیش‌نمایش (batchId) الزامی است');
    }
    if (!dto.confirmed) {
      throw new BadRequestException('تأیید صریح import الزامی است');
    }

    console.log('💾 Committing import:', dto.entity, dto.batchId);

    if (dto.entity === 'CUSTOMERS') {
      return this.service.commitCustomers(dto.batchId, userId);
    }

    if (dto.entity === 'APPOINTMENTS') {
      return this.service.commitAppointments(dto.batchId, userId, {
        createMissing: dto.createMissing,
        createIncomeTx: dto.createIncomeTx,
      });
    }

    throw new BadRequestException('نوع entity پشتیبانی نمی‌شود');
  }

  /**
   * Get list of import jobs
   */
  @Get('jobs')
  async getJobs(@Req() req: any) {
    const userId = req.user.sub || req.user.id;

    return this.prisma.importJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Get specific job details
   */
  @Get('jobs/:id')
  async getJob(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.importJob.findUnique({
      where: { id },
      include: { user: { select: { name: true, phone: true } } },
    });
  }
}

