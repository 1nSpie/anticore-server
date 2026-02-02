import "dotenv/config";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as path from "path";
import * as fs from "fs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const classes = [
  {
    segment: 1,
    standartML: 20500,
    standartMLBody: 23500,
    complexML: 25500,
    complexMLBody: 28500,
  },
  {
    segment: 2,
    standartML: 23500,
    standartMLBody: 26500,
    complexML: 28500,
    complexMLBody: 31500,
  },
  {
    segment: 3,
    standartML: 26500,
    standartMLBody: 29500,
    complexML: 31500,
    complexMLBody: 34500,
  },
  {
    segment: 4,
    standartML: 28500,
    standartMLBody: 31500,
    complexML: 33500,
    complexMLBody: 36500,
  },
  {
    segment: 5,
    standartML: 33500,
    standartMLBody: 36500,
    complexML: 38500,
    complexMLBody: 41500,
  },
  {
    segment: 6,
    standartML: 38500,
    standartMLBody: 41500,
    complexML: 43500,
    complexMLBody: 46500,
  },
];

const FILE_NAME = "../table2.xlsx";

const COLUMN_INDEX = {
  brand: 0,
  model: 2,
  segment: 3,
} as const;

type WorksheetCell = string | number | boolean | null | undefined;
type WorksheetRow = WorksheetCell[];

const normalizeCell = (value: WorksheetCell): string =>
  value === null || value === undefined ? "" : `${value}`.trim();

const parseSegment = (value: WorksheetCell): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 1;
};

async function main() {
  try {
    // Проверяем существование файла
    const filePath = path.join(__dirname, FILE_NAME);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Файл ${filePath} не найден`);
    }

    console.log("📖 Читаем Excel файл...");
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Преобразуем лист в JSON с заголовками
    const jsonData = XLSX.utils.sheet_to_json<WorksheetRow>(worksheet, {
      header: 1,
    });
    const headers = (jsonData[0] ?? []).map((cell) => normalizeCell(cell));

    console.log(`📊 Найдено ${jsonData.length - 1} строк данных`);
    console.log(`📋 Заголовки: ${headers.join(", ")}`);

    // Очищаем существующие данные (опционально)
    console.log("🗑️ Очищаем старые данные...");
    await prisma.bodyTypePrice.deleteMany({});
    await prisma.car.deleteMany({});
    await prisma.brand.deleteMany({});

    console.log("💰 Синхронизируем ценовые сегменты...");
    await Promise.all(
      classes.map((bodyType) =>
        prisma.bodyTypePrice.upsert({
          where: { segment: bodyType.segment },
          create: bodyType,
          update: bodyType,
        }),
      ),
    );
    console.log(`💰 Обновлено ценовых сегментов: ${classes.length}`);

    let processedRows = 0;
    let skippedRows = 0;

    // Обрабатываем каждую строку (пропускаем заголовок)
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];

      if (!row) {
        skippedRows++;
        continue; // пропускаем пустые строки
      }

      const brandName = normalizeCell(row[COLUMN_INDEX.brand]);
      const modelName = normalizeCell(row[COLUMN_INDEX.model]);
      const segment = parseSegment(row[COLUMN_INDEX.segment]);

      if (!brandName || !modelName) {
        console.log(
          `⚠️ Пропускаем строку ${i + 1}: отсутствует бренд или модель`,
        );
        skippedRows++;
        continue;
      }

      try {
        // Находим или создаем бренд
        let brand = await prisma.brand.findFirst({
          where: { name: brandName },
        });

        if (!brand) {
          brand = await prisma.brand.create({
            data: { name: brandName },
          });
          console.log(`✨ Создан новый бренд: ${brandName}`);
        }

        // Проверяем, существует ли уже такая модель у этого бренда
        const existingCar = await prisma.car.findFirst({
          where: {
            model: modelName,
            brandId: brand.id,
          },
        });

        if (existingCar) {
          console.log(
            `⚠️ Модель ${brandName} ${modelName} уже существует, пропускаем...`,
          );
          skippedRows++;
          continue;
        }

        // Создаем модель автомобиля
        await prisma.car.create({
          data: {
            model: modelName,
            brandId: brand.id,
            segment: segment,
          },
        });

        console.log(
          `🚗 Создана модель: ${brandName} ${modelName} (сегмент: ${segment})`,
        );

        processedRows++;
      } catch (error: unknown) {
        console.error(
          `❌ Ошибка при обработке строки ${i + 1} (${brandName} ${modelName}):`,
          error,
        );
        skippedRows++;
      }
    }

    console.log("\n📈 Статистика импорта:");
    console.log(`✅ Обработано строк: ${processedRows}`);
    console.log(`⚠️ Пропущено строк: ${skippedRows}`);
    console.log(`📊 Всего строк в файле: ${jsonData.length - 1}`);

    // Показываем финальную статистику
    const brandsCount = await prisma.brand.count();
    const carsCount = await prisma.car.count();
    const pricesCount = await prisma.bodyTypePrice.count();

    console.log("\n🎯 Итоговая статистика базы данных:");
    console.log(`🏢 Брендов: ${brandsCount}`);
    console.log(`🚗 Моделей: ${carsCount}`);
    console.log(`💰 Цен: ${pricesCount}`);

    console.log("\n✅ Импорт завершен успешно!");
  } catch (error: unknown) {
    console.error("❌ Критическая ошибка импорта:", error);
    throw error;
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Ошибка импорта:", message);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
