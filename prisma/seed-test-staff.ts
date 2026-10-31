// Тестовые сотрудники (админы и мастера) для локальной разработки. Идемпотентно: повторный запуск сбрасывает их пароль и состояние.
// Запуск:  npm run seed-test-staff   (из anticore-server)   или   npm run seed:test-staff   (из корня anticore_project)
//
// Безопасность: отказывается работать на нелокальной базе и при NODE_ENV=production (см. test-staff.lib.ts).
// Затрагивает только логины с префиксом `test.` — реальных сотрудников не меняет.
import "dotenv/config";
import * as bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { TEST_LOGIN_PREFIX, TEST_PASSWORD, TEST_STAFF, refusalReason, resolvePassword } from "./test-staff.lib";

async function main() {
  const refusal = refusalReason();
  if (refusal) {
    console.error(`✖ ${refusal}`);
    process.exit(1);
  }

  const password = resolvePassword();
  const passwordHash = await bcrypt.hash(password, 10); // тот же cost, что и при создании учётки в админке
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  try {
    const rows: string[][] = [];
    for (const t of TEST_STAFF) {
      if (!t.login.startsWith(TEST_LOGIN_PREFIX)) throw new Error(`Логин ${t.login} не начинается с "${TEST_LOGIN_PREFIX}" — сид не должен трогать такие учётки`);
      const existed = await prisma.staff.findUnique({ where: { login: t.login }, select: { id: true } });
      const data = {
        fullName: t.fullName,
        role: t.role,
        locations: t.locations,
        passwordHash,
        blockedAt: t.blocked ? new Date() : null,
      };
      const saved = await prisma.staff.upsert({ where: { login: t.login }, create: { login: t.login, ...data }, update: data });
      // Самопроверка: хэш в базе действительно соответствует паролю
      const ok = await bcrypt.compare(password, saved.passwordHash);
      rows.push([
        existed ? "обновлён" : "создан",
        t.login,
        t.role === "ADMIN" ? "админ" : "мастер",
        t.locations.length === 3 ? "все" : t.locations.join(","),
        t.blocked ? "ЗАБЛОКИРОВАН" : "",
        ok ? "пароль ✔" : "ПАРОЛЬ НЕ СОВПАЛ",
      ]);
      if (!ok) process.exitCode = 1;
    }

    const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
    console.log("\nТестовые сотрудники:");
    for (const r of rows) console.log("  " + r.map((c, i) => c.padEnd(widths[i])).join("  "));
    console.log(
      `\nВход: http://localhost:3000/admin — одна форма для всех, роль определяется по учётке.\n` +
        `Пароль у всех одинаковый: константа TEST_PASSWORD в anticore-server/prisma/test-staff.lib.ts` +
        `${password === TEST_PASSWORD ? "" : " (сейчас переопределён переменной TEST_STAFF_PASSWORD)"}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
