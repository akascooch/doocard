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
import { UploadImportDto, CommitImportDto, ClearAllDataDto } from './dto';
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
    @Body() dto: UploadImportDto,
    @Req() req: any
  ) {
    if (!file) {
      throw new BadRequestException('فایلی انتخاب نشده است');
    }

    console.log('📥 Upload import file:', file.originalname, dto.entity);

    // Parse based on entity type
    if (dto.entity === 'CUSTOMERS') {
      return this.service.parseCustomersExcel(file.buffer, dto.dryRun);
    }

    throw new BadRequestException('نوع entity پشتیبانی نمی‌شود');
  }

  /**
   * Commit parsed data to database
   */
  @Post('commit')
  async commit(@Body() dto: CommitImportDto, @Req() req: any) {
    const userId = req.user.sub || req.user.id;
    const batchId = dto.batchId || `batch-${Date.now()}`;

    console.log('💾 Committing import:', dto.entity, batchId);

    // This would get rows from a temporary store (Redis/Memory)
    // For now, we'll require re-upload
    throw new BadRequestException('این ویژگی در نسخه بعدی اضافه می‌شود. لطفاً مستقیماً import کنید.');
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

