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
  ForbiddenException,
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
import { CreateChequebookDto } from './dto/create-chequebook.dto';
import { UpdateChequebookDto } from './dto/update-chequebook.dto';
import { CreateChequeLeafDto } from './dto/create-cheque-leaf.dto';
import { UpdateChequeLeafDto } from './dto/update-cheque-leaf.dto';
import { QueryChequeLeavesDto } from './dto/query-cheque-leaves.dto';
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
  @Roles('ADMIN', 'ACCOUNTANT')
  async findAllTransactions(@Query() query: QueryTransactionsDto, @Req() req?: any) {
    try {
      const role = req?.user?.role;
      if (role === 'EMPLOYEE' || role === 'SERVICE') {
        throw new ForbiddenException('دسترسی به دفتر کل حسابداری برای پرسنل مجاز نیست');
      }
      console.log('🔍 [AccountingController] GET /transactions -', `userId=${req?.user?.sub ?? req?.user?.id} role=${req?.user?.role}`);
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
    console.log('📝 [AccountingController] POST /transactions -', `userId=${req?.user?.sub ?? req?.user?.id} role=${req?.user?.role}`);
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
    console.log('💸 [AccountingController] POST /transfers -', `userId=${req?.user?.sub ?? req?.user?.id} role=${req?.user?.role}`);
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

  // ==================== CHEQUEBOOKS ====================

  @Post('chequebooks')
  @Roles('ADMIN', 'ACCOUNTANT')
  createChequebook(@Body() dto: CreateChequebookDto) {
    return this.accountingService.createChequebook(dto);
  }

  @Get('chequebooks')
  @Roles('ADMIN', 'ACCOUNTANT', 'EMPLOYEE')
  findAllChequebooks(
    @Query('bankAccountId') bankAccountId?: string,
    @Query('archived') archived?: string,
  ) {
    const parsed = bankAccountId ? parseInt(bankAccountId, 10) : undefined;
    return this.accountingService.findAllChequebooks(parsed, archived === 'true');
  }

  @Get('chequebooks/:id')
  @Roles('ADMIN', 'ACCOUNTANT', 'EMPLOYEE')
  findOneChequebook(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.findOneChequebook(id);
  }

  @Patch('chequebooks/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  updateChequebook(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChequebookDto
  ) {
    return this.accountingService.updateChequebook(id, dto);
  }

  @Patch('chequebooks/:id/archive')
  @Roles('ADMIN', 'ACCOUNTANT')
  archiveChequebook(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.archiveChequebook(id);
  }

  @Patch('chequebooks/:id/restore')
  @Roles('ADMIN', 'ACCOUNTANT')
  restoreChequebook(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.restoreChequebook(id);
  }

  @Delete('chequebooks/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  removeChequebook(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.removeChequebook(id);
  }

  @Get('chequebooks/:id/leaves')
  @Roles('ADMIN', 'ACCOUNTANT', 'EMPLOYEE')
  findChequeLeavesByChequebook(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryChequeLeavesDto
  ) {
    return this.accountingService.findChequeLeavesByChequebook(id, query);
  }

  @Get('cheque-leaves')
  @Roles('ADMIN', 'ACCOUNTANT', 'EMPLOYEE')
  findAllChequeLeaves(@Query() query: QueryChequeLeavesDto) {
    return this.accountingService.findAllChequeLeaves(query);
  }

  @Post('cheque-leaves')
  @Roles('ADMIN', 'ACCOUNTANT')
  createChequeLeaf(@Body() dto: CreateChequeLeafDto) {
    return this.accountingService.createChequeLeaf(dto);
  }

  @Patch('cheque-leaves/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  updateChequeLeaf(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChequeLeafDto,
    @Req() req: any,
  ) {
    return this.accountingService.updateChequeLeaf(id, dto, req.user?.id ?? req.user?.sub);
  }

  @Post('cheque-leaves/:id/reverse-clearance')
  @Roles('ADMIN', 'ACCOUNTANT')
  reverseChequeClearance(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.reverseChequeClearedAccounting(id);
  }

  @Delete('cheque-leaves/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  removeChequeLeaf(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.removeChequeLeaf(id);
  }
}
