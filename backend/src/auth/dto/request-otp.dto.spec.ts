import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestOtpDto } from './request-otp.dto';

describe('RequestOtpDto', () => {
  async function parse(input: Record<string, unknown>) {
    const dto = plainToInstance(RequestOtpDto, input);
    const errors = await validate(dto);
    return { dto, errors };
  }

  it('accepts BOOKING and canonicalizes +98 / 0098 / 98 phones', async () => {
    for (const phone of ['09120000000', '+989120000000', '989120000000', '00989120000000']) {
      const { dto, errors } = await parse({ phone, purpose: 'BOOKING' });
      expect(errors).toHaveLength(0);
      expect(dto.phone).toBe('09120000000');
      expect(dto.purpose).toBe('BOOKING');
    }
  });

  it('rejects invalid phones and unknown purposes', async () => {
    const badPhone = await parse({ phone: '9120000000', purpose: 'BOOKING' });
    expect(badPhone.errors.length).toBeGreaterThan(0);

    const badPurpose = await parse({ phone: '09120000000', purpose: 'HACK' });
    expect(badPurpose.errors.some((err) => err.property === 'purpose')).toBe(true);
  });
});
