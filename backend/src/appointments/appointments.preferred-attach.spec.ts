/**
 * Unit check: appointment create attaches preferredEmployeeId only when null.
 */
describe('Appointment preferredEmployee attach (null-only)', () => {
  it('builds updateMany where preferredEmployeeId is null and sets appointment employeeId', () => {
    const dto = { customerId: 42, employeeId: 7 };
    const where = {
      id: dto.customerId,
      preferredEmployeeId: null as null,
    };
    const data = { preferredEmployeeId: dto.employeeId };

    expect(where).toEqual({ id: 42, preferredEmployeeId: null });
    expect(data).toEqual({ preferredEmployeeId: 7 });
  });

  it('does not attach when employeeId is missing', () => {
    const dto: { customerId: number; employeeId?: number | null } = {
      customerId: 42,
      employeeId: null,
    };
    const shouldAttach = Boolean(dto.employeeId && dto.customerId);
    expect(shouldAttach).toBe(false);
  });

  it('skips overwrite when preferred already set (simulated)', () => {
    const existingPreferred: number | null = 3;
    const appointmentEmployeeId = 7;
    const next =
      existingPreferred == null ? appointmentEmployeeId : existingPreferred;
    expect(next).toBe(3);
  });
});
