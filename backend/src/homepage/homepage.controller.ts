import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { HomepageService } from './homepage.service';
import {
  CreateLandingSlideDto,
  UpdateHomepageDetailsDto,
  UpdateLandingSlideDto,
  UpdateLandingStaffDto,
} from './dto/update-homepage-details.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { Public } from '../common/decorators/public.decorator';

@Controller('homepage')
export class HomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  @Public()
  @Get('public-data')
  getPublicData() {
    return this.homepageService.getPublicData();
  }

  @Public()
  @Get()
  getHomepageDetails() {
    return this.homepageService.getHomepageDetails();
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateHomepageDetails(@Body() dto: UpdateHomepageDetailsDto) {
    return this.homepageService.updateHomepageDetails(dto);
  }

  @Get('slides')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  listSlides() {
    return this.homepageService.listSlides();
  }

  @Post('slides')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createSlide(@Body() dto: CreateLandingSlideDto) {
    return this.homepageService.createSlide(dto);
  }

  @Patch('slides/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateSlide(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLandingSlideDto,
  ) {
    return this.homepageService.updateSlide(id, dto);
  }

  @Delete('slides/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteSlide(@Param('id', ParseIntPipe) id: number) {
    return this.homepageService.deleteSlide(id);
  }

  @Get('staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  listStaff() {
    return this.homepageService.listStaffCandidates();
  }

  @Put('staff/:employeeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateStaff(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Body() dto: UpdateLandingStaffDto,
  ) {
    return this.homepageService.updateStaff(employeeId, dto);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          cb(new BadRequestException('فقط JPEG، PNG یا WebP مجاز است'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.homepageService.saveUpload(file);
  }
}
