import { resolveCorrelationId } from './all-exceptions.filter';

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

  it('always returns a non-empty id', () => {
    const id = resolveCorrelationId({ headers: {} } as never);
    expect(id.length).toBeGreaterThan(4);
  });
});
