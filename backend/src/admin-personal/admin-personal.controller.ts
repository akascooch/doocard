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
  CreatePersonalExpenseDto,
  FrogHistoryQueryDto,
  ListPersonalExpensesQueryDto,
  ToggleFrogDto,
  UpsertTodayFrogDto,
} from './dto/admin-personal.dto';

@Controller('admin/personal')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AdminPersonalController {
  constructor(private readonly service: AdminPersonalService) {}

  @Get('frog/today')
  @Roles('ADMIN')
  getTodayFrog(@Req() req: { user: { id: number } }) {
    return this.service.getTodayFrog(req.user.id);
  }

  @Get('frog/history')
  @Roles('ADMIN')
  frogHistory(
    @Req() req: { user: { id: number } },
    @Query() query: FrogHistoryQueryDto,
  ) {
    return this.service.listFrogHistory(req.user.id, query);
  }

  @Post('frog')
  @Roles('ADMIN')
  upsertFrog(
    @Req() req: { user: { id: number } },
    @Body() dto: UpsertTodayFrogDto,
  ) {
    return this.service.upsertTodayFrog(req.user.id, dto);
  }

  @Patch('frog/:id/toggle')
  @Roles('ADMIN')
  toggleFrog(
    @Req() req: { user: { id: number } },
    @Param('id') id: string,
    @Body() dto: ToggleFrogDto,
  ) {
    return this.service.toggleFrog(req.user.id, id, dto);
  }

  @Get('expenses/summary')
  @Roles('ADMIN')
  expenseSummary(@Req() req: { user: { id: number } }) {
    return this.service.expenseSummary(req.user.id);
  }

  @Get('expenses')
  @Roles('ADMIN')
  listExpenses(
    @Req() req: { user: { id: number } },
    @Query() query: ListPersonalExpensesQueryDto,
  ) {
    return this.service.listExpenses(req.user.id, query);
  }

  @Post('expenses')
  @Roles('ADMIN')
  createExpense(
    @Req() req: { user: { id: number } },
    @Body() dto: CreatePersonalExpenseDto,
  ) {
    return this.service.createExpense(req.user.id, dto);
  }

  @Delete('expenses/:id')
  @Roles('ADMIN')
  deleteExpense(
    @Req() req: { user: { id: number } },
    @Param('id') id: string,
  ) {
    return this.service.deleteExpense(req.user.id, id);
  }
}
