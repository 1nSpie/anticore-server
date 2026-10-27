import { BRANCH_GEO, CHECKIN_RADIUS_M, distanceMeters, nearestBranch } from "./branch-geo";

describe("branch-geo", () => {
  it("расстояние до самой себя — 0", () => {
    expect(distanceMeters(BRANCH_GEO.KOLOMNA, BRANCH_GEO.KOLOMNA)).toBe(0);
  });

  it("Жуковский — Раменское ≈ 10 км", () => {
    const d = distanceMeters(BRANCH_GEO.ZHUKOVSKY, BRANCH_GEO.RAMENSKOYE);
    expect(d).toBeGreaterThan(9_500);
    expect(d).toBeLessThan(10_500);
  });

  it("100 м на север — в радиусе, 500 м — вне", () => {
    const p = BRANCH_GEO.ZHUKOVSKY;
    const north = (m: number) => ({ lat: p.lat + m / 111_195, lng: p.lng });
    expect(distanceMeters(p, north(100))).toBeLessThanOrEqual(CHECKIN_RADIUS_M);
    expect(distanceMeters(p, north(500))).toBeGreaterThan(CHECKIN_RADIUS_M);
  });

  it("ближайший филиал выбирается среди филиалов мастера, пустой список = все", () => {
    const nearRamenskoye = { lat: 55.5734, lng: 38.2635 };
    expect(nearestBranch(nearRamenskoye, [])).toBe("RAMENSKOYE");
    expect(nearestBranch(nearRamenskoye, ["ZHUKOVSKY", "KOLOMNA"])).toBe("ZHUKOVSKY");
  });
});
