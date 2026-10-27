import { CrmLocation } from "../../generated/prisma/client";

/** Координаты филиалов для чекина (переданы заказчиком 09.10.2026). */
export const BRANCH_GEO: Record<CrmLocation, { lat: number; lng: number }> = {
  ZHUKOVSKY: { lat: 55.573211, lng: 38.101764 },
  RAMENSKOYE: { lat: 55.573363, lng: 38.263704 },
  KOLOMNA: { lat: 55.123116, lng: 38.810275 },
};

/** Радиус чекина: дальше — чекин разрешён, но с пометкой «вне радиуса». */
export const CHECKIN_RADIUS_M = 200;

/** Сколько хранить координаты чекинов (152-ФЗ), дней. После — обнуляются, сам чекин остаётся. */
export const GEO_RETENTION_DAYS = 365;

/** Расстояние между точками на сфере (формула гаверсинусов), метры. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Ближайший филиал из `candidates` (пустой список = все филиалы). */
export function nearestBranch(point: { lat: number; lng: number }, candidates: CrmLocation[]): CrmLocation {
  const list = candidates.length ? candidates : (Object.keys(BRANCH_GEO) as CrmLocation[]);
  return list.reduce((best, loc) =>
    distanceMeters(point, BRANCH_GEO[loc]) < distanceMeters(point, BRANCH_GEO[best]) ? loc : best,
  );
}
