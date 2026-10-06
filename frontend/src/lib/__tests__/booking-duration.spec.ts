import fs from 'fs';
import path from 'path';
import {
  FALLBACK_BOOKING_DURATION_MIN,
  effectiveServiceDurationMin,
  effectiveServicesDurationMin,
} from '../booking-duration';

describe('effective service duration', () => {
  it('keeps a 30-minute service and does not fall back to 60', () => {
    expect(effectiveServiceDurationMin({ durationMinutes: 30 })).toBe(30);
    expect(effectiveServiceDurationMin({ duration: 30 })).toBe(30);
  });

  it('keeps a 120-minute service', () => {
    expect(effectiveServiceDurationMin({ durationMinutes: 120 })).toBe(120);
  });

  it('falls back only when the selected service has no usable duration', () => {
    expect(effectiveServiceDurationMin({ durationMinutes: 0 })).toBe(
      FALLBACK_BOOKING_DURATION_MIN,
    );
    expect(effectiveServiceDurationMin(null)).toBe(FALLBACK_BOOKING_DURATION_MIN);
  });

  it('sums selected services with the same helper used for slots and submit', () => {
    expect(
      effectiveServicesDurationMin([
        { durationMinutes: 30 },
        { durationMinutes: 90 },
      ]),
    ).toBe(120);
  });
});

describe('booking screens do not hardcode 60 when a service exists', () => {
  const files = [
    'src/app/book-appointment/page.tsx',
    'src/app/dashboard/admin/appointments/new/page.tsx',
    'src/components/booking/BookingModal.tsx',
    'src/components/appointments/AppointmentForm.tsx',
  ];

  it.each(files)('%s uses the shared duration helper', (relativePath) => {
    const source = fs.readFileSync(path.join(__dirname, '../../..', relativePath), 'utf8');
    expect(source).toContain('effectiveServiceDurationMin');
    expect(source).not.toMatch(/durationMin=60|durationMin:\s*60|durationMin=\{60\}/);
  });
});
