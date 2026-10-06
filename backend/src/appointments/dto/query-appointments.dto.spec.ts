import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AppointmentPaymentMethodEnum,
  QueryAppointmentsDto,
} from './query-appointments.dto';

async function validateQuery(payload: Record<string, unknown>) {
  const dto = plainToInstance(QueryAppointmentsDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors };
}

describe('QueryAppointmentsDto payment method filter', () => {
  it.each(Object.values(AppointmentPaymentMethodEnum))(
    'accepts %s',
    async (paymentMethod) => {
      const { dto, errors } = await validateQuery({ paymentMethod });
      expect(errors).toHaveLength(0);
      expect(dto.paymentMethod).toBe(paymentMethod);
    },
  );

  it('rejects an unknown payment method', async () => {
    const { errors } = await validateQuery({ paymentMethod: 'BITCOIN' });
    expect(errors.some((error) => error.property === 'paymentMethod')).toBe(
      true,
    );
  });

  it('accepts the explicit null filter as a boolean', async () => {
    const { dto, errors } = await validateQuery({ paymentMethodUnset: 'true' });
    expect(errors).toHaveLength(0);
    expect(dto.paymentMethodUnset).toBe('true');
  });

  it('rejects a non-boolean null filter', async () => {
    const { errors } = await validateQuery({ paymentMethodUnset: 'maybe' });
    expect(
      errors.some((error) => error.property === 'paymentMethodUnset'),
    ).toBe(true);
  });
});
