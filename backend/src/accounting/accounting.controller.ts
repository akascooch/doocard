import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TransactionType } from '@prisma/client';

@Controller('accounting')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  // ==================== TRANSACTIONS ====================

  @Get('test')
  @Roles('ADMIN', 'ACCOUNTANT', 'EMPLOYEE')
  testEndpoint(@Req() req: any) {
    console.log('✅ Test endpoint called by:', req?.user);
    return { 
      message: 'Accounting module is working',
      user: req?.user,
      timestamp: new Date().toISOString()
    };
  }

  @Get('transactions/:id')
  @Roles('ADMIN', 'ACCOUNTANT', 'EMPLOYEE')
  findOneTransaction(@Param('id', ParseIntPipe) id: number) {
    console.log('🔍 [AccountingController] GET /transactions/:id - ID:', id);
    return this.accountingService.findOne(id);
  }

  @Get('transactions')
  @Roles('ADMIN', 'ACCOUNTANT', 'EMPLOYEE')
  async findAllTransactions(@Query() query: QueryTransactionsDto, @Req() req?: any) {
    try {
      console.log('🔍 [AccountingController] GET /transactions - User:', req?.user?.phone);
      console.log('🔍 [AccountingController] Query params:', query);
      
      const result = await this.accountingService.findAll(query);

      console.log('✅ [AccountingController] Returning transactions:', result.data.length);
      return result;
    } catch (error) {
      console.error('❌ [AccountingController] Error in findAllTransactions:', error);
      throw error;
    }
  }

  @Post('transactions')
  @Roles('ADMIN', 'ACCOUNTANT')
  createTransaction(@Body() dto: CreateTransactionDto, @Req() req: any) {
    const userId = req.user?.sub;
    console.log('📝 [AccountingController] POST /transactions - User:', req?.user?.phone, 'Data:', dto);
    return this.accountingService.createTransaction(dto, userId);
  }

  @Patch('transactions/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  updateTransaction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
    @Req() req: any
  ) {
    const userId = req.user?.sub;
    return this.accountingService.update(id, dto, userId);
  }

  @Delete('transactions/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  async removeTransaction(@Param('id', ParseIntPipe) id: number) {
    console.log('🗑️ [AccountingController] DELETE /transactions/:id - ID:', id);
    try {
      const result = await this.accountingService.remove(id);
      console.log('✅ [AccountingController] Transaction deleted successfully');
      return result;
    } catch (error) {
      console.error('❌ [AccountingController] Error deleting transaction:', error);
      throw error;
    }
  }

  // ==================== TRANSFERS ====================

  @Post('transfers')
  @Roles('ADMIN', 'ACCOUNTANT')
  createTransfer(@Body() dto: CreateTransferDto, @Req() req: any) {
    const userId = req.user?.sub;
    console.log('💸 [AccountingController] POST /transfers - User:', req?.user?.phone, 'Data:', dto);
    return this.accountingService.createTransfer(dto, userId);
  }

  // ==================== CATEGORIES ====================

  @Post('categories')
  @Roles('ADMIN', 'ACCOUNTANT')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.accountingService.createCategory(dto);
  }

  @Get('categories')
  @Roles('ADMIN', 'ACCOUNTANT', 'EMPLOYEE')
  findAllCategories(@Query('type') type?: TransactionType) {
    return this.accountingService.findAllCategories(type);
  }

  @Get('categories/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  findOneCategory(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.findOneCategory(id);
  }

  @Patch('categories/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.accountingService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  removeCategory(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.removeCategory(id);
  }

  // ==================== BANK ACCOUNTS ====================

  @Post('accounts')
  @Roles('ADMIN', 'ACCOUNTANT')
  createAccount(@Body() dto: CreateAccountDto) {
    return this.accountingService.createAccount(dto);
  }

  @Get('accounts')
  @Roles('ADMIN', 'ACCOUNTANT', 'EMPLOYEE')
  findAllAccounts(@Query('activeOnly') activeOnly?: string) {
    return this.accountingService.findAllAccounts(activeOnly === 'true');
  }

  @Get('accounts/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  findOneAccount(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.findOneAccount(id);
  }

  @Patch('accounts/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  updateAccount(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAccountDto) {
    return this.accountingService.updateAccount(id, dto);
  }

  @Patch('accounts/:id/set-default')
  @Roles('ADMIN', 'ACCOUNTANT')
  setDefaultAccount(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.setDefaultAccount(id);
  }

  @Patch('accounts/:id/recalculate')
  @Roles('ADMIN', 'ACCOUNTANT')
  recalculateAccountBalance(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.recalculateAccountBalance(id);
  }

  @Delete('accounts/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  removeAccount(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.removeAccount(id);
  }

  // ==================== REPORTS ====================

  @Get('reports/summary')
  @Roles('ADMIN', 'ACCOUNTANT')
  getSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.accountingService.getSummary(from, to);
  }

  @Get('reports/by-category')
  @Roles('ADMIN', 'ACCOUNTANT')
  getSummaryByCategory(
    @Query('type') type?: TransactionType,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.accountingService.getSummaryByCategory(type, from, to);
  }

  @Get('reports/daily/:date')
  @Roles('ADMIN', 'ACCOUNTANT')
  getDailyReport(@Param('date') date: string) {
    return this.accountingService.getDailyReport(date);
  }

  @Get('reports/balance-by-account')
  @Roles('ADMIN', 'ACCOUNTANT')
  getBalanceByAccount() {
    return this.accountingService.getBalanceByAccount();
  }
}
