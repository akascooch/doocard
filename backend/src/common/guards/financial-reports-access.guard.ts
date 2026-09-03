import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { FinancialReportsAccessService } from '../../settings/financial-reports-access.service';

/**
 * Requires x-financial-access-token in addition to normal JWT admin auth.
 */
@Injectable()
export class FinancialReportsAccessGuard implements CanActivate {
  constructor(
    private readonly financialReportsAccessService: FinancialReportsAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException('Financial reports access is locked');
    }

    const token =
      request.headers['x-financial-access-token'] ||
      request.headers['X-Financial-Access-Token'];

    if (!token || typeof token !== 'string') {
      throw new ForbiddenException('Financial reports access is locked');
    }

    await this.financialReportsAccessService.validateAccessToken(user.id, token);
    return true;
  }
}
