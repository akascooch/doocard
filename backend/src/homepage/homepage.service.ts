import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateLandingSlideDto,
  UpdateHomepageDetailsDto,
  UpdateLandingSlideDto,
  UpdateLandingStaffDto,
} from './dto/update-homepage-details.dto';

const DEFAULT_WORKING_HOURS = JSON.stringify({
  weekdays: '۱۰:۰۰ – ۲۲:۰۰',
  friday: '۱۱:۰۰ – ۲۰:۰۰',
  note: 'هماهنگی از طریق رزرو آنلاین',
});

const LANDING_UPLOAD_DIR = join(process.cwd(), 'uploads', 'landing');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Injectable()
export class HomepageService {
  constructor(private prisma: PrismaService) {}

  private defaultDetails(): Prisma.HomepageDetailsCreateInput {
    return {
      about:
        'در قلب تهران، فضایی خصوصی و آرام برای آقایانی که به جزئیات، سکوت و دقت اهمیت می‌دهند.',
      team: 'تیم حرفه‌ای ما',
      products: 'محصولات و خدمات ما',
      trainings: 'دوره‌های آموزشی',
      testimonials: 'نظرات مشتریان',
      contact:
        'تیم دوکارد آماده پاسخ‌گویی به سوالات شما درباره خدمات و نوبت‌ها است.',
      heroTitle: 'DOOCARD BARBERSHOP',
      heroSubtitle: 'PRECISION IN EVERY DETAIL',
      phone: '021-26353460',
      address: 'تهران، فرشته، مجتمع سام، طبقه ۵، واحد ۱۰۳',
      instagramUrl: 'https://www.instagram.com/doocard',
      workingHours: DEFAULT_WORKING_HOURS,
    };
  }

  async ensureDetails() {
    let details = await this.prisma.homepageDetails.findFirst();
    if (!details) {
      details = await this.prisma.homepageDetails.create({
        data: this.defaultDetails(),
      });
    }
    return details;
  }

  async getHomepageDetails() {
    return this.ensureDetails();
  }

  async updateHomepageDetails(dto: UpdateHomepageDetailsDto) {
    const details = await this.ensureDetails();
    return this.prisma.homepageDetails.update({
      where: { id: details.id },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
    });
  }

  async getPublicData() {
    const details = await this.ensureDetails();
    const [slides, staff] = await Promise.all([
      this.prisma.landingSlide.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.employee.findMany({
        where: { isActive: true, showOnLanding: true },
        include: { user: { select: { id: true, name: true } } },
        orderBy: [{ landingSortOrder: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return {
      heroTitle: details.heroTitle || 'DOOCARD BARBERSHOP',
      heroSubtitle: details.heroSubtitle || 'PRECISION IN EVERY DETAIL',
      aboutText: details.about || '',
      contact: details.contact || '',
      phone: details.phone || '021-26353460',
      address: details.address || 'تهران، فرشته، مجتمع سام، طبقه ۵، واحد ۱۰۳',
      instagramUrl: details.instagramUrl || 'https://www.instagram.com/doocard',
      workingHours: details.workingHours || DEFAULT_WORKING_HOURS,
      slides: slides.map((s) => ({
        id: s.id,
        imageUrl: s.imageUrl,
        title: s.title,
        subtitle: s.subtitle,
        sortOrder: s.sortOrder,
      })),
      staff: staff.map((e) => ({
        id: e.id,
        name: e.user?.name ?? `آرایشگر #${e.id}`,
        displayTitle: e.displayTitle || e.specialty || 'Barber',
        bio: e.bio,
        avatarUrl: e.avatarUrl,
        sortOrder: e.landingSortOrder,
      })),
    };
  }

  async listSlides() {
    return this.prisma.landingSlide.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  async createSlide(dto: CreateLandingSlideDto) {
    this.assertLandingAssetUrl(dto.imageUrl);
    return this.prisma.landingSlide.create({
      data: {
        imageUrl: dto.imageUrl,
        title: dto.title,
        subtitle: dto.subtitle,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        updatedAt: new Date(),
      },
    });
  }

  async updateSlide(id: number, dto: UpdateLandingSlideDto) {
    const existing = await this.prisma.landingSlide.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('اسلاید یافت نشد');
    if (dto.imageUrl) this.assertLandingAssetUrl(dto.imageUrl);
    return this.prisma.landingSlide.update({
      where: { id },
      data: { ...dto, updatedAt: new Date() },
    });
  }

  async deleteSlide(id: number) {
    const existing = await this.prisma.landingSlide.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('اسلاید یافت نشد');
    await this.prisma.landingSlide.delete({ where: { id } });
    this.tryUnlinkLandingFile(existing.imageUrl);
    return { ok: true };
  }

  async listStaffCandidates() {
    const employees = await this.prisma.employee.findMany({
      where: { isActive: true },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: [{ landingSortOrder: 'asc' }, { id: 'asc' }],
    });
    return employees.map((e) => ({
      id: e.id,
      name: e.user?.name ?? `کارمند #${e.id}`,
      role: e.user?.role,
      specialty: e.specialty,
      avatarUrl: e.avatarUrl,
      bio: e.bio,
      displayTitle: e.displayTitle,
      showOnLanding: e.showOnLanding,
      landingSortOrder: e.landingSortOrder,
    }));
  }

  async updateStaff(employeeId: number, dto: UpdateLandingStaffDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) throw new NotFoundException('کارمند یافت نشد');
    if (dto.avatarUrl) this.assertLandingAssetUrl(dto.avatarUrl);
    return this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        showOnLanding: dto.showOnLanding,
        avatarUrl: dto.avatarUrl === undefined ? undefined : dto.avatarUrl,
        displayTitle: dto.displayTitle === undefined ? undefined : dto.displayTitle,
        bio: dto.bio === undefined ? undefined : dto.bio,
        landingSortOrder: dto.landingSortOrder,
      },
      include: { user: { select: { id: true, name: true, role: true } } },
    });
  }

  saveUpload(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('فایل تصویر الزامی است');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('حجم تصویر حداکثر ۵ مگابایت است');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('فقط JPEG، PNG یا WebP مجاز است');
    }
    mkdirSync(LANDING_UPLOAD_DIR, { recursive: true });
    const ext =
      file.mimetype === 'image/png'
        ? '.png'
        : file.mimetype === 'image/webp'
          ? '.webp'
          : '.jpg';
    const name = `${randomUUID()}${ext}`;
    const abs = join(LANDING_UPLOAD_DIR, name);
    writeFileSync(abs, file.buffer);
    return { url: `/uploads/landing/${name}` };
  }

  private assertLandingAssetUrl(url: string) {
    if (!url.startsWith('/uploads/landing/')) {
      throw new BadRequestException('آدرس تصویر باید از مسیر آپلود لندینگ باشد');
    }
    if (url.includes('..') || url.includes('\\')) {
      throw new BadRequestException('آدرس تصویر نامعتبر است');
    }
  }

  private tryUnlinkLandingFile(url: string) {
    try {
      if (!url.startsWith('/uploads/landing/')) return;
      const base = url.replace('/uploads/landing/', '');
      if (!base || base.includes('..') || base.includes('/') || base.includes('\\')) {
        return;
      }
      const abs = join(LANDING_UPLOAD_DIR, base);
      if (existsSync(abs)) unlinkSync(abs);
    } catch {
      /* non-fatal */
    }
  }
}
