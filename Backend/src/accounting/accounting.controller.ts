import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Query,
  Patch,
  Req,
} from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';
import {
  CreateFinancialEntryDto,
  CreateSalaryDto,
  CreateFinancialCategoryDto,
  UpdateFinancialEntryDto,
  CreateTipTransactionDto,
  UpdateTipTransactionStatusDto,
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from './dto';
import { TipTransactionStatus } from './tip-transaction.entity';

@Controller('accounting')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('stats')
  @Roles(Role.ADMIN, Role.BARBER)
  async getStats() {
    return this.accountingService.getStats();
  }

  @Get('chart')
  @Roles(Role.ADMIN, Role.BARBER)
  async getChartData(@Query('months') months = 6) {
    return this.accountingService.getChartData(months);
  }

  @Get('recent-transactions')
  @Roles(Role.ADMIN, Role.BARBER)
  async getRecentTransactions(@Query('limit') limit = 10) {
    return this.accountingService.getRecentTransactions(Number(limit));
  }

  @Get('categories')
  @Roles(Role.ADMIN, Role.BARBER)
  async getCategories() {
    return this.accountingService.getCategories();
  }

  @Post('categories')
  @Roles(Role.ADMIN)
  async createCategory(@Body() createCategoryDto: CreateFinancialCategoryDto) {
    return this.accountingService.createCategory(createCategoryDto);
  }

  @Delete('categories/:id')
  @Roles(Role.ADMIN)
  async deleteCategory(@Param('id') id: string) {
    return this.accountingService.deleteCategory(+id);
  }

  @Get('entries')
  @Roles(Role.ADMIN)
  async getEntries(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('type') type?: 'INCOME' | 'EXPENSE',
    @Query('categoryId') categoryId?: string,
  ) {
    return this.accountingService.getEntries(page, limit, type, categoryId ? +categoryId : undefined);
  }

  @Post('entries')
  @Roles(Role.ADMIN)
  async createEntry(@Body() createEntryDto: CreateFinancialEntryDto) {
    return this.accountingService.createEntry(createEntryDto);
  }

  @Put('entries/:id')
  @Roles(Role.ADMIN)
  async updateEntry(@Param('id') id: string, @Body() updateEntryDto: UpdateFinancialEntryDto) {
    return this.accountingService.updateEntry(+id, updateEntryDto);
  }

  @Delete('entries/:id')
  @Roles(Role.ADMIN)
  async deleteEntry(@Param('id') id: string) {
    return this.accountingService.deleteEntry(+id);
  }

  @Get('salaries')
  @Roles(Role.ADMIN, Role.BARBER)
  async getSalaries(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('isPaid') isPaid?: boolean,
  ) {
    return this.accountingService.getSalaries(page, limit, isPaid);
  }

  @Post('salaries')
  @Roles(Role.ADMIN)
  async createSalary(@Body() createSalaryDto: CreateSalaryDto) {
    return this.accountingService.createSalary(createSalaryDto);
  }

  @Put('salaries/:id/pay')
  @Roles(Role.ADMIN)
  async paySalary(@Param('id') id: string) {
    return this.accountingService.paySalary(+id);
  }

  @Delete('salaries/:id')
  @Roles(Role.ADMIN)
  async deleteSalary(@Param('id') id: string) {
    return this.accountingService.deleteSalary(+id);
  }

  @Put('salaries/:id')
  @Roles(Role.ADMIN)
  async updateSalary(@Param('id') id: string, @Body() body: { amount: number, month: string }) {
    return this.accountingService.updateSalary(+id, body);
  }

  // ثبت تراکنش تیپ (واریز یا برداشت)
  @Post('tips')
  @Roles(Role.ADMIN, Role.BARBER)
  async createTipTransaction(@Body() dto: CreateTipTransactionDto) {
    return this.accountingService.createTipTransaction(dto);
  }

  // دریافت مجموع تیپ روزانه
  @Get('tips/sum')
  @Roles(Role.ADMIN)
  async getDailyTipSum(@Query('date') date: string, @Query('staffIds') staffIds?: string) {
    const staffIdArr = staffIds ? staffIds.split(',').map(Number) : undefined;
    return this.accountingService.getDailyTipSum(date, staffIdArr);
  }

  // دریافت لیست تراکنش‌های تیپ
  @Get('tips')
  @Roles(Role.ADMIN, Role.BARBER)
  async getTipTransactions(@Query('date') date?: string, @Query('staffId') staffId?: string) {
    return this.accountingService.getTipTransactions(date, staffId ? +staffId : undefined);
  }

  // تغییر وضعیت برداشت تیپ (تأیید/رد توسط ادمین)
  @Put('tips/:id/status')
  @Roles(Role.ADMIN)
  async updateTipTransactionStatus(@Param('id') id: string, @Body() dto: UpdateTipTransactionStatusDto) {
    return this.accountingService.updateTipTransactionStatus(+id, dto);
  }

  // --- Bank Account CRUD ---
  @Get('bank-accounts')
  @Roles(Role.ADMIN)
  async getBankAccounts() {
    return this.accountingService.getBankAccounts();
  }

  @Get('bank-accounts/:id')
  @Roles(Role.ADMIN)
  async getBankAccountById(@Param('id') id: string) {
    return this.accountingService.getBankAccountById(+id);
  }

  @Post('bank-accounts')
  @Roles(Role.ADMIN)
  async createBankAccount(@Body() dto: CreateBankAccountDto) {
    return this.accountingService.createBankAccount(dto);
  }

  @Patch('bank-accounts/:id')
  @Roles(Role.ADMIN)
  async updateBankAccount(@Param('id') id: string, @Body() dto: UpdateBankAccountDto) {
    return this.accountingService.updateBankAccount(+id, dto);
  }

  @Delete('bank-accounts/:id')
  @Roles(Role.ADMIN)
  async deleteBankAccount(@Param('id') id: string) {
    return this.accountingService.deleteBankAccount(+id);
  }

  @Post('bank-accounts/transfer')
  @Roles(Role.ADMIN)
  async transferBetweenAccounts(@Body() dto: { fromAccountId: number, toAccountId: number, amount: number, description?: string, createdBy: number }) {
    return this.accountingService.transferBetweenAccounts(dto);
  }

  @Get('default-settlement-bank-account')
  async getDefaultSettlementBankAccount(@Req() req) {
    const setting = await this.accountingService.getSetting('default_settlement_bank_account_id');
    return { bankAccountId: setting ? Number(setting.value) : null };
  }

  @Post('default-settlement-bank-account')
  async setDefaultSettlementBankAccount(@Body() body: { bankAccountId: number }) {
    await this.accountingService.setSetting('default_settlement_bank_account_id', String(body.bankAccountId));
    return { success: true };
  }

  // 1. لیست آرایشگران با موجودی و مجموع برداشت‌ها
  @Get('barbers/balances')
  async getBarbersBalances() {
    return this.accountingService.getBarbersBalances();
  }

  // 2. ثبت درخواست برداشت توسط آرایشگر
  @Post('barber-withdrawals')
  async requestBarberWithdrawal(@Body() body: { barberId: number, amount: number }) {
    return this.accountingService.requestBarberWithdrawal(body.barberId, body.amount);
  }

  // 3. لیست درخواست‌های برداشت (ادمین)
  @Get('barber-withdrawals')
  async getBarberWithdrawals(@Query('status') status?: string) {
    return this.accountingService.getBarberWithdrawals(status);
  }

  // 4. تایید درخواست برداشت
  @Patch('barber-withdrawals/:id/approve')
  async approveBarberWithdrawal(@Param('id') id: string, @Body() body: { adminId: number, bankAccountId: number }) {
    return this.accountingService.approveBarberWithdrawal(Number(id), body.adminId, body.bankAccountId);
  }

  // 5. رد درخواست برداشت
  @Patch('barber-withdrawals/:id/reject')
  async rejectBarberWithdrawal(@Param('id') id: string, @Body() body: { adminId: number }) {
    return this.accountingService.rejectBarberWithdrawal(Number(id), body.adminId);
  }

  // حذف درخواست برداشت و تراکنش مالی مرتبط
  @Delete('barber-withdrawals/:id')
  async deleteBarberWithdrawal(@Param('id') id: string) {
    return this.accountingService.deleteBarberWithdrawal(Number(id));
  }

  @Put('barber-withdrawals/:id')
  async updateBarberWithdrawal(@Param('id') id: string, @Body() body: { amount: number, bankAccountId?: number, description?: string }) {
    return this.accountingService.updateBarberWithdrawal(Number(id), body);
  }
} 