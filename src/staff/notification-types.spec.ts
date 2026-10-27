import { scheduleChangeText } from "./notification-types";

const T = (iso: string) => new Date(iso);
const base = { startsAt: T("2026-10-10T07:00:00Z"), endsAt: T("2026-10-10T09:00:00Z"), location: "KOLOMNA", serviceType: "Антикор днища" };

describe("scheduleChangeText", () => {
  it("перенос, смена филиала и смена услуги — существенны", () => {
    expect(scheduleChangeText(base, { ...base, startsAt: T("2026-10-11T07:00:00Z"), endsAt: T("2026-10-11T09:00:00Z") })).toContain("Антикор днища");
    expect(scheduleChangeText(base, { ...base, location: "ZHUKOVSKY" })).not.toBeNull();
    expect(scheduleChangeText(base, { ...base, serviceType: "Комплекс" })).toContain("Комплекс");
  });

  it("без существенных изменений (цена, комментарий, менеджер) — null, мастера не беспокоим", () => {
    expect(scheduleChangeText(base, { ...base })).toBeNull();
    // те же моменты времени, но другие объекты Date
    expect(scheduleChangeText(base, { ...base, startsAt: T("2026-10-10T07:00:00Z"), endsAt: T("2026-10-10T09:00:00Z") })).toBeNull();
  });

  it("в тексте время по Москве", () => {
    const text = scheduleChangeText(base, { ...base, serviceType: "Комплекс" })!;
    expect(text).toMatch(/10:00/); // 07:00Z = 10:00 МСК
  });
});
