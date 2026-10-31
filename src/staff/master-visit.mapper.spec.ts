import { SiteLeadStatus } from "../../generated/prisma/client";
import { MasterVisitRow, masterVisitStatus, toMasterVisit } from "./master-visit.mapper";

const T = (iso: string) => new Date(iso);
const base = (over: Partial<MasterVisitRow> = {}): MasterVisitRow => ({
  id: 5,
  startsAt: T("2026-10-12T07:00:00Z"),
  endsAt: T("2026-10-12T09:00:00Z"),
  visitDate: T("2026-10-12T00:00:00Z"),
  serviceType: "Антикор днища",
  priceRub: 12000,
  masterComment: "Осторожно с порогами",
  location: "KOLOMNA",
  completedAt: null,
  vehicle: { customLabel: null, vin: "XTA210930Y2765499", car: { model: "Granta", brand: { name: "Lada" } } },
  siteLead: { status: SiteLeadStatus.SCHEDULED },
  ...over,
});

describe("toMasterVisit", () => {
  it("отдаёт модель авто, услугу и цену", () => {
    expect(toMasterVisit(base(), T("2026-10-11T10:00:00Z"))).toMatchObject({
      id: 5,
      serviceType: "Антикор днища",
      priceRub: 12000,
      location: "KOLOMNA",
      vehicle: { label: "Lada Granta", vin: "XTA210930Y2765499" },
      comment: "Осторожно с порогами",
    });
  });

  it("не содержит данных клиента, даже если они затесались в строку", () => {
    const leaky = {
      ...base(),
      user: { phone: "79990001122", firstName: "Пётр", lastName: "Клиентов" },
      userId: 77,
    } as MasterVisitRow;
    const json = JSON.stringify(toMasterVisit(leaky, new Date()));
    expect(json).not.toMatch(/79990001122|Пётр|Клиентов|userId|"user"|phone/);
  });

  it("VIN необязателен: запись без авто и без VIN не ломается", () => {
    expect(toMasterVisit(base({ vehicle: null }), new Date()).vehicle).toBeNull();
    const v = toMasterVisit(base({ vehicle: { customLabel: "Старая «Волга»", vin: null } }), new Date()).vehicle;
    expect(v).toEqual({ label: "Старая «Волга»", vin: null });
  });
});

describe("masterVisitStatus", () => {
  it("закрытая запись — «Выполнено»", () => {
    expect(masterVisitStatus(base({ completedAt: T("2026-10-12T09:30:00Z") }), T("2026-10-13T00:00:00Z"))).toBe("DONE");
  });
  it("будущая запись — «Запланировано»", () => {
    expect(masterVisitStatus(base(), T("2026-10-11T12:00:00Z"))).toBe("PLANNED");
  });
  it("идёт время записи — «В работе»", () => {
    expect(masterVisitStatus(base(), T("2026-10-12T08:00:00Z"))).toBe("IN_PROGRESS");
  });
  it("заявка на подъёмнике — «В работе», даже до начала времени", () => {
    expect(masterVisitStatus(base({ siteLead: { status: SiteLeadStatus.IN_PROGRESS } }), T("2026-10-12T04:00:00Z"))).toBe("IN_PROGRESS");
  });
});
