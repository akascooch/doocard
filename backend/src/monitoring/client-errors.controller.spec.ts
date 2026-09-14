import { ThrottlerGuard } from '@nestjs/throttler';
import { ClientErrorsController, sanitizeClientErrorText } from './client-errors.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('ClientErrorsController', () => {
  it('is not wrapped in JwtAuthGuard', () => {
    const guards = (Reflect.getMetadata('__guards__', ClientErrorsController) as unknown[]) || [];
    expect(guards).not.toEqual(expect.arrayContaining([JwtAuthGuard]));
  });

  it('throttles POST client-errors', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      ClientErrorsController.prototype.report,
    ) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([ThrottlerGuard]));
  });

  it('redacts bearer tokens and does not throw', () => {
    expect(sanitizeClientErrorText('Authorization: Bearer abc.def.ghi extra', 80)).toContain(
      '[REDACTED]',
    );
    const monitoring = { recordClientError: jest.fn() };
    const controller = new ClientErrorsController(monitoring as never);
    const result = controller.report(
      {
        message: 'Boom Authorization: Bearer secret-token',
        stack: 'password=hunter2',
        url: 'https://example.test/dashboard',
        correlationId: 'fe-1',
      },
      { correlationId: 'mw-2', ip: '127.0.0.1' },
    );
    expect(result.ok).toBe(true);
    expect(result.correlationId).toBe('fe-1');
  });
});
