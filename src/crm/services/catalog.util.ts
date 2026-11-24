import type { Prisma } from "../../../generated/prisma/client";
import type { GroupDef } from "./services.rules";

export const categoryInclude = {
  groups: { orderBy: { sortOrder: "asc" }, include: { options: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } },
} satisfies Prisma.ServiceCategoryInclude;

export type CategoryRow = Prisma.ServiceCategoryGetPayload<{ include: typeof categoryInclude }>;

export const toGroupDefs = (c: CategoryRow): GroupDef[] =>
  c.groups.map((g) => ({
    key: g.key,
    label: g.label,
    multiple: g.multiple,
    allowCustom: g.allowCustom,
    sortOrder: g.sortOrder,
    options: g.options.map((o) => ({ name: o.name, active: o.active })),
  }));
