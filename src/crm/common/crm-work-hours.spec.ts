import {
  mskDateAsUtcMidnight,
  mskDayBounds,
  workDayStartFor,
} from "./crm-work-hours";

const msk = (local: string) => new Date(`${local}+03:00`);

describe("crm-work-hours", () => {
  it("сутки МСК: 23:30 29.09 ещё 29-е", () => {
    const { start, end } = mskDayBounds(msk("2026-09-29T23:30:00"));
    expect(start.toISOString()).toBe("2026-09-28T21:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-29T21:00:00.000Z");
  });

  it("сутки МСК: 00:30 30.09 уже 30-е", () => {
    const { start } = mskDayBounds(msk("2026-09-30T00:30:00"));
    expect(start.toISOString()).toBe("2026-09-29T21:00:00.000Z");
    expect(mskDateAsUtcMidnight(msk("2026-09-30T00:30:00")).toISOString()).toBe(
      "2026-09-30T00:00:00.000Z",
    );
  });

  it("начало рабочего дня — 07:30 МСК", () => {
    expect(workDayStartFor("2026-10-01").toISOString()).toBe(
      "2026-10-01T04:30:00.000Z",
    );
  });
});
