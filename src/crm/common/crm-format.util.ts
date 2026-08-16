import { validateVin as validateVinStrict, normalizeVin } from "../../common/vin.util";

export function formatClientFio(user: {
  firstName?: string | null;
  lastName?: string | null;
  patronymic?: string | null;
}): string {
  return [user.lastName, user.firstName, user.patronymic]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function formatCarModel(user: {
  customCar?: string | null;
  car?: { model: string; brand?: { name: string } | null } | null;
}): string {
  if (user.customCar?.trim()) return user.customCar.trim();
  if (user.car) {
    const brand = user.car.brand?.name;
    return brand ? `${brand} ${user.car.model}` : user.car.model;
  }
  return "";
}

export function formatVehicleLabel(vehicle: {
  customLabel?: string | null;
  car?: { model: string; brand?: { name: string } | null } | null;
}): string {
  if (vehicle.customLabel?.trim()) return vehicle.customLabel.trim();
  if (vehicle.car) {
    const brand = vehicle.car.brand?.name;
    return brand ? `${brand} ${vehicle.car.model}` : vehicle.car.model;
  }
  return "";
}

export function validateVin(vin: string): string {
  return validateVinStrict(vin);
}

export { normalizeVin };

const MOSCOW_TZ = "Europe/Moscow";

/** Дата ДД.ММ.ГГГГ в часовом поясе Москвы (не сервера). */
export function formatDateRu(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MOSCOW_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(d);
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  return `${day}.${month}.${year}`;
}

/** Время ЧЧ:ММ в часовом поясе Москвы (не сервера). */
export function formatTimeRu(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MOSCOW_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  let hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  // Node/ICU иногда отдаёт "24" для полуночи
  if (hour === "24") hour = "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export type SmsPlaceholderCtx = {
  name: string;
  date?: string;
  time?: string;
  service?: string;
  price?: string;
  company: string;
};

export function renderSmsTemplate(
  body: string,
  ctx: SmsPlaceholderCtx,
): string {
  return body
    .replaceAll("{NAME}", ctx.name)
    .replaceAll("{DATE}", ctx.date ?? "")
    .replaceAll("{TIME}", ctx.time ?? "")
    .replaceAll("{SERVICE}", ctx.service ?? "")
    .replaceAll("{PRICE}", ctx.price ?? "")
    .replaceAll("{COMPANY}", ctx.company);
}
