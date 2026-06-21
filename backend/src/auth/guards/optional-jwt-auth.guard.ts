import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { isObservable } from 'rxjs';
import { firstValueFrom } from 'rxjs';

/**
 * Authenticates JWT when present; does not reject unauthenticated requests.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const result = super.canActivate(context);
      if (result instanceof Promise) {
        await result;
      } else if (isObservable(result)) {
        await firstValueFrom(result);
      }
    } catch {
      // No token or invalid token — continue as anonymous
    }
    return true;
  }

  handleRequest<TUser = any>(_err: any, user: any): TUser {
    return user;
  }
}
