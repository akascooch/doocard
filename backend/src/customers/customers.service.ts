import { Injectable, ConflictException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import type { CustomerProfileResponseDto } from './dto/customer-profile.response';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QuickCreateCustomerDto } from './dto/quick-create-customer.dto';
import { CustomerRegistrationSmsService } from '../sms/customer-registration-sms.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private prisma: PrismaService,
    private readonly customerRegistrationSms: CustomerRegistrationSmsService,
  ) {}

  async create(createCustomerDto: CreateCustomerDto) {
    try {
      const { name, phone, email, password, birthdate, notes, preferredEmployeeId } = createCustomerDto;

      // Check if user with this phone already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { phone }
      });

      if (existingUser) {
        throw new ConflictException('User with this phone number already exists');
      }

      // Hash password if provided
      const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('123456', 10);

      // Create user first
      const user = await this.prisma.user.create({
        data: {
          name,
          phone,
          email: email || null,
          password: hashedPassword,
          role: 'CUSTOMER'
        }
      });

      // Resolve preferred employee
      let resolvedEmployeeId: number | null = null;
      if (preferredEmployeeId) {
        const employee = await this.prisma.employee.findUnique({ where: { id: preferredEmployeeId } });
        resolvedEmployeeId = employee ? employee.id : null;
      }

      if (!resolvedEmployeeId) {
        const defaultEmployee = await this.prisma.employee.findFirst({ where: { isDefault: true, isActive: true } });
        if (defaultEmployee) {
          resolvedEmployeeId = defaultEmployee.id;
        } else {
          const firstActive = await this.prisma.employee.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } });
          resolvedEmployeeId = firstActive ? firstActive.id : null;
        }
      }

      // Create customer record
      const customer = await this.prisma.customer.create({
        data: {
          userId: user.id,
          birthdate: birthdate ? new Date(birthdate) : null,
          notes: notes || null,
          preferredEmployeeId: resolvedEmployeeId
        },
        include: {
          user: true
        }
      });

      return customer;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  }

  async findAll() {
    return this.prisma.customer.findMany({
      include: {
        user: true,
        preferredEmployee: {
          include: { user: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async findOne(id: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        user: true,
        preferredEmployee: {
          include: { user: true }
        },
        appointments: {
          include: {
            employee: {
              include: { user: true }
            },
          },
          orderBy: {
            scheduledAt: 'desc'
          }
        }
      }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async getMyProfile(userId: number): Promise<CustomerProfileResponseDto> {
    const customer = await this.prisma.customer.findFirst({
      where: { userId },
      include: {
        user: true,
        preferredEmployee: { include: { user: true } },
      }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    let preferred = customer.preferredEmployee;
    if (!preferred) {
      const fallback = await this.prisma.employee.findFirst({
        where: { isDefault: true, isActive: true },
        include: { user: true },
      });
      preferred = fallback || null;
    }

    const response: CustomerProfileResponseDto = {
      id: customer.id,
      name: customer.user?.name,
      phone: customer.user?.phone,
      email: customer.user?.email,
      birthdate: customer.birthdate,
      notes: customer.notes,
      preferredEmployee: preferred ? {
        id: preferred.id,
        name: preferred.user?.name,
        specialty: preferred.specialty || null,
        avatarUrl: null,
      } : null,
    };
    return response;
  }

  async findByPhone(phone: string) {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: {
        customer: {
          include: {
            appointments: {
              include: {
                employee: {
                  include: { user: true }
                },
              },
              orderBy: {
                scheduledAt: 'desc'
              }
            }
          }
        }
      }
    });

    if (!user || !user.customer) {
      throw new NotFoundException('Customer not found');
    }

    return user.customer;
  }

  async update(id: number, updateCustomerDto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const { name, phone, email, birthdate, notes } = updateCustomerDto;

    return this.prisma.$transaction(async (tx) => {
      // Update user data
      if (name || phone || email !== undefined) {
        await tx.user.update({
          where: { id: customer.userId },
          data: {
            ...(name && { name }),
            ...(phone && { phone }),
            ...(email !== undefined && { email: email || null })
          }
        });
      }

      // Update customer data
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: {
          ...(birthdate && { birthdate: new Date(birthdate) }),
          ...(notes !== undefined && { notes: notes || null })
        },
        include: {
          user: true
        }
      });

      return updatedCustomer;
    });
  }

  async remove(id: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // Delete customer record
      await tx.customer.delete({
        where: { id }
      });

      // Delete user record
      await tx.user.delete({
        where: { id: customer.userId }
      });

      return { message: 'Customer deleted successfully' };
    });
  }

  /**
   * Quick create: name + phone only. Normalizes phone (trim, no spaces), validates 09xxxxxxxxx.
   * If user exists by phone: return existing customer or create Customer for that user.
   * If user does not exist: create User + Customer in transaction.
   */
  async quickCreate(dto: QuickCreateCustomerDto) {
    const phone = dto.phone.trim().replace(/\s/g, '');
    if (!/^09\d{9}$/.test(phone)) {
      throw new BadRequestException('شماره موبایل معتبر نیست (باید ۱۱ رقم و با ۰۹ شروع شود)');
    }
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('نام الزامی است');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
      include: { customer: true }
    });

    if (existingUser) {
      if (existingUser.customer) {
        return this.prisma.customer.findUnique({
          where: { id: existingUser.customer.id },
          include: { user: true }
        });
      }
      if (existingUser.role !== 'CUSTOMER') {
        throw new ConflictException('این شماره متعلق به کاربر با نقش دیگر است');
      }
      const customer = await this.prisma.customer.create({
        data: { userId: existingUser.id },
        include: { user: true }
      });
      try {
        await this.customerRegistrationSms.sendWelcome(name, phone);
      } catch (err: any) {
        this.logger.error('[CustomerRegistration SMS error] ' + (err?.message || 'unknown'));
      }
      return customer;
    }

    const randomPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const customer = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          phone,
          password: hashedPassword,
          role: 'CUSTOMER'
        }
      });
      return tx.customer.create({
        data: { userId: user.id },
        include: { user: true }
      });
    });

    try {
      await this.customerRegistrationSms.sendWelcome(name, phone);
    } catch (err: any) {
      this.logger.error('[CustomerRegistration SMS error] ' + (err?.message || 'unknown'));
    }

    return customer;
  }

  async searchCustomers(query: string) {
    const customers = await this.prisma.customer.findMany({
      where: {
        OR: [
          {
            user: {
              name: {
                contains: query,
                mode: 'insensitive'
              }
            }
          },
          {
            user: {
              phone: {
                contains: query
              }
            }
          },
          {
            user: {
              email: {
                contains: query,
                mode: 'insensitive'
              }
            }
          }
        ]
      },
      include: {
        user: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return customers;
  }

  async getCustomerStats(customerId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        appointments: {
          include: {
            service: true,
            transactions: true
          }
        }
      }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const totalAppointments = customer.appointments.length;
    const completedAppointments = customer.appointments.filter(apt => apt.status === 'COMPLETED').length;
    const totalSpent = customer.appointments
      .filter(apt => apt.status === 'COMPLETED')
      .reduce((sum, apt) => sum + (apt.service?.price || 0), 0);

    return {
      totalAppointments,
      completedAppointments,
      pendingAppointments: totalAppointments - completedAppointments,
      totalSpent,
      averageSpent: completedAppointments > 0 ? totalSpent / completedAppointments : 0
    };
  }
}