import { ForbiddenException } from '@nestjs/common';
import { UsersController } from './users.controller';

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
    expect(usersService.findOne).toHaveBeenCalledWith(10);
  });

  it('lets an admin read another user id', async () => {
    await controller.findOne(20, { user: { id: 1, role: 'ADMIN' } });
    expect(usersService.findOne).toHaveBeenCalledWith(20);
  });
});
