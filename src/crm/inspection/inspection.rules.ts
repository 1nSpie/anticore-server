import { BadRequestException } from "@nestjs/common";

/** Состояние системы при приёмке. «Не проверялось» — осознанный выбор, пустое значение — «не заполнено». */
export const SYSTEM_STATUSES = ["OK", "FAULTY", "NOT_CHECKED"] as const;
export type SystemStatus = (typeof SYSTEM_STATUSES)[number];

/** Восемь проверок из ТЗ §10.4. Для приборной панели OK = «ошибок нет», FAULTY = «ошибки имеются». */
export const SYSTEM_KEYS = [
  "lights",
  "turnSignals",
  "brakeLights",
  "wipers",
  "horn",
  "climate",
  "fan",
  "dashboard",
] as const;
export type SystemKey = (typeof SYSTEM_KEYS)[number];

export const SYSTEM_LABELS: Record<SystemKey, string> = {
  lights: "Световые приборы",
  turnSignals: "Поворотники",
  brakeLights: "Стоп-сигналы",
  wipers: "Стеклоочистители",
  horn: "Звуковой сигнал",
  climate: "Климатическая система",
  fan: "Скорости вентилятора печки",
  dashboard: "Приборная панель (ошибки)",
};

export const INTERIOR_KEYS = ["dirt", "damage", "upholstery", "smell"] as const;
export type InteriorKey = (typeof INTERIOR_KEYS)[number];
export const INTERIOR_LABELS: Record<InteriorKey, string> = {
  dirt: "Загрязнения салона",
  damage: "Повреждения элементов интерьера",
  upholstery: "Повреждения обивки",
  smell: "Посторонние запахи",
};
export const INTERIOR_FLAGS = ["NONE", "PRESENT"] as const;

export const DAMAGE_TYPES = ["SCRATCH", "DENT", "CORROSION", "CHIP", "OTHER"] as const;
/** Обозначения на схеме по ТЗ: X / O / K / S / D. */
export const DAMAGE_SYMBOLS: Record<(typeof DAMAGE_TYPES)[number], string> = {
  SCRATCH: "X",
  DENT: "O",
  CORROSION: "K",
  CHIP: "S",
  OTHER: "D",
};
export const DAMAGE_LABELS: Record<(typeof DAMAGE_TYPES)[number], string> = {
  SCRATCH: "царапина",
  DENT: "вмятина",
  CORROSION: "коррозия",
  CHIP: "скол",
  OTHER: "иное повреждение",
};

export type SystemsValue = Partial<Record<SystemKey, { status: SystemStatus; note?: string }>>;
export type InteriorValue = Partial<Record<InteriorKey, (typeof INTERIOR_FLAGS)[number]>>;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Проверяет и чистит JSON систем: только известные ключи и статусы, комментарий до 300 символов. */
export function parseSystems(input: unknown): SystemsValue {
  if (!isObject(input)) throw new BadRequestException("Некорректные данные проверки систем");
  const out: SystemsValue = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!(SYSTEM_KEYS as readonly string[]).includes(key)) {
      throw new BadRequestException(`Неизвестная система: ${key}`);
    }
    if (!isObject(raw) || !(SYSTEM_STATUSES as readonly unknown[]).includes(raw.status)) {
      throw new BadRequestException(`Некорректный статус: ${SYSTEM_LABELS[key as SystemKey]}`);
    }
    const note = typeof raw.note === "string" ? raw.note.trim().slice(0, 300) : "";
    out[key as SystemKey] = { status: raw.status as SystemStatus, ...(note && { note }) };
  }
  return out;
}

export function parseInterior(input: unknown): InteriorValue {
  if (!isObject(input)) throw new BadRequestException("Некорректные данные о состоянии салона");
  const out: InteriorValue = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!(INTERIOR_KEYS as readonly string[]).includes(key)) {
      throw new BadRequestException(`Неизвестный пункт салона: ${key}`);
    }
    if (!(INTERIOR_FLAGS as readonly unknown[]).includes(raw)) {
      throw new BadRequestException(`Некорректное значение: ${INTERIOR_LABELS[key as InteriorKey]}`);
    }
    out[key as InteriorKey] = raw as (typeof INTERIOR_FLAGS)[number];
  }
  return out;
}

export function checkInt(value: number, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(`${label}: целое число от ${min} до ${max}`);
  }
  return value;
}
