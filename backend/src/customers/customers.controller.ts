import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ConflictException,
  ParseIntPipe,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QuickCreateCustomerDto } from './dto/quick-create-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CustomersController {
  constructor(
    private readonly service: CustomersService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('ADMIN', 'EMPLOYEE')
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.service.create(createCustomerDto);
  }

  @Post('quick')
  @Roles('ADMIN', 'EMPLOYEE', 'SERVICE')
  async quickCreate(@Body() dto: QuickCreateCustomerDto, @Req() req: any) {
    return this.service.quickCreate(dto, req.user);
  }

  @Get()
  @Roles('ADMIN', 'EMPLOYEE', 'SERVICE')
  async findAll(
    @Query('search') search?: string,
    @Query('preferredEmployeeId') preferredEmployeeId?: string,
    @Query('mine') mine?: string,
    @Req() req?: any,
  ) {
    const scopedId = await this.resolveScopedPreferredEmployeeId(
      req?.user,
      preferredEmployeeId,
      mine,
    );

    if (search) {
      const results = await this.service.searchCustomers(search);
      if (scopedId == null) return results;
      return results.filter((c) => c.preferredEmployeeId === scopedId);
    }

    return this.service.findAll(scopedId ?? undefined);
  }

  // Get current customer (simple) - MUST be before :id route
  @Get('me')
  @Roles('CUSTOMER')
  async getMe(@Req() req: any) {
    const currentUser = req.user;
    return this.service.getMyProfile(currentUser.id);
  }

  // Get current customer profile with preferred hairdresser
  @Get('me/profile')
  @Roles('CUSTOMER')
  async getMyProfile(@Req() req: any) {
    const currentUser = req.user;
    return this.service.getMyProfile(currentUser.id);
  }

  @Get('phone/:phone')
  @Roles('ADMIN', 'EMPLOYEE')
  async findByPhone(@Param('phone') phone: string) {
    return this.service.findByPhone(phone);
  }

  /** Open (unsettled) debts for a customer — used by settlement UI warning. */
  @Get(':id/open-debts')
  @Roles('ADMIN', 'EMPLOYEE', 'ACCOUNTANT')
  async getOpenDebts(@Param('id', ParseIntPipe) id: number) {
    return this.service.getOpenDebts(id);
  }

  @Get(':id')
  @Roles('ADMIN', 'EMPLOYEE', 'CUSTOMER')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const currentUser = req.user;
    // اگر مشتری است، فقط اطلاعات خودش را ببیند
    if (currentUser.role === 'CUSTOMER' && currentUser.id !== id) {
      throw new Error('Unauthorized access');
    }
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'EMPLOYEE', 'SERVICE', 'CUSTOMER')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @Req() req: any,
  ) {
    const currentUser = req.user;
    // اگر مشتری است، فقط اطلاعات خودش را ویرایش کند
    if (currentUser.role === 'CUSTOMER' && currentUser.id !== id) {
      throw new Error('Unauthorized access');
    }
    // Non-admins cannot reassign preferred barber via this endpoint
    if (
      currentUser.role !== 'ADMIN' &&
      updateCustomerDto.preferredEmployeeId !== undefined
    ) {
      delete updateCustomerDto.preferredEmployeeId;
    }
    // Barber/service: name + phone only (ownership enforced in service)
    if (currentUser.role === 'EMPLOYEE' || currentUser.role === 'SERVICE') {
      return this.service.update(
        id,
        {
          name: updateCustomerDto.name,
          phone: updateCustomerDto.phone,
        },
        currentUser,
      );
    }
    return this.service.update(id, updateCustomerDto, currentUser);
  }

  @Delete(':id')
  @Roles('ADMIN', 'EMPLOYEE')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  /**
   * ADMIN: optional query preferredEmployeeId.
   * EMPLOYEE/SERVICE: scoped only when mine=1/true or preferredEmployeeId=me
   * (keeps appointment customer search unscoped).
   */
  private async resolveScopedPreferredEmployeeId(
    user?: { id?: number; sub?: number; role?: string },
    preferredEmployeeId?: string,
    mine?: string,
  ): Promise<number | null> {
    const role = user?.role;
    const userId = user?.id ?? user?.sub;
    const wantsMine =
      mine === '1' ||
      mine === 'true' ||
      preferredEmployeeId === 'me' ||
      preferredEmployeeId === 'mine';

    if (role === 'EMPLOYEE' || role === 'SERVICE') {
      if (!wantsMine) {
        return null;
      }
      if (!userId) {
        throw new BadRequestException('احراز هویت نامعتبر است');
      }
      const emp = await this.prisma.employee.findUnique({
        where: { userId: Number(userId) },
      });
      if (!emp?.isActive) {
        throw new BadRequestException('پروفایل کارمند یافت نشد یا غیرفعال است');
      }
      return emp.id;
    }

    if (preferredEmployeeId != null && preferredEmployeeId !== '' && !wantsMine) {
      const n = Number(preferredEmployeeId);
      if (!Number.isFinite(n)) {
        throw new BadRequestException('preferredEmployeeId نامعتبر است');
      }
      return n;
    }

    return null;
  }
}
