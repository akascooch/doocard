import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('user record ownership', () => {
  const usersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    changePassword: jest.fn(),
  };
  const prisma = {};
  let controller: UsersController;

  beforeEach(() => {
    jest.clearAllMocks();
    usersService.findAll.mockResolvedValue([]);
    usersService.findOne.mockResolvedValue({ id: 10 });
    usersService.update.mockResolvedValue({ id: 10 });
    usersService.changePassword.mockResolvedValue(undefined);
    controller = new UsersController(usersService as never, prisma as never);
  });

  it('rejects a customer reading another user id', async () => {
    await expect(
      controller.findOne(20, { user: { id: 10, role: 'CUSTOMER' } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(usersService.findOne).not.toHaveBeenCalled();
  });

  it('rejects a customer updating another user id', async () => {
    await expect(
      controller.update(20, { name: 'x' } as never, { user: { id: 10, role: 'CUSTOMER' } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(usersService.update).not.toHaveBeenCalled();
  });

  it('rejects a customer changing another user password', async () => {
    await expect(
      controller.changePassword(20, { password: 'new-password' }, { user: { id: 10, role: 'CUSTOMER' } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(usersService.changePassword).not.toHaveBeenCalled();
  });

  it('lets a customer read their own user id', async () => {
    await controller.findOne(10, { user: { id: 10, role: 'CUSTOMER' } });
    expect(usersService.findOne).toHaveBeenCalledWith(10, { id: 10, role: 'CUSTOMER' });
  });

  it('rejects a customer listing users', async () => {
    await expect(
      controller.findAll({ user: { id: 10, role: 'CUSTOMER' } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(usersService.findAll).not.toHaveBeenCalled();
  });

  it('lets an admin read another user id', async () => {
    await controller.findOne(20, { user: { id: 1, role: 'ADMIN' } });
    expect(usersService.findOne).toHaveBeenCalledWith(20, { id: 1, role: 'ADMIN' });
  });

  it('lets a customer change only their own password', async () => {
    await controller.changePassword(
      10,
      { password: 'fixture-password-1' },
      { user: { id: 10, role: 'CUSTOMER' } },
    );
    expect(usersService.changePassword).toHaveBeenCalledWith(
      10,
      'fixture-password-1',
      { id: 10, role: 'CUSTOMER' },
    );
  });

  it('rejects a customer sync that supplies another userId', async () => {
    await expect(
      controller.syncUserRole(
        { userId: 20, role: 'ADMIN' },
        { user: { id: 10, role: 'CUSTOMER' } },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(usersService.findOne).not.toHaveBeenCalled();
  });
});

describe('UsersService authorization', () => {
  const prisma = {
    user: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  };
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma as never, {} as never);
  });

  it('rejects a customer role change even on their own id', async () => {
    await expect(
      service.update(10, { role: 'ADMIN' } as never, { id: 10, role: 'CUSTOMER' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('lets an admin update another user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 20,
      phone: '09121111111',
      password: 'hashed',
      role: 'CUSTOMER',
      email: null,
    });
    prisma.user.update.mockResolvedValue({
      id: 20,
      name: 'Staff Edit',
      phone: '09121111111',
      password: 'hashed',
      role: 'CUSTOMER',
    });

    await service.update(20, { name: 'Staff Edit' } as never, { id: 1, role: 'ADMIN' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 20 } }),
    );
  });

  it('returns 404 when an admin asks for a missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findOne(404, { id: 1, role: 'ADMIN' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
