import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateHomepageDetailsDto } from './dto/update-homepage-details.dto';

@Injectable()
export class HomepageService {
  constructor(private prisma: PrismaService) {}

  async getHomepageDetails() {
    let details = await this.prisma.homepageDetails.findFirst();
    
    if (!details) {
      // Create default homepage details if none exist
      details = await this.prisma.homepageDetails.create({
        data: {
          about: 'درباره سالن زیبایی دوکارد',
          team: 'تیم حرفه‌ای ما',
          products: 'محصولات و خدمات ما',
          trainings: 'دوره‌های آموزشی',
          testimonials: 'نظرات مشتریان',
          contact: 'اطلاعات تماس',
        },
      });
    }
    
    return details;
  }

  async updateHomepageDetails(updateHomepageDetailsDto: UpdateHomepageDetailsDto) {
    let details = await this.prisma.homepageDetails.findFirst();
    
    if (!details) {
      details = await this.prisma.homepageDetails.create({
        data: updateHomepageDetailsDto,
      });
    } else {
      details = await this.prisma.homepageDetails.update({
        where: { id: details.id },
        data: {
          ...updateHomepageDetailsDto,
          updatedAt: new Date(),
        },
      });
    }
    
    return details;
  }
}
