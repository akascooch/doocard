import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import type { CustomerProfileResponseDto } from './dto/customer-profile.response';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QuickCreateCustomerDto } from './dto/quick-create-customer.dto';
import { CustomerRegistrationSmsService } from '../sms/customer-registration-sms.service';
import { normalizeIranMobile } from '../common/utils/phone.util';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

type AuthUser = { id?: number; sub?: number; role?: string };

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

      try {
        await this.customerRegistrationSms.handleNewCustomer({
          name: user.name || name,
          phone: user.phone || phone,
          userId: user.id,
          source: 'admin_create',
          preferredEmployeeId: resolvedEmployeeId,
        });
      } catch (err: any) {
        this.logger.error('[CustomerRegistration SMS error] ' + (err?.message || 'unknown'));
      }

      return customer;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  }

  async findAll(preferredEmployeeId?: number) {
    return this.prisma.customer.findMany({
      where: preferredEmployeeId != null ? { preferredEmployeeId } : undefined,
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

  async update(
    id: number,
    updateCustomerDto: UpdateCustomerDto,
    currentUser?: AuthUser,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const role = currentUser?.role;
    if (role === 'EMPLOYEE' || role === 'SERVICE') {
      const actorEmployeeId = await this.resolveActorEmployeeId(currentUser);
      if (
        actorEmployeeId == null ||
        customer.preferredEmployeeId !== actorEmployeeId
      ) {
        throw new ForbiddenException(
          'فقط می‌توانید مشتریان اختصاص‌یافته به خود را ویرایش کنید',
        );
      }
    }

    const { name, email, birthdate, notes, preferredEmployeeId } =
      updateCustomerDto;
    let phone = updateCustomerDto.phone;
    if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
      const normalized = normalizeIranMobile(String(phone));
      if (!normalized) {
        throw new BadRequestException(
          'شماره موبایل معتبر نیست (باید ۱۱ رقم و با ۰۹ شروع شود)',
        );
      }
      phone = normalized;
    }

    if (phone && phone !== customer.user?.phone) {
      const phoneOwner = await this.prisma.user.findUnique({ where: { phone } });
      if (phoneOwner && phoneOwner.id !== customer.userId) {
        throw new ConflictException('شماره تلفن قبلاً ثبت شده است');
      }
    }

    let resolvedPreferredId: number | null | undefined = undefined;
    if (preferredEmployeeId !== undefined) {
      if (preferredEmployeeId === null || (preferredEmployeeId as any) === '') {
        resolvedPreferredId = null;
      } else {
        const employee = await this.prisma.employee.findUnique({
          where: { id: Number(preferredEmployeeId) },
        });
        if (!employee) {
          throw new BadRequestException('آرایشگر انتخاب‌شده یافت نشد');
        }
        resolvedPreferredId = employee.id;
      }
    }

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

      // Update customer data (including preferred barber when provided)
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: {
          ...(birthdate && { birthdate: new Date(birthdate) }),
          ...(notes !== undefined && { notes: notes || null }),
          ...(resolvedPreferredId !== undefined && {
            preferredEmployeeId: resolvedPreferredId,
          }),
        },
        include: {
          user: true,
          preferredEmployee: { include: { user: true } },
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
   * Quick create: name + phone only.
   * - Normalizes phone to canonical 09xxxxxxxxx (Persian/Arabic digits, +98 supported).
   * - EMPLOYEE/SERVICE: preferredEmployeeId from JWT employee only (never trusts client IDs).
   * - ADMIN: may pass preferredEmployeeId; otherwise resolves default/first active.
   */
  async quickCreate(dto: QuickCreateCustomerDto, currentUser?: AuthUser) {
    const phone = normalizeIranMobile(dto.phone);
    if (!phone) {
      throw new BadRequestException('شماره موبایل معتبر نیست (باید ۱۱ رقم و با ۰۹ شروع شود)');
    }
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('نام الزامی است');
    }
    if (name.length > 100) {
      throw new BadRequestException('نام نباید بیش از ۱۰۰ کاراکتر باشد');
    }

    const actorEmployeeId = await this.resolveActorEmployeeId(currentUser);
    const role = currentUser?.role;
    let preferredForCreate: number | null = null;

    // Explicit preferred (admin select or appointment booking barber) — must be active.
    if (dto.preferredEmployeeId != null) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: Number(dto.preferredEmployeeId) },
      });
      if (!employee?.isActive) {
        throw new BadRequestException('آرایشگر انتخاب‌شده معتبر نیست');
      }
      // EMPLOYEE/SERVICE may only set preferred to themselves unless ADMIN
      if (
        (role === 'EMPLOYEE' || role === 'SERVICE') &&
        actorEmployeeId != null &&
        employee.id !== actorEmployeeId
      ) {
        // Booking with another barber: still allow attaching that barber (validated).
        preferredForCreate = employee.id;
      } else {
        preferredForCreate = employee.id;
      }
    } else if (actorEmployeeId != null) {
      preferredForCreate = actorEmployeeId;
    } else {
      preferredForCreate = await this.resolveDefaultPreferredEmployeeId();
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
      include: { customer: true },
    });

    if (existingUser) {
      if (existingUser.customer) {
        return this.attachPreferredIfNull(existingUser.customer.id, preferredForCreate);
      }
      if (existingUser.role !== 'CUSTOMER') {
        throw new ConflictException('این شماره متعلق به کاربر با نقش دیگر است');
      }
      const customer = await this.prisma.customer.create({
        data: {
          userId: existingUser.id,
          ...(preferredForCreate != null
            ? { preferredEmployeeId: preferredForCreate }
            : {}),
        },
        include: { user: true, preferredEmployee: { include: { user: true } } },
      });
      try {
        await this.customerRegistrationSms.handleNewCustomer({
          name,
          phone,
          userId: existingUser.id,
          source: 'admin_quick_create',
          preferredEmployeeId: preferredForCreate,
        });
      } catch (err: any) {
        this.logger.error('[CustomerRegistration SMS error] ' + (err?.message || 'unknown'));
      }
      return customer;
    }

    const randomPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    let customer;
    try {
      customer = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            phone,
            password: hashedPassword,
            role: 'CUSTOMER',
          },
        });
        return tx.customer.create({
          data: {
            userId: user.id,
            ...(preferredForCreate != null
              ? { preferredEmployeeId: preferredForCreate }
              : {}),
          },
          include: { user: true, preferredEmployee: { include: { user: true } } },
        });
      });
    } catch (err: any) {
      // Concurrent duplicate phone (User.phone @unique)
      if (err?.code === 'P2002') {
        const raced = await this.prisma.user.findUnique({
          where: { phone },
          include: { customer: true },
        });
        if (raced?.customer) {
          return this.attachPreferredIfNull(raced.customer.id, preferredForCreate);
        }
        throw new ConflictException('این شماره قبلاً ثبت شده است');
      }
      throw err;
    }

    try {
      await this.customerRegistrationSms.handleNewCustomer({
        name,
        phone,
        userId: customer.userId,
        source: 'admin_quick_create',
        preferredEmployeeId: preferredForCreate,
      });
    } catch (err: any) {
      this.logger.error('[CustomerRegistration SMS error] ' + (err?.message || 'unknown'));
    }

    return customer;
  }

  /** Default / first-active preferred employee (existing field isDefault). */
  private async resolveDefaultPreferredEmployeeId(): Promise<number | null> {
    const defaultEmployee = await this.prisma.employee.findFirst({
      where: { isDefault: true, isActive: true },
    });
    if (defaultEmployee) return defaultEmployee.id;
    const firstActive = await this.prisma.employee.findFirst({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });
    return firstActive ? firstActive.id : null;
  }

  /**
   * If customer has no preferred barber and an appointment barber is known,
   * attach that barber (does not overwrite existing preferred).
   */
  async attachPreferredFromAppointmentIfNull(
    customerId: number,
    employeeId: number | null | undefined,
  ) {
    if (!employeeId) return null;
    return this.attachPreferredIfNull(customerId, employeeId);
  }

  /** Resolve Employee id from authenticated user; never from client body. */
  private async resolveActorEmployeeId(currentUser?: AuthUser): Promise<number | null> {
    const userId = currentUser?.id ?? currentUser?.sub;
    if (!userId) return null;

    const role = currentUser?.role;
    const emp = await this.prisma.employee.findUnique({
      where: { userId: Number(userId) },
    });

    if (role === 'EMPLOYEE' || role === 'SERVICE') {
      if (!emp) {
        throw new BadRequestException(
          'پروفایل کارمند یافت نشد. با مدیر سیستم تماس بگیرید.',
        );
      }
      if (!emp.isActive) {
        throw new BadRequestException('حساب کارمندی شما غیرفعال است.');
      }
      return emp.id;
    }

    // ADMIN etc.: attach preferred only if they also have an active employee profile
    if (emp?.isActive) return emp.id;
    return null;
  }

  /** Set preferredEmployeeId only when currently null (preserve existing barber). */
  private async attachPreferredIfNull(customerId: number, actorEmployeeId: number | null) {
    if (actorEmployeeId == null) {
      return this.prisma.customer.findUnique({
        where: { id: customerId },
        include: { user: true },
      });
    }

    const existing = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { user: true },
    });
    if (!existing) {
      throw new NotFoundException('مشتری یافت نشد');
    }
    if (existing.preferredEmployeeId != null) {
      return existing;
    }

    return this.prisma.customer.update({
      where: { id: customerId },
      data: { preferredEmployeeId: actorEmployeeId },
      include: { user: true },
    });
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
        user: true,
        preferredEmployee: { include: { user: true } },
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

  /**
   * Open customer debts (settledAt IS NULL). Amounts as decimal strings (RIAL).
   */
  async getOpenDebts(customerId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('مشتری یافت نشد');
    }

    const debts = await this.prisma.customerDebt.findMany({
      where: { customerId, settledAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        appointment: {
          select: {
            id: true,
            scheduledAt: true,
            amount: true,
            status: true,
          },
        },
      },
    });

    const totalOpenRial = debts.reduce((s, d) => s + d.amount, 0n);

    return {
      customerId,
      totalOpenRial: totalOpenRial.toString(),
      count: debts.length,
      debts: debts.map((d) => ({
        id: d.id,
        amountRial: d.amount.toString(),
        description: d.description,
        createdAt: d.createdAt,
        dueAt: d.dueAt,
        sourceType: d.sourceType,
        sourceId: d.sourceId,
        appointmentId: d.appointmentId,
        appointmentScheduledAt: d.appointment?.scheduledAt ?? null,
        appointmentAmountRial: d.appointment?.amount?.toString() ?? null,
      })),
    };
  }

  /**
   * Customers with at least one open debt + aggregate totals.
   */
  async listDebtors() {
    const grouped = await this.prisma.customerDebt.groupBy({
      by: ['customerId'],
      where: { settledAt: null },
      _sum: { amount: true },
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    });

    if (grouped.length === 0) {
      return { count: 0, debtors: [] };
    }

    const customerIds = grouped.map((g) => g.customerId);
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      include: {
        user: { select: { id: true, name: true, phone: true } },
      },
    });
    const byId = new Map(customers.map((c) => [c.id, c]));

    const debtors = grouped
      .map((g) => {
        const c = byId.get(g.customerId);
        return {
          customerId: g.customerId,
          name: c?.user?.name ?? `مشتری #${g.customerId}`,
          phone: c?.user?.phone ?? null,
          openDebtCount: g._count._all,
          totalOpenRial: (g._sum.amount ?? 0n).toString(),
          oldestOpenAt: g._min.createdAt,
          newestOpenAt: g._max.createdAt,
        };
      })
      .sort((a, b) => {
        const diff = BigInt(b.totalOpenRial) - BigInt(a.totalOpenRial);
        return diff > 0n ? 1 : diff < 0n ? -1 : 0;
      });

    return { count: debtors.length, debtors };
  }
}