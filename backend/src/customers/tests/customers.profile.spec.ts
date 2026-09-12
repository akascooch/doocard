import { CustomersService } from '../customers.service'
import { NotFoundException } from '@nestjs/common'

describe('CustomersService.getMyProfile', () => {
  const prisma = {
    customer: {
      findFirst: jest.fn(),
    },
    employee: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  }

  const sms = { handleNewCustomer: jest.fn().mockResolvedValue(undefined) }
  let service: CustomersService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CustomersService(prisma as any, sms as any)
  })

  it('Case 1: returns preferred employee when preferredEmployeeId exists', async () => {
    prisma.customer.findFirst.mockResolvedValue({
      id: 1,
      userId: 11,
      notes: null,
      birthdate: null,
      user: { id: 11, name: 'علی', phone: '0912', email: 'a@a.com' },
      preferredEmployee: { id: 5, specialty: 'کوتاهی مو', user: { id: 22, name: 'مهدی' } },
    } as any)

    const profile = await service.getMyProfile(11)
    expect(profile.preferredEmployee).toEqual({
      id: 5,
      name: 'مهدی',
      specialty: 'کوتاهی مو',
      avatarUrl: null,
    })
  })

  it('Case 2: no preferredEmployeeId -> returns default employee if exists', async () => {
    prisma.customer.findFirst.mockResolvedValue({
      id: 2,
      userId: 12,
      notes: null,
      birthdate: null,
      user: { id: 12, name: 'سارا', phone: '0913', email: 's@s.com' },
      preferredEmployee: null,
    } as any)
    prisma.employee.findFirst.mockResolvedValue({
      id: 7,
      isDefault: true,
      isActive: true,
      specialty: 'رنگ و لایت',
      user: { id: 33, name: 'نازنین' },
    } as any)

    const profile = await service.getMyProfile(12)
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: { isDefault: true, isActive: true },
      include: { user: true },
    })
    expect(profile.preferredEmployee).toEqual({
      id: 7,
      name: 'نازنین',
      specialty: 'رنگ و لایت',
      avatarUrl: null,
    })
  })

  it('Case 3: no preferredEmployeeId and no default -> returns null', async () => {
    prisma.customer.findFirst.mockResolvedValue({
      id: 3,
      userId: 13,
      notes: null,
      birthdate: null,
      user: { id: 13, name: 'لیلا', phone: '0914', email: 'l@l.com' },
      preferredEmployee: null,
    } as any)
    prisma.employee.findFirst.mockResolvedValue(null as any)

    const profile = await service.getMyProfile(13)
    expect(profile.preferredEmployee).toBeNull()
  })

  it('throws NotFound when customer missing', async () => {
    prisma.customer.findFirst.mockResolvedValue(null as any)
    await expect(service.getMyProfile(999)).rejects.toBeInstanceOf(NotFoundException)
  })
})
