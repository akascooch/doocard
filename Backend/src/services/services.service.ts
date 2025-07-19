import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  create(createServiceDto: CreateServiceDto) {
    return this.prisma.service.create({
      data: {
        ...createServiceDto,
        updatedAt: new Date(),
      },
    });
  }

  findAll() {
    return this.prisma.service.findMany({
      where: {
        isActive: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.service.findUnique({
      where: { id },
    });
  }

  update(id: number, updateServiceDto: UpdateServiceDto) {
    return this.prisma.service.update({
      where: { id },
      data: {
        ...updateServiceDto,
        updatedAt: new Date(),
      },
    });
  }

  async remove(id: number) {
    const appointmentServices = await this.prisma.appointmentService.findMany({
      where: { serviceId: id },
      select: { id: true },
    });
    if (appointmentServices.length > 0) {
      throw new ConflictException('امکان حذف این خدمت وجود ندارد، زیرا به قرار ملاقات‌هایی متصل است.');
    }
    return this.prisma.service.delete({
      where: { id },
    });
  }
}
