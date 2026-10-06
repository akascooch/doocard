import {
  bookingDurationMinFromService,
  bookingPriceRialFromServicePrice,
} from './booking-price.util';

describe('booking price helpers', () => {
  it('converts toman service price to rial with the desk formula', () => {
    expect(bookingPriceRialFromServicePrice(50000)).toBe(500000);
    expect(bookingPriceRialFromServicePrice(10.5)).toBe(105);
    expect(bookingPriceRialFromServicePrice(0)).toBe(0);
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
