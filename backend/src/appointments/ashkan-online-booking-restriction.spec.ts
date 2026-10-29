import { BadRequestException } from '@nestjs/common';
import {
  ASHKAN_ONLINE_BOOKING_BLOCK_FA,
  ONLINE_BOOKING_RESTRICTED_EMPLOYEE_IDS_ENV,
  addGregorianYmdDays,
  ashkanBlockedGregorianYmds,
  assertAshkanOnlineBookingAllowed,
  isAshkanBarber,
  isDeskStaffActor,
  isGregorianYmdInAshkanOnlineBlockWindow,
  isScheduledAtInAshkanOnlineBlockWindow,
  nameLooksLikeAshkan,
  shouldEnforceAshkanOnlineRestriction,
} from './ashkan-online-booking-restriction';
import { getTehranGregorianYmd } from '../common/utils/tehran-business-day';

describe('ashkan-online-booking-restriction', () => {
  const prevEnv = process.env[ONLINE_BOOKING_RESTRICTED_EMPLOYEE_IDS_ENV];

  afterEach(() => {
    if (prevEnv === undefined) {
      delete process.env[ONLINE_BOOKING_RESTRICTED_EMPLOYEE_IDS_ENV];
    } else {
      process.env[ONLINE_BOOKING_RESTRICTED_EMPLOYEE_IDS_ENV] = prevEnv;
    }
  });

  describe('staff bypass', () => {
    it('ADMIN and EMPLOYEE never enforce; CUSTOMER and anonymous do', () => {
      expect(isDeskStaffActor({ role: 'ADMIN' })).toBe(true);
      expect(isDeskStaffActor({ role: 'EMPLOYEE' })).toBe(true);
      expect(isDeskStaffActor({ role: 'CUSTOMER' })).toBe(false);
      expect(isDeskStaffActor(undefined)).toBe(false);
      expect(shouldEnforceAshkanOnlineRestriction({ role: 'ADMIN' })).toBe(
        false,
      );
      expect(shouldEnforceAshkanOnlineRestriction({ role: 'EMPLOYEE' })).toBe(
        false,
      );
      expect(shouldEnforceAshkanOnlineRestriction({ role: 'CUSTOMER' })).toBe(
        true,
      );
      expect(shouldEnforceAshkanOnlineRestriction(null)).toBe(true);
    });
  });

  describe('identity: env primary, name fallback', () => {
    it('prefers env ids over name (production path)', () => {
      // Env lists only id 3 — name "اشکان" on another id must NOT match
      expect(
        isAshkanBarber({ id: 99, name: 'اشکان جعلی' }, '3'),
      ).toBe(false);
      expect(
        isAshkanBarber({ id: 3, name: 'سامان' }, '3'),
      ).toBe(true);
      expect(
        isAshkanBarber({ id: 3, name: 'اشکان اشتیش' }, '3'),
      ).toBe(true);
      // string id must match after Number()
      expect(isAshkanBarber({ id: '3' as any, name: 'x' }, '3')).toBe(true);
    });

    it('falls back to first-token name match only when env unset', () => {
      expect(isAshkanBarber({ id: 3, name: 'اشکان اشتیش' }, undefined)).toBe(
        true,
      );
      expect(isAshkanBarber({ id: 9, name: 'Ashkan ashtish' }, '')).toBe(true);
      expect(isAshkanBarber({ id: 1, name: 'سامان' }, undefined)).toBe(false);
    });

    it('name fallback does not match mid-string collision', () => {
      expect(nameLooksLikeAshkan('استاداشکان')).toBe(false);
      expect(nameLooksLikeAshkan('اشکان اشتیش')).toBe(true);
    });
  });

  describe('Tehran D+0 / D+1 / D+2 window (excludes D+3)', () => {
    it('blocks today, tomorrow, and day-after for a fixed Tehran afternoon', () => {
      // 2026-10-22 20:00 UTC = 2026-10-22 23:30 Tehran → today D+0 = 2026-10-22
      const now = new Date('2026-10-22T20:00:00.000Z');
      expect(getTehranGregorianYmd(now)).toBe('2026-10-22');

      const blocked = ashkanBlockedGregorianYmds(now);
      expect([...blocked].sort()).toEqual([
        '2026-10-22',
        '2026-10-23',
        '2026-10-24',
      ]);
      expect(blocked.has('2026-10-22')).toBe(true); // D+0
      expect(blocked.has('2026-10-25')).toBe(false); // D+3

      expect(isGregorianYmdInAshkanOnlineBlockWindow('2026-10-22', now)).toBe(
        true,
      );
      expect(isGregorianYmdInAshkanOnlineBlockWindow('2026-10-23', now)).toBe(
        true,
      );
      expect(isGregorianYmdInAshkanOnlineBlockWindow('2026-10-24', now)).toBe(
        true,
      );
      expect(isGregorianYmdInAshkanOnlineBlockWindow('2026-10-25', now)).toBe(
        false,
      );
    });

    it('blocks today (D+0) near end of Tehran day', () => {
      // Last ms of Tehran 2026-10-22: 2026-10-22T20:29:59.999Z
      const now = new Date('2026-10-22T20:29:59.999Z');
      expect(getTehranGregorianYmd(now)).toBe('2026-10-22');

      const sameDayAppt = new Date('2026-10-22T20:29:59.999Z');
      expect(isScheduledAtInAshkanOnlineBlockWindow(sameDayAppt, now)).toBe(
        true,
      );
      expect(
        isGregorianYmdInAshkanOnlineBlockWindow('2026-10-22', now),
      ).toBe(true);
    });

    it('at Tehran 23:59 still uses that calendar day as D+0', () => {
      // 2026-10-22 23:59 Tehran = 2026-10-22T20:29:00.000Z
      const now = new Date('2026-10-22T20:29:00.000Z');
      expect(getTehranGregorianYmd(now)).toBe('2026-10-22');
      expect([...ashkanBlockedGregorianYmds(now)].sort()).toEqual([
        '2026-10-22',
        '2026-10-23',
        '2026-10-24',
      ]);
    });

    it('at Tehran 00:01 next day shifts the D+0..D+2 window', () => {
      // 2026-10-23 00:01 Tehran = 2026-10-22T20:31:00.000Z
      const now = new Date('2026-10-22T20:31:00.000Z');
      expect(getTehranGregorianYmd(now)).toBe('2026-10-23');
      expect([...ashkanBlockedGregorianYmds(now)].sort()).toEqual([
        '2026-10-23',
        '2026-10-24',
        '2026-10-25',
      ]);
      expect(ashkanBlockedGregorianYmds(now).has('2026-10-22')).toBe(false);
    });

    it('rolls blocked days at Tehran midnight (20:30Z previous UTC day)', () => {
      // First ms of Tehran 2026-10-23: 2026-10-22T20:30:00.000Z
      const now = new Date('2026-10-22T20:30:00.000Z');
      expect(getTehranGregorianYmd(now)).toBe('2026-10-23');

      const blocked = ashkanBlockedGregorianYmds(now);
      expect([...blocked].sort()).toEqual([
        '2026-10-23',
        '2026-10-24',
        '2026-10-25',
      ]);
      // New "today" (D+0) must be blocked
      expect(blocked.has('2026-10-23')).toBe(true);
      // Previous calendar day drops out
      expect(blocked.has('2026-10-22')).toBe(false);

      const apptOnNewToday = new Date('2026-10-22T20:30:00.000Z');
      expect(
        isScheduledAtInAshkanOnlineBlockWindow(apptOnNewToday, now),
      ).toBe(true);

      // First ms of D+1 (Tehran 2026-10-24 midnight)
      const apptOnD1 = new Date('2026-10-23T20:30:00.000Z');
      expect(getTehranGregorianYmd(apptOnD1)).toBe('2026-10-24');
      expect(isScheduledAtInAshkanOnlineBlockWindow(apptOnD1, now)).toBe(true);

      // D+3 relative to new today = 2026-10-26
      const apptOnD3 = new Date('2026-10-25T20:30:00.000Z');
      expect(getTehranGregorianYmd(apptOnD3)).toBe('2026-10-26');
      expect(isScheduledAtInAshkanOnlineBlockWindow(apptOnD3, now)).toBe(false);
    });

    it('addGregorianYmdDays rolls month boundaries', () => {
      expect(addGregorianYmdDays('2026-10-31', 0)).toBe('2026-10-31');
      expect(addGregorianYmdDays('2026-10-31', 1)).toBe('2026-11-01');
      expect(addGregorianYmdDays('2026-10-31', 2)).toBe('2026-11-02');
    });
  });

  describe('assertAshkanOnlineBookingAllowed', () => {
    it('throws exact Persian 400 for env id=3 on D+0 and D+2', () => {
      const now = new Date('2026-10-22T20:00:00.000Z');
      const todayAppt = new Date('2026-10-22T16:00:00.000Z'); // Tehran Oct 22
      const onDayAfter = new Date('2026-10-23T20:30:00.000Z'); // Tehran 2026-10-24

      for (const scheduledAt of [todayAppt, onDayAfter]) {
        try {
          assertAshkanOnlineBookingAllowed(
            { id: 3, name: 'سامان' },
            scheduledAt,
            now,
            '3',
          );
          throw new Error('expected rejection');
        } catch (err) {
          expect(err).toBeInstanceOf(BadRequestException);
          expect((err as BadRequestException).message).toBe(
            ASHKAN_ONLINE_BOOKING_BLOCK_FA,
          );
          expect((err as BadRequestException).getStatus()).toBe(400);
        }
      }
    });

    it('allows other barbers always and Ashkan on D+3 only', () => {
      const now = new Date('2026-10-22T20:00:00.000Z');
      const todayAppt = new Date('2026-10-22T16:00:00.000Z'); // still Tehran Oct 22
      const d3Appt = new Date('2026-10-24T20:30:00.000Z'); // Tehran Oct 25

      expect(() =>
        assertAshkanOnlineBookingAllowed(
          { id: 1, name: 'سامان' },
          todayAppt,
          now,
          '3',
        ),
      ).not.toThrow();

      expect(() =>
        assertAshkanOnlineBookingAllowed(
          { id: 3, name: 'اشکان اشتیش' },
          todayAppt,
          now,
          '3',
        ),
      ).toThrow(BadRequestException);

      expect(() =>
        assertAshkanOnlineBookingAllowed(
          { id: 3, name: 'اشکان اشتیش' },
          d3Appt,
          now,
          '3',
        ),
      ).not.toThrow();
    });
  });
});
