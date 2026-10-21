/**
 * Jest 29 (circus) fails the running test when a promise rejection goes unhandled.
 * Fire-and-forget work can outlive its test, so this flushes pending work in afterEach
 * and any late rejection is attributed to the test that started it.
 */
export function flushFireAndForgetAfterEach(): void {
  afterEach(async () => {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  });
}
