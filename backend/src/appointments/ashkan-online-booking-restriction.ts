import { BadRequestException, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { getTehranGregorianYmd } from '../common/utils/tehran-business-day';

/** Online (non-staff) bookings for Ashkan: block today + next 2 Tehran calendar days. */
export const ASHKAN_ONLINE_BOOKING_BLOCK_FA =
  'امکان رزرو آنلاین برای این آرایشگر از امروز تا ۲ روز آینده وجود ندارد. لطفاً با سالن تماس بگیرید یا روزهای دیگر را انتخاب کنید';

/** Production primary key — set to `3` for Ashkan (اشکان اشتیش). */
export const ONLINE_BOOKING_RESTRICTED_EMPLOYEE_IDS_ENV =
  'ONLINE_BOOKING_RESTRICTED_EMPLOYEE_IDS';

const logger = new Logger('AshkanRestriction');

/**
 * Nest ConfigModule validate() whitelists schema keys and this process often does
 * NOT expose custom .env keys on `process.env`. Read process.env first, then
 * fall back to `.env` / `.env.production` on cwd (PM2 backend cwd).
 */
export function resolveOnlineBookingRestrictedEmployeeIdsRaw(
  explicit?: string | null,
): string | undefined {
  // Caller passed a value (including '' / null) → honor it; do not read disk.
  if (explicit !== undefined) {
    if (explicit == null) return undefined;
    const trimmed = String(explicit).trim();
    return trimmed || undefined;
  }
  const fromProcess = process.env[ONLINE_BOOKING_RESTRICTED_EMPLOYEE_IDS_ENV];
  if (fromProcess != null && String(fromProcess).trim() !== '') {
    return String(fromProcess).trim();
  }
  for (const file of [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '.env.production'),
  ]) {
    try {
      if (!existsSync(file)) continue;
      const text = readFileSync(file, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const m = trimmed.match(
          new RegExp(`^${ONLINE_BOOKING_RESTRICTED_EMPLOYEE_IDS_ENV}\\s*=\\s*(.*)$`),
        );
        if (!m) continue;
        let v = m[1].trim();
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        if (v) return v;
      }
    } catch {
      // ignore unreadable env files
    }
  }
  return undefined;
}

/**
 * Parse comma-separated employee ids.
 * When a non-empty id list is resolved, name matching is skipped entirely.
 */
export function parseRestrictedEmployeeIdsFromEnv(
  envValue?: string | null,
): Set<number> | null {
  const raw = resolveOnlineBookingRestrictedEmployeeIdsRaw(envValue);
  if (raw == null || !String(raw).trim()) return null;
  const ids = String(raw)
    .split(',')
    .map((part) => Number(String(part).trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return ids.length > 0 ? new Set(ids) : null;
}

/** Dev fallback only: first-token match (اشکان / Ashkan). Not used when env ids are set. */
export function nameLooksLikeAshkan(name?: string | null): boolean {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  return /^(اشکان|ashkan)$/i.test(first);
}

/**
 * Desk staff must never be blocked (ADMIN / EMPLOYEE).
 * CUSTOMER and anonymous/public callers are subject to the restriction.
 */
export function isDeskStaffActor(user?: { role?: string } | null): boolean {
  const role = user?.role;
  return role === 'ADMIN' || role === 'EMPLOYEE';
}

export function shouldEnforceAshkanOnlineRestriction(
  user?: { role?: string } | null,
): boolean {
  return !isDeskStaffActor(user);
}

/**
 * Restricted barber for online booking window.
 * - Production: env ids from process.env or .env file (e.g. `=3`).
 * - Dev fallback: first-token name match only when env is unset/empty.
 */
export function isAshkanBarber(
  employee: { id: number | string; name?: string | null },
  envValue?: string | null,
): boolean {
  const id = Number(employee.id);
  const fromEnv = parseRestrictedEmployeeIdsFromEnv(envValue);
  if (fromEnv) return Number.isInteger(id) && fromEnv.has(id);
  return nameLooksLikeAshkan(employee.name);
}

/**
 * Add civil Gregorian days to a YYYY-MM-DD calendar label.
 * Operates on the date parts themselves (not server-local TZ).
 */
export function addGregorianYmdDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const gy = d.getUTCFullYear();
  const gm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const gd = String(d.getUTCDate()).padStart(2, '0');
  return `${gy}-${gm}-${gd}`;
}

/**
 * Blocked Tehran calendar days: D+0, D+1, and D+2 inclusive.
 * "Today" is derived via Asia/Tehran (`getTehranGregorianYmd`), independent of process TZ.
 */
export function ashkanBlockedGregorianYmds(now = new Date()): Set<string> {
  const todayTehran = getTehranGregorianYmd(now);
  return new Set([
    addGregorianYmdDays(todayTehran, 0),
    addGregorianYmdDays(todayTehran, 1),
    addGregorianYmdDays(todayTehran, 2),
  ]);
}

export function isGregorianYmdInAshkanOnlineBlockWindow(
  gregorianYmd: string,
  now = new Date(),
): boolean {
  return ashkanBlockedGregorianYmds(now).has(gregorianYmd);
}

export function isScheduledAtInAshkanOnlineBlockWindow(
  scheduledAt: Date,
  now = new Date(),
): boolean {
  return isGregorianYmdInAshkanOnlineBlockWindow(
    getTehranGregorianYmd(scheduledAt),
    now,
  );
}

export type AshkanRestrictionLogCtx = {
  userId?: number | string | null;
  role?: string | null;
  staffId?: number | string | null;
  requestedDate?: string | null;
  isBlocked?: boolean;
  reason?: string;
};

/** Temporary diagnostic — remove after production verification. */
export function logAshkanRestriction(ctx: AshkanRestrictionLogCtx): void {
  logger.log(
    `[AshkanRestriction] userId=${ctx.userId ?? 'n/a'} role=${ctx.role ?? 'n/a'} staffId=${ctx.staffId ?? 'n/a'} requestedDate=${ctx.requestedDate ?? 'n/a'} isBlocked=${ctx.isBlocked === true} reason=${ctx.reason ?? ''}`,
  );
}

/**
 * Rejects online/public booking onto a restricted barber for Tehran D+0..D+2.
 * Call only when `shouldEnforceAshkanOnlineRestriction(user)` is true.
 */
export function assertAshkanOnlineBookingAllowed(
  employee: { id: number | string; name?: string | null },
  scheduledAt: Date,
  now = new Date(),
  envValue?: string | null,
  logCtx?: Omit<AshkanRestrictionLogCtx, 'isBlocked' | 'requestedDate' | 'staffId'>,
): void {
  const staffId = Number(employee.id);
  const requestedDate = getTehranGregorianYmd(scheduledAt);
  const matched = isAshkanBarber(employee, envValue);
  const inWindow = isScheduledAtInAshkanOnlineBlockWindow(scheduledAt, now);
  const isBlocked = matched && inWindow;

  logAshkanRestriction({
    ...logCtx,
    staffId,
    requestedDate,
    isBlocked,
    reason: !matched
      ? 'not_restricted_employee'
      : !inWindow
        ? 'outside_d0_d2_window'
        : 'block_d0_d2',
  });

  if (!isBlocked) return;
  throw new BadRequestException(ASHKAN_ONLINE_BOOKING_BLOCK_FA);
}
