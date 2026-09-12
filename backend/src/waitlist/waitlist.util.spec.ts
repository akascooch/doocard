import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PRODUCT_IN_STOCK, WAITLIST_NOT_FOUND_FA, waitlistActorUserId } from './waitlist.util';

describe('waitlist.util', () => {
  it('derives a positive integer user id from JWT-shaped actors', () => {
    expect(waitlistActorUserId({ id: 7 })).toBe(7);
    expect(waitlistActorUserId({ sub: '12' })).toBe(12);
  });

  it('rejects missing identity', () => {
    expect(() => waitlistActorUserId(null)).toThrow(UnauthorizedException);
    expect(() => waitlistActorUserId({ id: 0 })).toThrow(UnauthorizedException);
  });

  it('uses a generic not-found copy that does not name another user', () => {
    const err = new NotFoundException(WAITLIST_NOT_FOUND_FA);
    expect(err.message).toBe('موردی یافت نشد');
    expect(err.message).not.toMatch(/user|کاربر دیگر/i);
  });

  it('marks in-stock as PRODUCT_IN_STOCK conflict', () => {
    const err = new ConflictException({
      statusCode: 409,
      error: PRODUCT_IN_STOCK,
      message: 'x',
    });
    expect((err.getResponse() as { error: string }).error).toBe(PRODUCT_IN_STOCK);
  });
});
