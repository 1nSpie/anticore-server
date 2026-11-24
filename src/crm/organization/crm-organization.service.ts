import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CRM_LOCATIONS } from "../common/crm-location";
import { UpdateBranchDto, UpdateOrganizationDto } from "./dto/organization.dto";

const ORGANIZATION_ID = 1;

/** Реквизиты исполнителя и филиалов — единый источник для договора и актов. */
@Injectable()
export class CrmOrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const [organization, branches] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id: ORGANIZATION_ID } }),
      this.prisma.branch.findMany(),
    ]);
    const order = (code: string) => CRM_LOCATIONS.indexOf(code as never);
    branches.sort((a, b) => order(a.location) - order(b.location));
    return { organization, branches };
  }

  async updateOrganization(dto: UpdateOrganizationDto) {
    return this.prisma.organization.update({
      where: { id: ORGANIZATION_ID },
      data: trimStrings(dto),
    });
  }

  async updateBranch(location: string, dto: UpdateBranchDto) {
    if (!(CRM_LOCATIONS as readonly string[]).includes(location)) {
      throw new BadRequestException("Неизвестный филиал");
    }
    const data = trimStrings(dto);
    if (data.docPrefix) data.docPrefix = data.docPrefix.toUpperCase();
    try {
      return await this.prisma.branch.update({
        where: { location: location as (typeof CRM_LOCATIONS)[number] },
        data,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("Такой префикс уже используется другим филиалом");
      }
      throw e;
    }
  }
}

function trimStrings<T extends object>(dto: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dto)) {
    if (v !== undefined) out[k] = typeof v === "string" ? v.trim() : v;
  }
  return out as T;
}
