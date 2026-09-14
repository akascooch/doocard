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
  CreateFrogRecurrenceDto,
  CreatePersonalExpenseDto,
  FrogHistoryQueryDto,
  ListPersonalExpensesQueryDto,
  ToggleFrogDto,
  UpdateExpenseCategoryDto,
  UpdateFrogRecurrenceDto,
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

  @Get('frog/recurrences')
  @Roles('ADMIN')
  listRecurrences(@Req() req: { user: { id: number } }) {
    return this.service.listRecurrences(req.user.id);
  }

  @Post('frog/recurrences')
  @Roles('ADMIN')
  createRecurrence(
    @Req() req: { user: { id: number } },
    @Body() dto: CreateFrogRecurrenceDto,
  ) {
    return this.service.createRecurrence(req.user.id, dto);
  }

  @Patch('frog/recurrences/:id')
  @Roles('ADMIN')
  updateRecurrence(
    @Req() req: { user: { id: number } },
    @Param('id') id: string,
    @Body() dto: UpdateFrogRecurrenceDto,
  ) {
    return this.service.updateRecurrence(req.user.id, id, dto);
  }

  @Delete('frog/recurrences/:id')
  @Roles('ADMIN')
  deleteRecurrence(
    @Req() req: { user: { id: number } },
    @Param('id') id: string,
  ) {
    return this.service.deleteRecurrence(req.user.id, id);
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

  @Get('categories')
  @Roles('ADMIN')
  listCategories(@Req() req: { user: { id: number } }) {
    return this.service.listCategories(req.user.id);
  }

  @Post('categories')
  @Roles('ADMIN')
  createCategory(
    @Req() req: { user: { id: number } },
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    return this.service.createCategory(req.user.id, dto);
  }

  @Patch('categories/:id')
  @Roles('ADMIN')
  updateCategory(
    @Req() req: { user: { id: number } },
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return this.service.updateCategory(req.user.id, id, dto);
  }

  @Delete('categories/:id')
  @Roles('ADMIN')
  archiveCategory(
    @Req() req: { user: { id: number } },
    @Param('id') id: string,
  ) {
    return this.service.archiveCategory(req.user.id, id);
  }
}
