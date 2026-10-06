import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PUBLIC_REGISTER_ROLE, RegisterDto } from './dto/register.dto';

const customerBody = {
  name: 'مشتری',
  phone: '09120000000',
  password: 'password123',
};

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

async function validateRegister(payload: Record<string, unknown>) {
  const dto = plainToInstance(RegisterDto, payload, {
    enableImplicitConversion: true,
  });
  return validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('public register role lock', () => {
  it('allows a customer body with no role and hardcodes CUSTOMER', async () => {
    const errors = await validateRegister(customerBody);
    expect(errors).toHaveLength(0);
    expect(PUBLIC_REGISTER_ROLE).toBe('CUSTOMER');
  });

  it.each(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'EMPLOYEE', 'SERVICE', 'CUSTOMER'])(
    'rejects client role %s',
    async (role) => {
      const errors = await validateRegister({ ...customerBody, role });
      expect(errors.some((error) => error.property === 'role')).toBe(true);
    },
  );

  it('throttles register the same way as OTP request and leaves login alone', () => {
    const register = routeBlock('register');
    const otp = routeBlock('otp/request');
    expect(register).toContain('@UseGuards(ThrottlerGuard)');
    expect(register).toContain('@Throttle({ short: { limit: 3, ttl: 900_000 } })');
    expect(otp).toContain('@UseGuards(ThrottlerGuard)');
    expect(otp).toContain('@Throttle({ short: { limit: 3, ttl: 900_000 } })');
    expect(routeBlock('login')).not.toContain('ThrottlerGuard');
    expect(routeBlock('refresh')).not.toContain('ThrottlerGuard');
  });
});
