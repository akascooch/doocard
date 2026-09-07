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
        name: createServiceDto.name,
        description: createServiceDto.description,
        durationMinutes: createServiceDto.durationMinutes,
        price: createServiceDto.price,
        updatedAt: new Date(),
      },
    });
  }

  findAll(sort?: 'usage') {
    if (sort !== 'usage') {
      return this.prisma.service.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    return this.findAllByUsage();
  }

  /** Most-used first. Counts appointment_services whose appointment is not soft-deleted. */
  private async findAllByUsage() {
    const [services, groups] = await Promise.all([
      this.prisma.service.findMany(),
      this.prisma.appointmentService.groupBy({
        by: ['serviceId'],
        where: { appointment: { deletedAt: null } },
        _count: { _all: true },
      }),
    ]);

    const countByServiceId = new Map(groups.map((g) => [g.serviceId, g._count._all]));
    return [...services].sort((a, b) => {
      const diff = (countByServiceId.get(b.id) ?? 0) - (countByServiceId.get(a.id) ?? 0);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, 'fa');
    });
  }

  // Public endpoint - return all active services sorted by usage count
  async findAllPublic() {
    console.log('📋 Fetching all public services from database...');
    
    // Get all services with appointment count using raw SQL
    const servicesWithCount = await this.prisma.$queryRaw`
      SELECT 
        s.id,
        s.name,
        s.description,
        s."durationMinutes",
        s.price,
        COUNT(DISTINCT a.id) as "usageCount"
      FROM services s
      LEFT JOIN appointments a ON a.services::jsonb @> jsonb_build_array(jsonb_build_object('serviceId', s.id))
      GROUP BY s.id, s.name, s.description, s."durationMinutes", s.price
      ORDER BY "usageCount" DESC, s.name ASC
    ` as any[];

    // Convert BigInt to number for JSON serialization
    const result = servicesWithCount.map(service => ({
      ...service,
      usageCount: Number(service.usageCount),
      price: Number(service.price),
    }));
    
    console.log('📊 Services sorted by usage:', result.map(s => `${s.name}: ${s.usageCount} times`));
    
    return result;
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
