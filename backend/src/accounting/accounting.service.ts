import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { CreateChequebookDto } from './dto/create-chequebook.dto';
import { UpdateChequebookDto } from './dto/update-chequebook.dto';
import { CreateChequeLeafDto } from './dto/create-cheque-leaf.dto';
import { UpdateChequeLeafDto } from './dto/update-cheque-leaf.dto';
import { QueryChequeLeavesDto } from './dto/query-cheque-leaves.dto';
import { TransactionType, ChequeLeafStatus, ChequeLeafCategory, PaymentMethod } from '@prisma/client';
import { EMPLOYEE_EXPENSE_CATEGORY_CODES } from '../common/constants/employee-commission.constants';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';

@Injectable()
export class AccountingService {
  private static readonly MAX_CHEQUEBOOK_LEAVES = 500;

  private static readonly CHEQUE_LEAF_TRANSITIONS: Record<ChequeLeafStatus, ChequeLeafStatus[]> = {
    BLANK: [ChequeLeafStatus.ISSUED, ChequeLeafStatus.CANCELLED],
    ISSUED: [ChequeLeafStatus.CLEARED, ChequeLeafStatus.BOUNCED, ChequeLeafStatus.CANCELLED],
    CLEARED: [],
    BOUNCED: [],
    CANCELLED: [],
  };

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
    private pushNotificationsService: PushNotificationsService,
  ) {}

  private async assertEmployeeRequiredForCategory(
    categoryId: number | undefined,
    employeeId: number | undefined,
    transactionType: TransactionType,
  ) {
    if (!categoryId || transactionType !== TransactionType.EXPENSE) return;

    const category = await this.prisma.transactionCategory.findFirst({
      where: { id: categoryId, deletedAt: null },
    });
    if (!category) return;

    const needsEmployee =
      category.requiresEmployee ||
      (category.code != null &&
        (EMPLOYEE_EXPENSE_CATEGORY_CODES as readonly string[]).includes(
          category.code,
        ));

    if (needsEmployee && !employeeId) {
      throw new BadRequestException(
        'انتخاب کارمند برای این دسته‌بندی هزینه الزامی است',
      );
    }

    if (employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
      });
      if (!employee) {
        throw new NotFoundException('Employee not found');
      }
    }
  }

  // ==================== TRANSACTIONS ====================

  /**
   * Create a new transaction
   * Updates bank account balance if accountId provided
   * Idempotent if meta.externalRef exists
   */
  async createTransaction(dto: CreateTransactionDto, userId?: number) {
    // Check for duplicate based on externalRef in meta
    if (dto.meta && dto.meta.externalRef) {
      const existing = await this.prisma.transaction.findFirst({
        where: {
          meta: {
            path: ['externalRef'],
            equals: dto.meta.externalRef
          },
          deletedAt: null
        }
      });

      if (existing) {
        console.log(`⚠️ Transaction with externalRef ${dto.meta.externalRef} already exists`);
        return existing;
      }
    }

    // Validate category exists
    if (dto.categoryId) {
      const category = await this.prisma.transactionCategory.findFirst({
        where: { id: dto.categoryId, deletedAt: null }
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
      // Validate category type matches transaction type
      if (category.type !== dto.type) {
        throw new BadRequestException(`Category type (${category.type}) doesn't match transaction type (${dto.type})`);
      }
    }

    // Validate account exists
    if (dto.accountId) {
      const account = await this.prisma.bankAccount.findFirst({
        where: { id: dto.accountId, deletedAt: null }
      });
      if (!account) {
        throw new NotFoundException('Bank account not found');
      }
    }

    if (dto.type === TransactionType.TIP) {
      throw new BadRequestException(
        'تراکنش انعام از این مسیر ثبت نمی‌شود؛ انعام جدا از کمیسیون کارمند محاسبه می‌شود',
      );
    }

    await this.assertEmployeeRequiredForCategory(
      dto.categoryId,
      dto.employeeId,
      dto.type,
    );

    // Use Prisma transaction for atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      // Create transaction
      const transaction = await tx.transaction.create({
        data: {
          type: dto.type,
          amount: BigInt(dto.amount),
          currency: dto.currency || 'IRR',
          description: dto.description,
          categoryId: dto.categoryId,
          employeeId: dto.employeeId,
          accountId: dto.accountId,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
          paymentMethod: dto.paymentMethod,
          occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
          createdBy: userId,
          meta: dto.meta || {},
        },
        include: {
          category: true,
          account: true,
          createdByUser: {
            select: { id: true, name: true, phone: true }
          }
        }
      });

      // Update account balance if accountId provided
      if (dto.accountId) {
        const balanceChange = dto.type === 'INCOME' 
          ? BigInt(dto.amount) 
          : BigInt(-dto.amount);

        await tx.bankAccount.update({
          where: { id: dto.accountId },
          data: {
            balance: {
              increment: balanceChange
            }
          }
        });

        console.log(`✅ Updated account ${dto.accountId} balance by ${balanceChange}`);
      }

      // Convert BigInt to Number for JSON serialization
      return {
        ...transaction,
        amount: Number(transaction.amount),
        account: transaction.account ? {
          ...transaction.account,
          balance: Number(transaction.account.balance)
        } : null
      };
    });

    if (dto.type === TransactionType.EXPENSE) {
      await this.notifyAdminsOfExpense(result.id, result.amount);
    }

    return result;
  }

  private async notifyAdminsOfExpense(transactionId: number, amount: number) {
    const formattedAmount = Number(amount).toLocaleString('fa-IR');
    const title = 'هزینه جدید ثبت شد';
    const message = `یک هزینه جدید به مبلغ ${formattedAmount} ثبت شد.`;

    try {
      const notification = await this.notificationsService.create({
        title,
        message,
        type: 'TRANSACTION_CREATED',
        roleTarget: 'ADMIN',
        relatedEntity: `transaction:${transactionId}`,
      });
      this.notificationsGateway.sendToRole('ADMIN', notification);

      await this.pushNotificationsService.sendToRole('ADMIN', {
        title,
        body: message,
        icon: '/logo/logo-512.png',
        data: {
          url: '/dashboard/admin/accounting',
          transactionId,
        },
      });
    } catch (error: any) {
      console.error('Failed to notify admins of expense:', error?.message);
    }
  }

  /**
   * Find all transactions with filtering
   */
  async findAll(filters?: {
    type?: TransactionType;
    accountId?: number;
    categoryId?: number;
    sourceType?: string;
    from?: string;
    to?: string;
    skip?: number;
    take?: number;
  }) {
    console.log('🔍 [AccountingService] findAll called with filters:', filters);

    const where: any = {
      deletedAt: null
    };

    if (filters?.type) where.type = filters.type;
    if (filters?.accountId) where.accountId = filters.accountId;
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.sourceType) where.sourceType = filters.sourceType;
    
    if (filters?.from || filters?.to) {
      where.occurredAt = {};
      if (filters.from) where.occurredAt.gte = new Date(filters.from);
      if (filters.to) where.occurredAt.lte = new Date(filters.to);
    }

    console.log('🔍 [AccountingService] Query where:', where);

    try {
      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where,
          include: {
            category: true,
            account: true,
            destinationAccount: true, // For TRANSFER transactions
            createdByUser: {
              select: { id: true, name: true }
            }
          },
          orderBy: { occurredAt: 'desc' },
          skip: filters?.skip || 0,
          take: filters?.take || 50
        }),
        this.prisma.transaction.count({ where })
      ]);

      console.log(`✅ [AccountingService] Found ${transactions.length} transactions`);

      // Convert BigInt to Number for JSON serialization
      const serializedTransactions = transactions.map(tx => ({
        ...tx,
        amount: Number(tx.amount),
        account: tx.account ? {
          ...tx.account,
          balance: Number(tx.account.balance)
        } : null,
        destinationAccount: tx.destinationAccount ? {
          ...tx.destinationAccount,
          balance: Number(tx.destinationAccount.balance)
        } : null
      }));

      const result = {
        data: serializedTransactions,
        total,
        page: Math.floor((filters?.skip || 0) / (filters?.take || 50)) + 1,
        pages: Math.ceil(total / (filters?.take || 50))
      };

      console.log(`✅ [AccountingService] Returning result with ${result.data.length} items`);
      return result;
    } catch (error) {
      console.error('❌ [AccountingService] Error in findAll:', error);
      throw error;
    }
  }

  /**
   * Find one transaction by ID
   */
  async findOne(id: number) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        account: true,
        destinationAccount: true,
        createdByUser: {
          select: { id: true, name: true, phone: true }
        }
      }
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Convert BigInt to Number for JSON serialization
    return {
      ...transaction,
      amount: Number(transaction.amount),
      account: transaction.account ? {
        ...transaction.account,
        balance: Number(transaction.account.balance)
      } : null,
      destinationAccount: transaction.destinationAccount ? {
        ...transaction.destinationAccount,
        balance: Number(transaction.destinationAccount.balance)
      } : null
    };
  }

  /**
   * Update transaction
   * Recalculates account balance if account changed
   */
  async update(id: number, dto: UpdateTransactionDto, userId?: number) {
    const existing = await this.findOne(id);

    const nextType = (dto.type ?? existing.type) as TransactionType;
    if (nextType === TransactionType.TIP) {
      throw new BadRequestException('تراکنش انعام در گزارش کمیسیون کارمند لحاظ نمی‌شود');
    }

    await this.assertEmployeeRequiredForCategory(
      dto.categoryId ?? existing.categoryId ?? undefined,
      dto.employeeId ?? (existing as { employeeId?: number }).employeeId,
      nextType,
    );

    return this.prisma.$transaction(async (tx) => {
      // If account or amount or type changed, recalculate balances
      if (dto.accountId !== undefined || dto.amount !== undefined || dto.type !== undefined) {
        const oldAccountId = existing.accountId;
        const newAccountId = dto.accountId ?? existing.accountId;
        const oldAmount = Number(existing.amount);
        const newAmount = dto.amount ?? oldAmount;
        const oldType = existing.type;
        const newType = dto.type ?? oldType;

        // Revert old balance change
        if (oldAccountId) {
          const oldChange = oldType === 'INCOME' ? BigInt(-oldAmount) : BigInt(oldAmount);
          await tx.bankAccount.update({
            where: { id: oldAccountId },
            data: { balance: { increment: oldChange } }
          });
        }

        // Apply new balance change
        if (newAccountId) {
          const newChange = newType === 'INCOME' ? BigInt(newAmount) : BigInt(-newAmount);
          await tx.bankAccount.update({
            where: { id: newAccountId },
            data: { balance: { increment: newChange } }
          });
        }
      }

      // Update transaction
      const updated = await tx.transaction.update({
        where: { id },
        data: {
          ...(dto.type && { type: dto.type }),
          ...(dto.amount !== undefined && { amount: BigInt(dto.amount) }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
          ...(dto.employeeId !== undefined && { employeeId: dto.employeeId }),
          ...(dto.accountId !== undefined && { accountId: dto.accountId }),
          ...(dto.sourceType !== undefined && { sourceType: dto.sourceType }),
          ...(dto.sourceId !== undefined && { sourceId: dto.sourceId }),
          ...(dto.paymentMethod !== undefined && { paymentMethod: dto.paymentMethod }),
          ...(dto.occurredAt && { occurredAt: new Date(dto.occurredAt) }),
          ...(dto.meta !== undefined && { meta: dto.meta }),
        },
        include: {
          category: true,
          account: true,
          createdByUser: { select: { id: true, name: true } }
        }
      });

      // Convert BigInt to Number for JSON serialization
      return {
        ...updated,
        amount: Number(updated.amount),
        account: updated.account ? {
          ...updated.account,
          balance: Number(updated.account.balance)
        } : null
      };
    });
  }

  /**
   * Soft delete transaction
   * Reverses account balance
   */
  async remove(id: number) {
    const transaction = await this.findOne(id);

    const result = await this.prisma.$transaction(async (tx) => {
      // Reverse account balances based on transaction type
      if (transaction.type === 'TRANSFER') {
        // For transfers, reverse both accounts
        if (transaction.accountId) {
          // Reverse source account (add back the amount)
          await tx.bankAccount.update({
            where: { id: transaction.accountId },
            data: { balance: { increment: BigInt(Number(transaction.amount)) } }
          });
          console.log(`✅ Reversed source account ${transaction.accountId} balance`);
        }
        
        if (transaction.destinationAccountId) {
          // Reverse destination account (subtract the amount)
          await tx.bankAccount.update({
            where: { id: transaction.destinationAccountId },
            data: { balance: { decrement: BigInt(Number(transaction.amount)) } }
          });
          console.log(`✅ Reversed destination account ${transaction.destinationAccountId} balance`);
        }
      } else if (transaction.accountId) {
        // For INCOME/EXPENSE, reverse the single account
        const balanceChange = transaction.type === 'INCOME'
          ? BigInt(-Number(transaction.amount))
          : BigInt(Number(transaction.amount));

        await tx.bankAccount.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: balanceChange } }
        });

        console.log(`✅ Reversed account ${transaction.accountId} balance by ${balanceChange}`);
      }

      // Soft delete
      return tx.transaction.update({
        where: { id },
        data: { deletedAt: new Date() }
      });
    });

    // Convert BigInt to Number for JSON serialization
    return {
      ...result,
      amount: Number(result.amount)
    };
  }

  /**
   * Create inter-account transfer
   * Moves money from one account to another atomically
   */
  async createTransfer(dto: CreateTransferDto, userId?: number) {
    // Validate accounts exist and are different
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('Cannot transfer to the same account');
    }

    const fromAccount = await this.findOneAccount(dto.fromAccountId);
    const toAccount = await this.findOneAccount(dto.toAccountId);

    // Check sufficient balance
    if (Number(fromAccount.balance) < dto.amount) {
      throw new BadRequestException(
        `Insufficient balance in ${fromAccount.name}. Available: ${Number(fromAccount.balance)} Rials`
      );
    }

    // Create transfer using Prisma transaction
    return this.prisma.$transaction(async (tx) => {
      // Create the transfer transaction record
      const transaction = await tx.transaction.create({
        data: {
          type: 'TRANSFER',
          amount: BigInt(dto.amount),
          currency: 'IRR',
          description: dto.description || `انتقال از ${fromAccount.name} به ${toAccount.name}`,
          accountId: dto.fromAccountId, // Source account
          destinationAccountId: dto.toAccountId, // Destination account
          sourceType: 'TRANSFER',
          occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
          createdBy: userId,
          meta: {
            transferType: 'inter_account',
            fromAccount: fromAccount.name,
            toAccount: toAccount.name
          }
        },
        include: {
          account: true,
          destinationAccount: true,
          createdByUser: {
            select: { id: true, name: true, phone: true }
          }
        }
      });

      // Update source account (decrease balance)
      await tx.bankAccount.update({
        where: { id: dto.fromAccountId },
        data: {
          balance: {
            decrement: BigInt(dto.amount)
          }
        }
      });

      // Update destination account (increase balance)
      await tx.bankAccount.update({
        where: { id: dto.toAccountId },
        data: {
          balance: {
            increment: BigInt(dto.amount)
          }
        }
      });

      console.log(`✅ Transfer: ${dto.amount} Rials from account ${dto.fromAccountId} to ${dto.toAccountId}`);

      // Convert BigInt to Number for JSON serialization
      return {
        ...transaction,
        amount: Number(transaction.amount),
        account: transaction.account ? {
          ...transaction.account,
          balance: Number(transaction.account.balance)
        } : null,
        destinationAccount: transaction.destinationAccount ? {
          ...transaction.destinationAccount,
          balance: Number(transaction.destinationAccount.balance)
        } : null
      };
    });
  }

  // ==================== CATEGORIES ====================

  async createCategory(dto: CreateCategoryDto) {
    // Validate parent exists
    if (dto.parentId) {
      const parent = await this.prisma.transactionCategory.findFirst({
        where: { id: dto.parentId, deletedAt: null }
      });
      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
    }

    return this.prisma.transactionCategory.create({
      data: dto,
      include: {
        parent: true,
        children: true
      }
    });
  }

  async findAllCategories(type?: TransactionType) {
    const where: any = { deletedAt: null, isActive: true };
    if (type) where.type = type;

    return this.prisma.transactionCategory.findMany({
      where,
      include: {
        parent: true,
        children: true,
        _count: {
          select: { transactions: true }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async findOneCategory(id: number) {
    const category = await this.prisma.transactionCategory.findFirst({
      where: { id, deletedAt: null },
      include: {
        parent: true,
        children: true,
        _count: { select: { transactions: true } }
      }
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async updateCategory(id: number, dto: UpdateCategoryDto) {
    await this.findOneCategory(id);

    return this.prisma.transactionCategory.update({
      where: { id },
      data: dto,
      include: {
        parent: true,
        children: true
      }
    });
  }

  async removeCategory(id: number) {
    const category = await this.findOneCategory(id);

    // Check if has transactions
    const transactionCount = await this.prisma.transaction.count({
      where: { categoryId: id, deletedAt: null }
    });

    if (transactionCount > 0) {
      throw new BadRequestException(`Cannot delete category with ${transactionCount} transactions. Set inactive instead.`);
    }

    return this.prisma.transactionCategory.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  // ==================== BANK ACCOUNTS ====================

  async createAccount(dto: CreateAccountDto) {
    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { isDefault: true, deletedAt: null },
        data: { isDefault: false }
      });
    }

    const created = await this.prisma.bankAccount.create({
      data: dto
    });

    // Convert BigInt to Number for JSON serialization
    return {
      ...created,
      balance: Number(created.balance)
    };
  }

  async findAllAccounts(activeOnly = false) {
    const where: any = { deletedAt: null };
    if (activeOnly) where.isActive = true;

    const accounts = await this.prisma.bankAccount.findMany({
      where,
      include: {
        _count: {
          select: { transactions: true }
        }
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    });

    // Convert BigInt to Number for JSON serialization
    return accounts.map(acc => ({
      ...acc,
      balance: Number(acc.balance)
    }));
  }

  async findOneAccount(id: number) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { transactions: true } }
      }
    });

    if (!account) {
      throw new NotFoundException('Bank account not found');
    }

    // Convert BigInt to Number for JSON serialization
    return {
      ...account,
      balance: Number(account.balance)
    };
  }

  async updateAccount(id: number, dto: UpdateAccountDto) {
    await this.findOneAccount(id);

    // If setting as default, unset others
    if (dto.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { isDefault: true, deletedAt: null, NOT: { id } },
        data: { isDefault: false }
      });
    }

    const updated = await this.prisma.bankAccount.update({
      where: { id },
      data: dto
    });

    // Convert BigInt to Number for JSON serialization
    return {
      ...updated,
      balance: Number(updated.balance)
    };
  }

  async setDefaultAccount(id: number) {
    await this.findOneAccount(id);

    const result = await this.prisma.$transaction(async (tx) => {
      // Unset all defaults
      await tx.bankAccount.updateMany({
        where: { isDefault: true, deletedAt: null },
        data: { isDefault: false }
      });

      // Set new default
      return tx.bankAccount.update({
        where: { id },
        data: { isDefault: true, isActive: true }
      });
    });

    // Convert BigInt to Number for JSON serialization
    return {
      ...result,
      balance: Number(result.balance)
    };
  }

  async removeAccount(id: number) {
    const account = await this.findOneAccount(id);

    if (account.isDefault) {
      throw new BadRequestException('Cannot delete default account. Set another account as default first.');
    }

    // Check if has transactions
    const transactionCount = await this.prisma.transaction.count({
      where: { accountId: id, deletedAt: null }
    });

    if (transactionCount > 0) {
      throw new BadRequestException(`Cannot delete account with ${transactionCount} transactions. Set inactive instead.`);
    }

    const chequebookCount = await this.prisma.chequebook.count({
      where: { bankAccountId: id, deletedAt: null }
    });

    if (chequebookCount > 0) {
      throw new BadRequestException(`Cannot delete account with ${chequebookCount} chequebooks. Remove chequebooks first.`);
    }

    return this.prisma.bankAccount.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  /**
   * Recalculate account balance from all transactions
   */
  async recalculateAccountBalance(accountId: number) {
    const account = await this.findOneAccount(accountId);

    const aggregations = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: {
        accountId,
        deletedAt: null
      },
      _sum: {
        amount: true
      }
    });

    let balance = BigInt(0);
    for (const agg of aggregations) {
      const sum = agg._sum.amount || BigInt(0);
      if (agg.type === 'INCOME') {
        balance += BigInt(sum);
      } else if (agg.type === 'EXPENSE') {
        balance -= BigInt(sum);
      }
    }

    const updated = await this.prisma.bankAccount.update({
      where: { id: accountId },
      data: { balance }
    });

    // Convert BigInt to Number for JSON serialization
    return {
      ...updated,
      balance: Number(updated.balance)
    };
  }

  // ==================== REPORTS & AGGREGATIONS ====================

  /**
   * Get financial summary for a period
   */
  async getSummary(from?: string, to?: string) {
    const where: any = { deletedAt: null };
    
    if (from || to) {
      where.occurredAt = {};
      if (from) where.occurredAt.gte = new Date(from);
      if (to) where.occurredAt.lte = new Date(to);
    }

    const [income, expense, settlementDeductions, tipSplits] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...where, type: 'INCOME' },
        _sum: { amount: true },
        _count: true
      }),
      this.prisma.transaction.aggregate({
        where: { ...where, type: 'EXPENSE' },
        _sum: { amount: true },
        _count: true
      }),
      this.prisma.appointment.aggregate({
        _sum: { settlementDeductionAmount: true },
        where: {
          deletedAt: null,
          status: { in: ['SETTLED', 'PAID', 'COMPLETED'] },
          paidAt: where.occurredAt,
          settlementDeductionAmount: { not: null },
        },
      }),
      this.prisma.appointment.aggregate({
        _sum: { tipStaffShareRial: true, tipSalonShareRial: true, tipAmount: true },
        where: {
          deletedAt: null,
          tipAmount: { not: null },
          ...(where.occurredAt ? { paidAt: where.occurredAt } : {}),
        },
      }),
    ]);

    const totalIncome = Number(income._sum.amount || 0);
    const totalExpense = Number(expense._sum.amount || 0);

    return {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      totalSettlementDeduction: Number(settlementDeductions._sum.settlementDeductionAmount || 0),
      totalTipAmount: Number(tipSplits._sum.tipAmount || 0),
      totalTipStaffShare: Number(tipSplits._sum.tipStaffShareRial || 0),
      totalTipSalonShare: Number(tipSplits._sum.tipSalonShareRial || 0),
      incomeCount: income._count,
      expenseCount: expense._count,
      period: { from, to }
    };
  }

  /**
   * Get summary by category
   */
  async getSummaryByCategory(type?: TransactionType, from?: string, to?: string) {
    const where: any = { deletedAt: null, categoryId: { not: null } };
    if (type) where.type = type;
    
    if (from || to) {
      where.occurredAt = {};
      if (from) where.occurredAt.gte = new Date(from);
      if (to) where.occurredAt.lte = new Date(to);
    }

    const groups = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
      _count: true
    });

    // Get category details
    const categoryIds = groups.map(g => g.categoryId).filter(id => id !== null);
    const categories = await this.prisma.transactionCategory.findMany({
      where: { id: { in: categoryIds } }
    });

    const categoryMap = new Map(categories.map(c => [c.id, c]));

    return groups.map(group => ({
      categoryId: group.categoryId,
      categoryName: categoryMap.get(group.categoryId)?.name || 'Unknown',
      total: Number(group._sum.amount || 0),
      count: group._count
    }));
  }

  /**
   * Get daily report
   */
  async getDailyReport(date: string) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.getSummary(startOfDay.toISOString(), endOfDay.toISOString());
  }

  /**
   * Get balance by account
   */
  async getBalanceByAccount() {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true,
        name: true,
        balance: true,
        currency: true
      },
      orderBy: { isDefault: 'desc' }
    });

    return accounts.map(acc => ({
      ...acc,
      balance: Number(acc.balance)
    }));
  }

  /**
   * Soft-delete auto-created clearance transaction and reopen leaf as ISSUED.
   * Idempotent if already unlinked / transaction already deleted.
   */
  async reverseChequeClearedAccounting(leafId: number) {
    const leaf = await this.prisma.chequeLeaf.findFirst({
      where: { id: leafId, deletedAt: null },
    });
    if (!leaf) {
      throw new NotFoundException('Cheque leaf not found');
    }
    if (leaf.status !== ChequeLeafStatus.CLEARED) {
      throw new BadRequestException('فقط چک وصول‌شده قابل برگشت حسابداری است');
    }

    if (leaf.transactionId) {
      try {
        await this.remove(leaf.transactionId);
      } catch (err: any) {
        // Already soft-deleted is acceptable
        if (!(err instanceof NotFoundException)) {
          throw err;
        }
      }
    }

    const updated = await this.prisma.chequeLeaf.update({
      where: { id: leafId },
      data: {
        status: ChequeLeafStatus.ISSUED,
        clearedAt: null,
        transactionId: null,
      },
      include: {
        chequebook: {
          select: { id: true, serialNumber: true, bankAccount: { select: { id: true, name: true } } },
        },
        transaction: true,
      },
    });

    return this.serializeChequeLeaf(updated);
  }

  /** ExternalRef used for cleared-cheque ledger rows (idempotency). */
  static chequeClearedExternalRef(leafId: number): string {
    return `cheque-leaf-cleared:${leafId}`;
  }

  private buildChequeClearedDescription(leaf: {
    leafNumber: number;
    payee: string | null;
    category?: ChequeLeafCategory | null;
    chequebook?: { serialNumber?: string | null; id: number } | null;
  }): string {
    const serial = leaf.chequebook?.serialNumber || `#${leaf.chequebook?.id ?? '?'}`;
    const payee = (leaf.payee || '—').trim();
    const cat =
      leaf.category === ChequeLeafCategory.GUARANTEE ? 'ضمانت' : 'عادی';
    return `وصول چک | برگه #${leaf.leafNumber} | دسته چک ${serial} | دریافت‌کننده: ${payee} | نوع: ${cat}`;
  }

  private async ensureClearedChequeLedgerTransaction(
    leaf: {
      id: number;
      leafNumber: number;
      amount: bigint | null;
      payee: string | null;
      category?: ChequeLeafCategory | null;
      transactionId: number | null;
      chequebook: {
        id: number;
        serialNumber: string | null;
        bankAccountId: number;
      };
    },
    userId?: number,
  ): Promise<number> {
    if (leaf.transactionId) {
      return leaf.transactionId;
    }
    if (leaf.amount == null || leaf.amount <= 0n) {
      throw new BadRequestException(
        'برای وصول چک باید مبلغ معتبر ثبت شده باشد',
      );
    }

    const externalRef = AccountingService.chequeClearedExternalRef(leaf.id);
    const created = await this.createTransaction(
      {
        type: TransactionType.EXPENSE,
        amount: Number(leaf.amount),
        accountId: leaf.chequebook.bankAccountId,
        description: this.buildChequeClearedDescription(leaf),
        sourceType: 'CHEQUE_LEAF',
        sourceId: leaf.id,
        paymentMethod: PaymentMethod.CHEQUE,
        meta: {
          externalRef,
          chequeLeafId: leaf.id,
          autoFromChequeClearance: true,
        },
      },
      userId,
    );

    return created.id;
  }

  // ==================== CHEQUEBOOKS ====================

  private serializeChequeLeaf<T extends { amount?: bigint | null }>(leaf: T) {
    return {
      ...leaf,
      amount: leaf.amount != null ? Number(leaf.amount) : null,
    };
  }

  private assertValidChequeRange(startNumber: number, endNumber: number) {
    if (startNumber > endNumber) {
      throw new BadRequestException('startNumber must be less than or equal to endNumber');
    }
    const leafCount = endNumber - startNumber + 1;
    if (leafCount > AccountingService.MAX_CHEQUEBOOK_LEAVES) {
      throw new BadRequestException(
        `Chequebook cannot exceed ${AccountingService.MAX_CHEQUEBOOK_LEAVES} leaves`
      );
    }
    return leafCount;
  }

  private assertChequeLeafTransition(current: ChequeLeafStatus, next: ChequeLeafStatus) {
    if (current === next) return;
    const allowed = AccountingService.CHEQUE_LEAF_TRANSITIONS[current] || [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(`Cannot transition cheque leaf from ${current} to ${next}`);
    }
  }

  async createChequebook(dto: CreateChequebookDto) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: dto.bankAccountId, deletedAt: null }
    });
    if (!account) {
      throw new NotFoundException('Bank account not found');
    }

    const leafCount = this.assertValidChequeRange(dto.startNumber, dto.endNumber);

    const existingOverlap = await this.prisma.chequebook.findFirst({
      where: {
        bankAccountId: dto.bankAccountId,
        deletedAt: null,
        startNumber: { lte: dto.endNumber },
        endNumber: { gte: dto.startNumber },
      }
    });
    if (existingOverlap) {
      throw new ConflictException('Cheque number range overlaps with an existing chequebook for this account');
    }

    return this.prisma.$transaction(async (tx) => {
      const chequebook = await tx.chequebook.create({
        data: {
          bankAccountId: dto.bankAccountId,
          serialNumber: dto.serialNumber,
          startNumber: dto.startNumber,
          endNumber: dto.endNumber,
          leafCount,
          issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
          description: dto.description,
        },
        include: {
          bankAccount: { select: { id: true, name: true, provider: true } },
        },
      });

      const leavesData = Array.from({ length: leafCount }, (_, index) => ({
        chequebookId: chequebook.id,
        leafNumber: dto.startNumber + index,
        status: ChequeLeafStatus.BLANK,
      }));

      await tx.chequeLeaf.createMany({ data: leavesData });

      return {
        ...chequebook,
        _count: { leaves: leafCount },
      };
    });
  }

  async findAllChequebooks(bankAccountId?: number) {
    const where: any = { deletedAt: null };
    if (bankAccountId) where.bankAccountId = bankAccountId;

    const chequebooks = await this.prisma.chequebook.findMany({
      where,
      include: {
        bankAccount: { select: { id: true, name: true, provider: true } },
        _count: { select: { leaves: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return chequebooks;
  }

  async findOneChequebook(id: number) {
    const chequebook = await this.prisma.chequebook.findFirst({
      where: { id, deletedAt: null },
      include: {
        bankAccount: { select: { id: true, name: true, provider: true } },
        _count: { select: { leaves: true } },
      },
    });

    if (!chequebook) {
      throw new NotFoundException('Chequebook not found');
    }

    return chequebook;
  }

  async updateChequebook(id: number, dto: UpdateChequebookDto) {
    const existing = await this.findOneChequebook(id);

    if (dto.startNumber !== undefined || dto.endNumber !== undefined) {
      throw new BadRequestException('Cannot change cheque number range after creation');
    }

    if (dto.bankAccountId !== undefined && dto.bankAccountId !== existing.bankAccountId) {
      throw new BadRequestException('Cannot change bank account after creation');
    }

    return this.prisma.chequebook.update({
      where: { id },
      data: {
        ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
        ...(dto.issuedAt !== undefined && { issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        bankAccount: { select: { id: true, name: true, provider: true } },
        _count: { select: { leaves: true } },
      },
    });
  }

  async removeChequebook(id: number) {
    const chequebook = await this.findOneChequebook(id);

    const activeLeaves = await this.prisma.chequeLeaf.count({
      where: {
        chequebookId: id,
        deletedAt: null,
        status: { in: [ChequeLeafStatus.ISSUED, ChequeLeafStatus.CLEARED] },
      },
    });

    if (activeLeaves > 0) {
      throw new BadRequestException(
        'Cannot delete chequebook with issued or cleared leaves'
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.chequeLeaf.updateMany({
        where: { chequebookId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      return tx.chequebook.update({
        where: { id: chequebook.id },
        data: { deletedAt: new Date(), isActive: false },
      });
    });
  }

  async findChequeLeavesByChequebook(chequebookId: number, query?: QueryChequeLeavesDto) {
    await this.findOneChequebook(chequebookId);
    return this.findAllChequeLeaves({ ...query, chequebookId });
  }

  async findAllChequeLeaves(query?: QueryChequeLeavesDto) {
    const where: any = { deletedAt: null };

    if (query?.chequebookId) where.chequebookId = query.chequebookId;
    if (query?.status) where.status = query.status;
    if (query?.bankAccountId) {
      where.chequebook = { bankAccountId: query.bankAccountId, deletedAt: null };
    }

    const take = query?.take || 100;
    const skip = query?.skip || 0;

    const [leaves, total] = await Promise.all([
      this.prisma.chequeLeaf.findMany({
        where,
        include: {
          chequebook: {
            select: {
              id: true,
              serialNumber: true,
              startNumber: true,
              endNumber: true,
              bankAccount: { select: { id: true, name: true } },
            },
          },
          transaction: {
            select: { id: true, type: true, amount: true, occurredAt: true },
          },
        },
        orderBy: [{ chequebookId: 'asc' }, { leafNumber: 'asc' }],
        skip,
        take,
      }),
      this.prisma.chequeLeaf.count({ where }),
    ]);

    return {
      data: leaves.map((leaf) => ({
        ...this.serializeChequeLeaf(leaf),
        transaction: leaf.transaction
          ? { ...leaf.transaction, amount: Number(leaf.transaction.amount) }
          : null,
      })),
      total,
      page: Math.floor(skip / take) + 1,
      pages: Math.ceil(total / take),
    };
  }

  async createChequeLeaf(dto: CreateChequeLeafDto) {
    const chequebook = await this.findOneChequebook(dto.chequebookId);

    if (dto.leafNumber < chequebook.startNumber || dto.leafNumber > chequebook.endNumber) {
      throw new BadRequestException('leafNumber is outside the chequebook range');
    }

    const existing = await this.prisma.chequeLeaf.findFirst({
      where: {
        chequebookId: dto.chequebookId,
        leafNumber: dto.leafNumber,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException('Cheque leaf number already exists in this chequebook');
    }

    if (dto.transactionId) {
      await this.validateChequeLeafTransaction(dto.transactionId);
    }

    const created = await this.prisma.chequeLeaf.create({
      data: {
        chequebookId: dto.chequebookId,
        leafNumber: dto.leafNumber,
        category: dto.category ?? ChequeLeafCategory.NORMAL,
        amount: dto.amount != null ? BigInt(dto.amount) : null,
        payee: dto.payee,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
        description: dto.description,
        transactionId: dto.transactionId,
        status: dto.issuedAt || dto.amount ? ChequeLeafStatus.ISSUED : ChequeLeafStatus.BLANK,
      },
      include: {
        chequebook: {
          select: { id: true, serialNumber: true, bankAccount: { select: { id: true, name: true } } },
        },
        transaction: { select: { id: true, type: true, amount: true } },
      },
    });

    return {
      ...this.serializeChequeLeaf(created),
      transaction: created.transaction
        ? { ...created.transaction, amount: Number(created.transaction.amount) }
        : null,
    };
  }

  async updateChequeLeaf(id: number, dto: UpdateChequeLeafDto, userId?: number) {
    const existing = await this.prisma.chequeLeaf.findFirst({
      where: { id, deletedAt: null },
      include: {
        transaction: true,
        chequebook: {
          select: {
            id: true,
            serialNumber: true,
            bankAccountId: true,
            bankAccount: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Cheque leaf not found');
    }

    if (dto.status) {
      this.assertChequeLeafTransition(existing.status, dto.status);
    }

    if (dto.transactionId !== undefined && dto.transactionId !== null) {
      await this.validateChequeLeafTransaction(dto.transactionId, id);
    }

    const nextStatus = dto.status ?? existing.status;
    const becomingCleared =
      nextStatus === ChequeLeafStatus.CLEARED &&
      existing.status !== ChequeLeafStatus.CLEARED;

    const updateData: any = {
      ...(dto.amount !== undefined && { amount: dto.amount != null ? BigInt(dto.amount) : null }),
      ...(dto.payee !== undefined && { payee: dto.payee }),
      ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.transactionId !== undefined && { transactionId: dto.transactionId }),
      ...(dto.status !== undefined && { status: dto.status }),
    };

    if (nextStatus === ChequeLeafStatus.ISSUED && !existing.issuedAt && !dto.issuedAt) {
      updateData.issuedAt = new Date();
    } else if (dto.issuedAt !== undefined) {
      updateData.issuedAt = dto.issuedAt ? new Date(dto.issuedAt) : null;
    }

    if (nextStatus === ChequeLeafStatus.CLEARED) {
      updateData.clearedAt = dto.clearedAt ? new Date(dto.clearedAt) : new Date();
    } else if (dto.clearedAt !== undefined) {
      updateData.clearedAt = dto.clearedAt ? new Date(dto.clearedAt) : null;
    }

    if (becomingCleared && dto.transactionId == null && existing.transactionId == null) {
      const amountForClear =
        updateData.amount !== undefined ? updateData.amount : existing.amount;
      const txnId = await this.ensureClearedChequeLedgerTransaction(
        {
          id: existing.id,
          leafNumber: existing.leafNumber,
          amount: amountForClear,
          payee: dto.payee !== undefined ? dto.payee : existing.payee,
          category: dto.category ?? existing.category,
          transactionId: null,
          chequebook: {
            id: existing.chequebook.id,
            serialNumber: existing.chequebook.serialNumber,
            bankAccountId: existing.chequebook.bankAccountId,
          },
        },
        userId,
      );
      updateData.transactionId = txnId;
    }

    const updated = await this.prisma.chequeLeaf.update({
      where: { id },
      data: updateData,
      include: {
        chequebook: {
          select: { id: true, serialNumber: true, bankAccount: { select: { id: true, name: true } } },
        },
        transaction: { select: { id: true, type: true, amount: true, occurredAt: true, description: true } },
      },
    });

    return {
      ...this.serializeChequeLeaf(updated),
      transaction: updated.transaction
        ? { ...updated.transaction, amount: Number(updated.transaction.amount) }
        : null,
    };
  }

  async removeChequeLeaf(id: number) {
    const existing = await this.prisma.chequeLeaf.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Cheque leaf not found');
    }

    if (existing.status === ChequeLeafStatus.ISSUED || existing.status === ChequeLeafStatus.CLEARED) {
      throw new BadRequestException('Cannot delete issued or cleared cheque leaves');
    }

    return this.prisma.chequeLeaf.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async validateChequeLeafTransaction(transactionId: number, excludeLeafId?: number) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, deletedAt: null },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const linked = await this.prisma.chequeLeaf.findFirst({
      where: {
        transactionId,
        deletedAt: null,
        ...(excludeLeafId ? { NOT: { id: excludeLeafId } } : {}),
      },
    });
    if (linked) {
      throw new ConflictException('Transaction is already linked to another cheque leaf');
    }
  }
}
