import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VerifyOtpDto } from './verify-otp.dto';

describe('VerifyOtpDto', () => {
  async function parse(input: Record<string, unknown>) {
    const dto = plainToInstance(VerifyOtpDto, input);
    const errors = await validate(dto);
    return { dto, errors };
  }

  it('accepts a 5-digit code and canonical phone', async () => {
    const { dto, errors } = await parse({
      phone: '+989120000000',
      code: '12345',
      purpose: 'LOGIN',
    });
    expect(errors).toHaveLength(0);
    expect(dto.phone).toBe('09120000000');
    expect(dto.code).toBe('12345');
  });

  it('rejects 4-digit and 6-digit codes', async () => {
    const four = await parse({ phone: '09120000000', code: '1234' });
    expect(four.errors.some((err) => err.property === 'code')).toBe(true);

    const six = await parse({ phone: '09120000000', code: '123456' });
    expect(six.errors.some((err) => err.property === 'code')).toBe(true);
  });
});
