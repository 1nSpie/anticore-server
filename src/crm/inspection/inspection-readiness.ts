import { isValidVin } from "../../common/vin.util";
import {
  INTERIOR_KEYS,
  INTERIOR_LABELS,
  SYSTEM_KEYS,
  SYSTEM_LABELS,
  type InteriorValue,
  type SystemsValue,
} from "./inspection.rules";

/** Недостающее поле: `field` — якорь, к которому интерфейс даёт переход (ТЗ §17). */
export type MissingField = { code: string; field: string; label: string };

export type ReadinessInput = {
  client: { lastName: string | null; firstName: string | null };
  vehicle: {
    carId: number | null;
    customLabel: string | null;
    year: number | null;
    vin: string | null;
    plate: string | null;
  } | null;
  inspection: {
    receivedAt: Date | null;
    receivedById: number | null;
    mileageKm: number | null;
    fuelPercent: number | null;
    keysCount: number | null;
    noDefectsConfirmed: boolean;
    interior: unknown;
    systems: unknown;
    dataVerifiedAt: Date | null;
  } | null;
  marksCount: number;
};

/** Поля карточки клиента и автомобиля — нужны, прежде чем мастер подтвердит «данные проверены». */
export function cardMissing(input: Pick<ReadinessInput, "client" | "vehicle">): MissingField[] {
  const out: MissingField[] = [];
  const add = (code: string, field: string, label: string) => out.push({ code, field, label });
  if (!input.client.lastName?.trim()) add("client.lastName", "client", "Фамилия клиента");
  if (!input.client.firstName?.trim()) add("client.firstName", "client", "Имя клиента");
  const v = input.vehicle;
  if (!v) {
    add("vehicle", "vehicle", "Автомобиль не выбран");
    return out;
  }
  if (!v.carId && !v.customLabel?.trim()) add("vehicle.model", "vehicle", "Марка и модель");
  if (v.year == null) add("vehicle.year", "vehicle.year", "Год выпуска");
  if (!v.vin?.trim()) add("vehicle.vin", "vehicle.vin", "VIN");
  else if (!isValidVin(v.vin)) add("vehicle.vin", "vehicle.vin", "VIN указан некорректно");
  if (!v.plate?.trim()) add("vehicle.plate", "vehicle.plate", "Государственный номер");
  return out;
}

/** Всё, что должно быть заполнено для акта приёма-передачи (ТЗ §3, §10, §12). */
export function acceptanceMissing(input: ReadinessInput): MissingField[] {
  const out = cardMissing(input);
  const add = (code: string, field: string, label: string) => out.push({ code, field, label });
  const i = input.inspection;
  if (!i) {
    add("inspection", "inspection", "Приёмка не начата");
    return out;
  }
  if (!i.receivedAt) add("inspection.receivedAt", "receivedAt", "Фактические дата и время приёма");
  if (!i.receivedById) add("inspection.receivedBy", "receivedBy", "Мастер-приёмщик");
  if (i.mileageKm == null) add("inspection.mileage", "mileageKm", "Пробег");
  if (i.fuelPercent == null) add("inspection.fuel", "fuelPercent", "Уровень топлива");
  if (i.keysCount == null) add("inspection.keys", "keysCount", "Количество ключей");
  if (input.marksCount === 0 && !i.noDefectsConfirmed) {
    add("inspection.exterior", "exterior", "Внешнее состояние: отметьте повреждения или подтвердите, что их нет");
  }
  const interior = (i.interior ?? {}) as InteriorValue;
  for (const key of INTERIOR_KEYS) {
    if (!interior[key]) add(`inspection.interior.${key}`, "interior", `Салон: ${INTERIOR_LABELS[key]}`);
  }
  const systems = (i.systems ?? {}) as SystemsValue;
  for (const key of SYSTEM_KEYS) {
    if (!systems[key]) add(`inspection.systems.${key}`, "systems", `Системы: ${SYSTEM_LABELS[key]}`);
  }
  if (!i.dataVerifiedAt) add("inspection.verified", "verify", "Подтверждение проверки данных (VIN сверен с маркировкой)");
  return out;
}
