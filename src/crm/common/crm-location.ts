export const CRM_LOCATIONS = [
  "ZHUKOVSKY",
  "RAMENSKOYE",
  "KOLOMNA",
] as const;

export type CrmLocationCode = (typeof CRM_LOCATIONS)[number];

export const CRM_LOCATION_LABELS: Record<CrmLocationCode, string> = {
  ZHUKOVSKY: "Жуковский",
  RAMENSKOYE: "Раменское",
  KOLOMNA: "Коломна",
};

export const DEFAULT_CRM_LOCATION: CrmLocationCode = "ZHUKOVSKY";
