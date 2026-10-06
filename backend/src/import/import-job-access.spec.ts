import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ImportService, IMPORT_JOB_NOT_FOUND_FA } from './import.service';

describe('ImportService job access', () => {
  function build() {
    const prisma = {
      importJob: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    return { prisma, service: new ImportService(prisma as never) };
  }

  it('returns the caller’s own job and strips password material', async () => {
    const { prisma, service } = build();
    const startedAt = new Date('2026-01-02T00:00:00.000Z');
    prisma.importJob.findFirst.mockResolvedValue({
      id: 3,
      userId: 5,
      entity: 'CUSTOMERS',
      filename: 'customers.xlsx',
      batchId: 'batch-1',
      totalRows: 1,
      created: 0,
      updated: 0,
      failed: 0,
      status: 'PENDING',
      metadata: { eligibleRows: [{ phone: '09120000000' }], password: 'must-drop' },
      startedAt,
      finishedAt: null,
      createdAt: startedAt,
    });

    const job = await service.getJobForActor(3, 5);

    expect(prisma.importJob.findFirst).toHaveBeenCalledWith({
      where: { id: 3, userId: 5 },
      select: expect.objectContaining({ id: true, metadata: true }),
    });
    const select = prisma.importJob.findFirst.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('logPath');
    expect(select).not.toHaveProperty('user');
    expect(job.userId).toBe(5);
    expect(job.startedAt).toBe(startedAt);
    expect(job.metadata).not.toHaveProperty('password');
    expect(JSON.stringify(job)).not.toContain('must-drop');
  });

  it('uses one not-found response for a missing job and a foreign job', async () => {
    const { prisma, service } = build();
    prisma.importJob.findFirst.mockResolvedValue(null);

    const missing = service.getJobForActor(3, 5);
    const foreign = service.getJobForActor(3, 8);

    await expect(missing).rejects.toBeInstanceOf(NotFoundException);
    await expect(foreign).rejects.toBeInstanceOf(NotFoundException);
    await expect(missing).rejects.toThrow(IMPORT_JOB_NOT_FOUND_FA);
    await expect(foreign).rejects.toThrow(IMPORT_JOB_NOT_FOUND_FA);
    expect(prisma.importJob.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: 3, userId: 8 } }),
    );
  });

  it('does not query when the actor id is missing', async () => {
    const { prisma, service } = build();

    await expect(service.getJobForActor(3, undefined)).rejects.toThrow(IMPORT_JOB_NOT_FOUND_FA);
    expect(prisma.importJob.findFirst).not.toHaveBeenCalled();
  });

  it('does not grant an ADMIN id visibility into another user’s job', async () => {
    const { prisma, service } = build();
    prisma.importJob.findFirst.mockResolvedValue(null);

    await expect(service.getJobForActor(9, 1)).rejects.toThrow(IMPORT_JOB_NOT_FOUND_FA);
    expect(prisma.importJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 9, userId: 1 } }),
    );
  });

  it('keeps commit restricted to the job owner', async () => {
    const { prisma, service } = build();
    prisma.importJob.findUnique.mockResolvedValue({
      batchId: 'batch-1',
      userId: 9,
      entity: 'CUSTOMERS',
      status: 'PENDING',
      metadata: { eligibleRows: [{ phone: '09120000000', name: 'A' }] },
    });

    await expect(service.commitCustomers('batch-1', 4)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.importJob.update).not.toHaveBeenCalled();
  });

  it('lets the owner pass the commit ownership check', async () => {
    const { prisma, service } = build();
    prisma.importJob.findUnique.mockResolvedValue({
      batchId: 'batch-1',
      userId: 4,
      entity: 'CUSTOMERS',
      status: 'PENDING',
      metadata: { eligibleRows: [] },
    });

    await expect(service.commitCustomers('batch-1', 4)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.importJob.update).not.toHaveBeenCalled();
  });

  it('hides a missing commit batch behind not-found', async () => {
    const { prisma, service } = build();
    prisma.importJob.findUnique.mockResolvedValue(null);

    await expect(service.commitCustomers('missing', 4)).rejects.toBeInstanceOf(NotFoundException);
  });
});
