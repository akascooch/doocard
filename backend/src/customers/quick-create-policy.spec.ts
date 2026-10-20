import { isServiceQuickCreateAllowed } from './quick-create-policy';

describe('isServiceQuickCreateAllowed', () => {
  it('allows SERVICE when the flag is unset', () => {
    expect(isServiceQuickCreateAllowed({} as NodeJS.ProcessEnv)).toBe(true);
  });

  it('allows SERVICE when the flag is true', () => {
    expect(
      isServiceQuickCreateAllowed({ QUICK_CREATE_ALLOW_SERVICE: 'true' } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it('hides SERVICE only when the flag is exactly false', () => {
    expect(
      isServiceQuickCreateAllowed({ QUICK_CREATE_ALLOW_SERVICE: 'false' } as NodeJS.ProcessEnv),
    ).toBe(false);
  });
});
