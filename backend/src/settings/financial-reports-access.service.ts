import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const SINGLETON_ID = 1;
const ACCESS_TOKEN_TTL_SEC = 900;

export interface FinancialAccessTokenPayload {
  sub: number;
  role: string;
  scope: 'financial_reports';
  tokenVersion: number;
}

@Injectable()
export class FinancialReportsAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private async getOrCreateRecord() {
    return this.prisma.financialReportsAccess.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
  }

  async getPasswordStatus(): Promise<{ isSet: boolean }> {
    const record = await this.getOrCreateRecord();
    return { isSet: !!record.passwordHash };
  }

  async setPassword(
    adminUserId: number,
    newPassword: string,
    currentPassword?: string,
  ): Promise<{ success: true }> {
    const record = await this.getOrCreateRecord();

    if (record.passwordHash) {
      if (!currentPassword) {
        throw new BadRequestException('Current password is required');
      }
      const match = await bcrypt.compare(currentPassword, record.passwordHash);
      if (!match) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.financialReportsAccess.update({
      where: { id: SINGLETON_ID },
      data: {
        passwordHash,
        tokenVersion: record.tokenVersion + 1,
        updatedByUserId: adminUserId,
      },
    });

    return { success: true };
  }

  async verifyAccess(
    adminUserId: number,
    password: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const record = await this.getOrCreateRecord();

    if (!record.passwordHash) {
      throw new ForbiddenException('Financial reports password is not configured');
    }

    const match = await bcrypt.compare(password, record.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Password is incorrect');
    }

    const payload: FinancialAccessTokenPayload = {
      sub: adminUserId,
      role: 'ADMIN',
      scope: 'financial_reports',
      tokenVersion: record.tokenVersion,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: ACCESS_TOKEN_TTL_SEC,
    });

    return { accessToken, expiresIn: ACCESS_TOKEN_TTL_SEC };
  }

  /**
   * Validates the short-lived financial unlock token (x-financial-access-token).
   */
  async validateAccessToken(
    adminUserId: number,
    token: string,
  ): Promise<void> {
    let payload: FinancialAccessTokenPayload;
    try {
      payload = this.jwtService.verify<FinancialAccessTokenPayload>(token);
    } catch {
      throw new ForbiddenException('Financial reports access is locked');
    }

    if (
      payload.scope !== 'financial_reports' ||
      payload.sub !== adminUserId ||
      payload.role !== 'ADMIN'
    ) {
      throw new ForbiddenException('Financial reports access is locked');
    }

    const record = await this.getOrCreateRecord();
    if (!record.passwordHash || payload.tokenVersion !== record.tokenVersion) {
      throw new ForbiddenException('Financial reports access is locked');
    }
  }
}
