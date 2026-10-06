/**
 * Варианты подстроки для поиска по телефону (хранится как `79XXXXXXXXX`).
 * «8 916 …» ищем и как «7916…»; «+7 (916) 123» → «7916123». Пустой запрос → [].
 */
export function phoneSearchVariants(q?: string): string[] {
  const digits = (q ?? "").replace(/\D/g, "");
  if (!digits) return [];
  const variants = [digits];
  if (digits.length > 1 && digits.startsWith("8")) {
    variants.push(`7${digits.slice(1)}`);
  }
  return variants;
}
