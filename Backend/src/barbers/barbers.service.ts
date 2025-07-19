import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBarberDto } from './dto/create-barber.dto';
import { UpdateBarberDto } from './dto/update-barber.dto';

@Injectable()
export class BarbersService {
  constructor(private prisma: PrismaService) {}

  create(createBarberDto: CreateBarberDto) {
    const { serviceIds, ...barberData } = createBarberDto;
    return this.prisma.barber.create({
      data: {
        ...barberData,
        updatedAt: new Date(),
        ...(serviceIds && serviceIds.length > 0 && {
          services: {
            connect: serviceIds.map(id => ({ id })),
          },
        }),
      },
      include: {
        services: true,
      },
    });
  }

  findAll() {
    return this.prisma.barber.findMany({
      include: {
        services: true,
        appointments: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.barber.findUnique({
      where: { id },
      include: {
        services: true,
        appointments: true,
      },
    });
  }

  update(id: number, updateBarberDto: UpdateBarberDto) {
    const { serviceIds, ...barberData } = updateBarberDto;
    return this.prisma.barber.update({
      where: { id },
      data: {
        ...barberData,
        updatedAt: new Date(),
        ...(serviceIds !== undefined && {
          services: {
            set: serviceIds.map(id => ({ id })),
          },
        }),
      },
      include: {
        services: true,
      },
    });
  }

  remove(id: number) {
    return this.prisma.barber.delete({
      where: { id },
    });
  }

  async addService(barberId: number, serviceId: number) {
    return this.prisma.barber.update({
      where: { id: barberId },
      data: {
        services: {
          connect: { id: serviceId },
        },
        updatedAt: new Date(),
      },
    });
  }

  async removeService(barberId: number, serviceId: number) {
    return this.prisma.barber.update({
      where: { id: barberId },
      data: {
        services: {
          disconnect: { id: serviceId },
        },
        updatedAt: new Date(),
      },
    });
  }
} 