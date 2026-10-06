import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  Throttle,
  ThrottlerException,
  ThrottlerGuard,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import { toUserFacingFaMessage } from '../common/filters/http-user-message';

const controllerSource = readFileSync(join(__dirname, 'auth.controller.ts'), 'utf8');

function routeBlock(route: string): string {
  const marker = `@Post('${route}')`;
  const start = controllerSource.indexOf(marker);
  if (start < 0) {
    throw new Error(`missing route ${route}`);
  }
  const next = controllerSource.indexOf('@Post(', start + marker.length);
  return controllerSource.slice(start, next === -1 ? undefined : next);
}

class AuthThrottleProbe {
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  login() {
    return 'login';
  }

  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  refresh() {
    return 'refresh';
  }
}

describe('auth endpoint throttles', () => {
  it('limits login to 5 per 60s and refresh to 10 per 60s', () => {
    expect(routeBlock('login')).toContain('@UseGuards(ThrottlerGuard)');
    expect(routeBlock('login')).toContain('@Throttle({ short: { limit: 5, ttl: 60_000 } })');
    expect(routeBlock('refresh')).toContain('@UseGuards(ThrottlerGuard)');
    expect(routeBlock('refresh')).toContain('@Throttle({ short: { limit: 10, ttl: 60_000 } })');
    expect(routeBlock('otp/request')).toContain('@Throttle({ short: { limit: 3, ttl: 900_000 } })');
    expect(routeBlock('otp/send')).toContain('@Throttle({ short: { limit: 3, ttl: 900_000 } })');
  });

  it.each([
    ['login', 5],
    ['refresh', 10],
  ] as const)('returns 429 after the %s threshold', async (handlerName, limit) => {
    const storage = new ThrottlerStorageService();
    const guard = new ThrottlerGuard(
      [{ name: 'short', ttl: 60_000, limit: 100 }],
      storage,
      new Reflector(),
    );
    await guard.onModuleInit();

    const handler = AuthThrottleProbe.prototype[handlerName];
    const context = {
      getHandler: () => handler,
      getClass: () => AuthThrottleProbe,
      switchToHttp: () => ({
        getRequest: () => ({ ip: '203.0.113.10', headers: {} }),
        getResponse: () => ({ header() {} }),
      }),
    };

    for (let i = 0; i < limit; i += 1) {
      await expect(guard.canActivate(context as never)).resolves.toBe(true);
    }

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(ThrottlerException);
    try {
      await guard.canActivate(context as never);
    } catch (error) {
      const throttled = error as ThrottlerException;
      expect(throttled.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(toUserFacingFaMessage(throttled.message, throttled.getStatus())).toBe(
        'تعداد درخواست‌ها بیش از حد مجاز است.',
      );
    }
  });
});
