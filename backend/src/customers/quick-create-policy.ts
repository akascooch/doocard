/**
 * SERVICE quick-create stays available unless this env is exactly "false".
 * Unset preserves the existing production behavior.
 */
export function isServiceQuickCreateAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.QUICK_CREATE_ALLOW_SERVICE !== 'false';
}
