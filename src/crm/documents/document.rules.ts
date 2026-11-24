import type { DocumentKind } from "../../../generated/prisma/client";

export const DOCUMENT_KINDS: DocumentKind[] = ["CONTRACT", "ACCEPTANCE", "WORKS"];

export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  CONTRACT: "Договор",
  ACCEPTANCE: "Акт приёма-передачи",
  WORKS: "Акт выполненных работ",
};

/** Версия схемы снимка: при изменении структуры снимка поднимаем, старые версии продолжают читаться. */
export const SNAPSHOT_SCHEMA_VERSION = 3;

/**
 * Единый номер договора и актов: префикс филиала и порядковый номер, например `Р-000125` (ТЗ §16).
 * Нумерация сквозная по филиалу, без сброса по годам: номер уникален и не меняется, год виден из дат документов.
 */
export function formatDocNumber(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(6, "0")}`;
}

/** Реквизиты исполнителя для конкретного филиала — то же, что собирает клиент в `buildDocIssuer`. */
export type IssuerSnapshot = {
  fullName: string;
  brandName: string;
  inn: string;
  ogrnip: string;
  legalAddress: string;
  phone: string;
  email: string;
  signerName: string;
  city: string;
  branchAddress: string;
  docPrefix: string;
  title: string;
  titleInBrackets: string;
};

export function buildIssuer(
  org: Omit<IssuerSnapshot, "city" | "branchAddress" | "docPrefix" | "title" | "titleInBrackets">,
  branch: { city: string; address: string; docPrefix: string },
): IssuerSnapshot {
  const brand = `${org.brandName} ${branch.city}`;
  return {
    fullName: org.fullName,
    brandName: org.brandName,
    inn: org.inn,
    ogrnip: org.ogrnip,
    legalAddress: org.legalAddress,
    phone: org.phone,
    email: org.email,
    signerName: org.signerName,
    city: branch.city,
    branchAddress: branch.address,
    docPrefix: branch.docPrefix,
    title: `${org.fullName} ; ${brand}`,
    titleInBrackets: `${org.fullName} (${brand})`,
  };
}
