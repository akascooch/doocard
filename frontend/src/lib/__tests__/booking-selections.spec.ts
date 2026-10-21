import {
  addMinutesToClock,
  buildAppointmentCreateBody,
  buildMultiBarberCreateBody,
  groupLinesByBarber,
  groupSpanMin,
} from '../booking-selections'

describe('buildAppointmentCreateBody (legacy /new page)', () => {
  it('keeps the legacy single-appointment body without extras', () => {
    expect(
      buildAppointmentCreateBody({
        customerId: 1,
        employeeId: 2,
        serviceId: 3,
        durationMin: 30,
        jalaliDate: '1405-01-10',
        time: '11:00',
      }),
    ).toEqual({
      customerId: 1,
      employeeId: 2,
      services: [{ serviceId: 3, durationMin: 30 }],
      jalaliDate: '1405-01-10',
      time: '11:00',
    })
  })

  it('produces selections[] when extra lines are present', () => {
    const body = buildAppointmentCreateBody({
      customerId: 1,
      employeeId: 2,
      serviceId: 3,
      jalaliDate: '1405-01-10',
      time: '11:00',
      clientOpId: 'op-1',
      extras: [{ serviceId: '4', employeeId: '5' }],
    })
    expect(body).toEqual({
      customerId: 1,
      jalaliDate: '1405-01-10',
      time: '11:00',
      clientOpId: 'op-1',
      selections: [
        { serviceId: 3, employeeId: 2 },
        { serviceId: 4, employeeId: 5 },
      ],
    })
  })
})

describe('buildMultiBarberCreateBody (admin form)', () => {
  const base = { customerId: 9, jalaliDate: '1405-01-10', clientOpId: 'op-x', notes: 'n' }

  it('sends selections[] with one appointment per service when barbers differ', () => {
    const body = buildMultiBarberCreateBody({
      ...base,
      lines: [
        { serviceId: 1, employeeId: 10, durationMin: 30 },
        { serviceId: 2, employeeId: 20, durationMin: 60 },
      ],
      groupStartTimes: { 10: '11:00', 20: '11:00' },
    })
    expect(body).toEqual({
      customerId: 9,
      jalaliDate: '1405-01-10',
      time: '11:00',
      notes: 'n',
      clientOpId: 'op-x',
      selections: [
        { serviceId: 1, employeeId: 10, time: '11:00' },
        { serviceId: 2, employeeId: 20, time: '11:00' },
      ],
    })
  })

  it('chains one barber’s services back-to-back on the 30-minute grid', () => {
    const body = buildMultiBarberCreateBody({
      ...base,
      lines: [
        { serviceId: 1, employeeId: 10, durationMin: 45 },
        { serviceId: 2, employeeId: 20, durationMin: 30 },
        { serviceId: 3, employeeId: 10, durationMin: 30 },
      ],
      groupStartTimes: { 10: '11:00', 20: '12:30' },
    }) as { selections: Array<{ serviceId: number; time: string }> }
    expect(body.selections).toEqual([
      { serviceId: 1, employeeId: 10, time: '11:00' },
      { serviceId: 3, employeeId: 10, time: '12:00' },
      { serviceId: 2, employeeId: 20, time: '12:30' },
    ])
  })

  it('keeps the legacy body when every service has the same barber', () => {
    expect(
      buildMultiBarberCreateBody({
        ...base,
        lines: [
          { serviceId: 1, employeeId: 10, durationMin: 30 },
          { serviceId: 2, employeeId: 10, durationMin: 30 },
        ],
        groupStartTimes: { 10: '11:00' },
      }),
    ).toEqual({
      customerId: 9,
      employeeId: 10,
      services: [
        { serviceId: 1, durationMin: 30 },
        { serviceId: 2, durationMin: 30 },
      ],
      jalaliDate: '1405-01-10',
      time: '11:00',
      notes: 'n',
    })
  })

  it('refuses a barber without a start time', () => {
    expect(() =>
      buildMultiBarberCreateBody({
        ...base,
        lines: [
          { serviceId: 1, employeeId: 10, durationMin: 30 },
          { serviceId: 2, employeeId: 20, durationMin: 30 },
        ],
        groupStartTimes: { 10: '11:00' },
      }),
    ).toThrow()
  })

  it('reports the occupied span per barber and clock arithmetic bounds', () => {
    const [group] = groupLinesByBarber([
      { serviceId: 1, employeeId: 10, durationMin: 45 },
      { serviceId: 2, employeeId: 10, durationMin: 30 },
    ])
    expect(groupSpanMin(group)).toBe(90)
    expect(addMinutesToClock('23:30', 30)).toBeNull()
    expect(addMinutesToClock('09:30', 90)).toBe('11:00')
  })
})
