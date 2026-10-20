import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AdminPersonalService } from './admin-personal.service';
import {
  CreateExpenseCategoryDto,
  CreatePersonalExpenseDto,
  ListPersonalExpensesQueryDto,
  PersonalLedgerBreakdownQueryDto,
  UpdateExpenseCategoryDto,
} from './dto/admin-personal.dto';

type LedgerUser = { id?: number; sub?: number; role?: string };

/**
 * Personal ledger only. Frog routes stay on AdminPersonalController.
 */
@Controller('personal-ledger')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Roles('ADMIN', 'EMPLOYEE')
export class PersonalLedgerController {
  constructor(private readonly service: AdminPersonalService) {}

  private actor(user: LedgerUser) {
    this.service.assertPersonalLedgerRole(user?.role);
    const userId = Number(user?.id ?? user?.sub);
    return userId;
  }

  @Get('expenses/summary')
  expenseSummary(@Req() req: { user: LedgerUser }) {
    return this.service.expenseSummary(this.actor(req.user));
  }

  @Get('expenses/breakdown')
  expenseBreakdown(
    @Req() req: { user: LedgerUser },
    @Query() query: PersonalLedgerBreakdownQueryDto,
  ) {
    return this.service.expenseBreakdown(this.actor(req.user), query);
  }

  @Get('expenses')
  listExpenses(
    @Req() req: { user: LedgerUser },
    @Query() query: ListPersonalExpensesQueryDto,
  ) {
    return this.service.listExpenses(this.actor(req.user), query);
  }

  @Post('expenses')
  createExpense(
    @Req() req: { user: LedgerUser },
    @Body() dto: CreatePersonalExpenseDto,
  ) {
    return this.service.createExpense(this.actor(req.user), dto);
  }

  @Delete('expenses/:id')
  deleteExpense(@Req() req: { user: LedgerUser }, @Param('id') id: string) {
    return this.service.deleteExpense(this.actor(req.user), id);
  }

  @Get('categories')
  listCategories(@Req() req: { user: LedgerUser }) {
    return this.service.listCategories(this.actor(req.user));
  }

  @Post('categories')
  createCategory(
    @Req() req: { user: LedgerUser },
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    return this.service.createCategory(this.actor(req.user), dto);
  }

  @Patch('categories/:id')
  updateCategory(
    @Req() req: { user: LedgerUser },
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return this.service.updateCategory(this.actor(req.user), id, dto);
  }

  @Delete('categories/:id')
  archiveCategory(@Req() req: { user: LedgerUser }, @Param('id') id: string) {
    return this.service.archiveCategory(this.actor(req.user), id);
  }
}
