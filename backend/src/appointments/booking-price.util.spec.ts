import {
  bookingDurationMinFromService,
  bookingPriceRialFromServicePrice,
} from './booking-price.util';

describe('booking price helpers', () => {
  it('keeps the canonical rial service price, including a 3,000,000 toman service', () => {
    expect(bookingPriceRialFromServicePrice(50000)).toBe(50000);
    expect(bookingPriceRialFromServicePrice(10.5)).toBe(10);
    expect(bookingPriceRialFromServicePrice(0)).toBe(0);
    // 3,000,000 toman is stored as 30,000,000 rial. A second ×10 would show 30,000,000 toman.
    expect(bookingPriceRialFromServicePrice(30_000_000)).toBe(30_000_000);
  });

  it('rejects invalid price and duration', () => {
    expect(bookingPriceRialFromServicePrice(-1)).toBeNull();
    expect(bookingPriceRialFromServicePrice(Number.NaN)).toBeNull();
    expect(bookingDurationMinFromService(30)).toBe(30);
    expect(bookingDurationMinFromService(0)).toBeNull();
    expect(bookingDurationMinFromService(1.5)).toBeNull();
    expect(bookingDurationMinFromService(-5)).toBeNull();
  });
});
