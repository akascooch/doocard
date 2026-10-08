import { ConflictException } from '@nestjs/common';
import { AllExceptionsFilter, resolveCorrelationId } from './all-exceptions.filter';

describe('resolveCorrelationId', () => {
  it('prefers middleware req.correlationId over headers', () => {
    const id = resolveCorrelationId({
      correlationId: 'mw-1',
      headers: { 'x-correlation-id': 'hdr-c', 'x-request-id': 'hdr-r' },
    } as never);
    expect(id).toBe('mw-1');
  });

  it('falls back to x-correlation-id then x-request-id', () => {
    expect(
      resolveCorrelationId({
        headers: { 'x-correlation-id': 'hdr-c', 'x-request-id': 'hdr-r' },
      } as never),
    ).toBe('hdr-c');
    expect(
      resolveCorrelationId({
        headers: { 'x-request-id': 'hdr-r' },
      } as never),
    ).toBe('hdr-r');
  });

  it('forwards phoneExists on a duplicate-phone conflict and drops customer identity', () => {
    const filter = new AllExceptionsFilter();
    const json = jest.fn();
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ headersSent: false, status: () => ({ json }) }),
        getRequest: () => ({
          url: '/api/customers/quick',
          method: 'POST',
          headers: {},
          user: { id: 1 },
        }),
      }),
    };
    filter.catch(
      new ConflictException({
        phoneExists: true,
        message: 'این شماره قبلاً ثبت شده است',
        id: 99,
        notes: 'secret-note',
      }),
      host as never,
    );
    const body = json.mock.calls[0][0];
    expect(body.status).toBe(409);
    expect(body.phoneExists).toBe(true);
    expect(body.message_fa).toBe('این شماره قبلاً ثبت شده است');
    expect(body.id).toBeUndefined();
    expect(body).not.toHaveProperty('notes');
    expect(JSON.stringify(body)).not.toContain('secret-note');
  });

  it('always returns a non-empty id', () => {
    const id = resolveCorrelationId({ headers: {} } as never);
    expect(id.length).toBeGreaterThan(4);
  });
});
