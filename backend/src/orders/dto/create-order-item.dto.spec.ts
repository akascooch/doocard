import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateOrderItemDto } from './create-order-item.dto';

async function errorsFor(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateOrderItemDto, plain);
  return validate(dto);
}

describe('CreateOrderItemDto quantity', () => {
  it('accepts a positive integer', async () => {
    expect(await errorsFor({ productId: 1, quantity: 2 })).toHaveLength(0);
  });

  it('rejects zero, negative, and decimal quantities', async () => {
    expect(await errorsFor({ productId: 1, quantity: 0 })).not.toHaveLength(0);
    expect(await errorsFor({ productId: 1, quantity: -3 })).not.toHaveLength(0);
    expect(await errorsFor({ productId: 1, quantity: 1.5 })).not.toHaveLength(0);
  });
});
