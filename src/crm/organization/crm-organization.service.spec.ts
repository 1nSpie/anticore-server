import { validate } from 'class-validator';
import { Prisma } from '../../../generated/prisma/client';
import { CrmOrganizationService } from './crm-organization.service';
import { UpdateBranchDto, UpdateOrganizationDto } from './dto/organization.dto';

describe('CrmOrganizationService', () => {
  const branch = (location: string) => ({ location, city: location, address: 'a', docPrefix: location[0] });
  let prisma: { organization: Record<string, jest.Mock>; branch: Record<string, jest.Mock> };
  let service: CrmOrganizationService;

  beforeEach(() => {
    prisma = {
      organization: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 1, fullName: 'ИП' }),
        update: jest.fn(async ({ data }) => ({ id: 1, ...data })),
      },
      branch: {
        findMany: jest.fn().mockResolvedValue([branch('KOLOMNA'), branch('ZHUKOVSKY'), branch('RAMENSKOYE')]),
        update: jest.fn(async ({ data }) => data),
      },
    };
    service = new CrmOrganizationService(prisma as never);
  });

  it('returns branches in the CRM order (Жуковский, Раменское, Коломна)', async () => {
    const { branches } = await service.get();
    expect(branches.map((b) => b.location)).toEqual(['ZHUKOVSKY', 'RAMENSKOYE', 'KOLOMNA']);
  });

  it('trims text and upper-cases the document prefix', async () => {
    await service.updateBranch('RAMENSKOYE', { city: '  Раменское ', docPrefix: 'р' });
    expect(prisma.branch.update).toHaveBeenCalledWith({
      where: { location: 'RAMENSKOYE' },
      data: { city: 'Раменское', docPrefix: 'Р' },
    });
  });

  it('rejects an unknown branch', async () => {
    await expect(service.updateBranch('MOSCOW', { city: 'x' })).rejects.toThrow('Неизвестный филиал');
  });

  it('reports a duplicate prefix as a conflict', async () => {
    prisma.branch.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(service.updateBranch('KOLOMNA', { docPrefix: 'Р' })).rejects.toThrow('префикс');
  });

  it('validates INN, OGRNIP, e-mail and prefix', async () => {
    const org = Object.assign(new UpdateOrganizationDto(), { inn: '123', ogrnip: '1', email: 'no' });
    expect((await validate(org)).map((e) => e.property).sort()).toEqual(['email', 'inn', 'ogrnip']);
    const ok = Object.assign(new UpdateOrganizationDto(), { inn: '504032243409', ogrnip: '321508100480776', email: 'a@b.ru' });
    expect(await validate(ok)).toHaveLength(0);
    expect(await validate(Object.assign(new UpdateBranchDto(), { docPrefix: 'Р1' }))).toHaveLength(1);
  });
});
