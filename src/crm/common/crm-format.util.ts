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

export function validateVin(vin: string): string {
  return validateVinStrict(vin);
}

export { normalizeVin };

export function formatDateRu(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function formatTimeRu(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mi}`;
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
