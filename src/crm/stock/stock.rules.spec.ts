import { isLow, movementDelta, wouldGoNegative } from "./stock.rules";

describe("склад", () => {
  it("приход +, расход −", () => {
    expect(movementDelta("IN", 5, 0)).toBe(5);
    expect(movementDelta("OUT", 2, 10)).toBe(-2);
  });

  it("инвентаризация задаёт фактический остаток", () => {
    expect(movementDelta("ADJUST", 8, 10)).toBe(-2);
    expect(movementDelta("ADJUST", 10.5, 10)).toBe(0.5);
    expect(movementDelta("ADJUST", 0.3, 0.1)).toBe(0.2);
  });

  it("расход выше остатка уводит в минус", () => {
    expect(wouldGoNegative(3, -3)).toBe(false);
    expect(wouldGoNegative(3, -3.001)).toBe(true);
  });

  it("ниже минимума — только если минимум задан", () => {
    expect(isLow(1, 2)).toBe(true);
    expect(isLow(2, 2)).toBe(false);
    expect(isLow(0, 0)).toBe(false);
  });
});
