import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { buildMultiBarberCreateBody } from '../../../frontend/src/lib/booking-selections';

/** Same options as the global pipe in main.ts. */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const validate = (metatype: any, body: unknown) =>
  pipe.transform(body, { type: 'body', metatype, data: '' });

describe('frontend booking payloads vs CreateAppointmentDto (global ValidationPipe)', () => {
  const base = { customerId: 5, jalaliDate: '1405-07-28', clientOpId: 'op-1' };

  it('two barbers: selections[] with an employeeId per service is accepted as-is', async () => {
    const body = buildMultiBarberCreateBody({
      ...base,
      lines: [
        { serviceId: 1, employeeId: 10, durationMin: 30 },
        { serviceId: 2, employeeId: 11, durationMin: 45 },
      ],
      groupStartTimes: { 10: '10:00', 11: '10:00' },
    });
    const dto = await validate(CreateAppointmentDto, body);
    expect(dto.selections).toEqual([
      expect.objectContaining({ serviceId: 1, employeeId: 10, time: '10:00' }),
      expect.objectContaining({ serviceId: 2, employeeId: 11, time: '10:00' }),
    ]);
    expect(dto.services).toBeUndefined();
    expect(dto.clientOpId).toBe('op-1');
  });

  it('same barber for every service: legacy body (employeeId + services[]) is accepted', async () => {
    const body = buildMultiBarberCreateBody({
      ...base,
      lines: [
        { serviceId: 1, employeeId: 10, durationMin: 30 },
        { serviceId: 2, employeeId: 10, durationMin: 45 },
      ],
      groupStartTimes: { 10: '11:30' },
    });
    expect(body).not.toHaveProperty('selections');
    const dto = await validate(CreateAppointmentDto, body);
    expect(dto.employeeId).toBe(10);
    expect(dto.services.map((s) => s.serviceId)).toEqual([1, 2]);
    expect(dto.time).toBe('11:30');
  });

  it('rejects unknown keys (forbidNonWhitelisted) so the builder cannot drift silently', async () => {
    await expect(
      validate(CreateAppointmentDto, { ...base, employeeId: 1, services: [{ serviceId: 1 }], bogus: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});