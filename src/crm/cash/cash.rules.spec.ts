import { cashTotals, toCsv } from "./cash.rules";

describe("cashTotals", () => {
  it("приход минус расход; аннулированные не считаются", () => {
    const r = cashTotals([
      { direction: "IN", amountRub: 5000, voidedAt: null },
      { direction: "OUT", amountRub: 1200, voidedAt: null },
      { direction: "IN", amountRub: 999, voidedAt: new Date() },
    ]);
    expect(r).toEqual({ inRub: 5000, outRub: 1200, balanceRub: 3800 });
  });
});

describe("toCsv", () => {
  it("экранирует ; и кавычки, BOM для Excel", () => {
    const csv = toCsv(["a", "b"], [["x;y", 'say "hi"']]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"x;y";"say ""hi"""');
  });
});
