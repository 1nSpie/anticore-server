"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const XLSX = require("xlsx");
const client_1 = require("@prisma/client");
const path = require("path");
const fs = require("fs");
const prisma = new client_1.PrismaClient();
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
const FILE_NAME = "table2.xlsx";
const COLUMN_INDEX = {
    brand: 0,
    model: 2,
    segment: 3,
};
const normalizeCell = (value) => value === null || value === undefined ? "" : `${value}`.trim();
const parseSegment = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 1;
};
async function main() {
    try {
        const filePath = path.join(__dirname, FILE_NAME);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Файл ${filePath} не найден`);
        }
        console.log("📖 Читаем Excel файл...");
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
        });
        const headers = (jsonData[0] ?? []).map((cell) => normalizeCell(cell));
        console.log(`📊 Найдено ${jsonData.length - 1} строк данных`);
        console.log(`📋 Заголовки: ${headers.join(", ")}`);
        console.log("🗑️ Очищаем старые данные...");
        await prisma.bodyTypePrice.deleteMany({});
        await prisma.car.deleteMany({});
        await prisma.brand.deleteMany({});
        console.log("💰 Синхронизируем ценовые сегменты...");
        await Promise.all(classes.map((bodyType) => prisma.bodyTypePrice.upsert({
            where: { segment: bodyType.segment },
            create: bodyType,
            update: bodyType,
        })));
        console.log(`💰 Обновлено ценовых сегментов: ${classes.length}`);
        let processedRows = 0;
        let skippedRows = 0;
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row) {
                skippedRows++;
                continue;
            }
            const brandName = normalizeCell(row[COLUMN_INDEX.brand]);
            const modelName = normalizeCell(row[COLUMN_INDEX.model]);
            const segment = parseSegment(row[COLUMN_INDEX.segment]);
            if (!brandName || !modelName) {
                console.log(`⚠️ Пропускаем строку ${i + 1}: отсутствует бренд или модель`);
                skippedRows++;
                continue;
            }
            try {
                let brand = await prisma.brand.findFirst({
                    where: { name: brandName },
                });
                if (!brand) {
                    brand = await prisma.brand.create({
                        data: { name: brandName },
                    });
                    console.log(`✨ Создан новый бренд: ${brandName}`);
                }
                const existingCar = await prisma.car.findFirst({
                    where: {
                        model: modelName,
                        brandId: brand.id,
                    },
                });
                if (existingCar) {
                    console.log(`⚠️ Модель ${brandName} ${modelName} уже существует, пропускаем...`);
                    skippedRows++;
                    continue;
                }
                await prisma.car.create({
                    data: {
                        model: modelName,
                        brandId: brand.id,
                        segment: segment,
                    },
                });
                console.log(`🚗 Создана модель: ${brandName} ${modelName} (сегмент: ${segment})`);
                processedRows++;
            }
            catch (error) {
                console.error(`❌ Ошибка при обработке строки ${i + 1} (${brandName} ${modelName}):`, error);
                skippedRows++;
            }
        }
        console.log("\n📈 Статистика импорта:");
        console.log(`✅ Обработано строк: ${processedRows}`);
        console.log(`⚠️ Пропущено строк: ${skippedRows}`);
        console.log(`📊 Всего строк в файле: ${jsonData.length - 1}`);
        const brandsCount = await prisma.brand.count();
        const carsCount = await prisma.car.count();
        const pricesCount = await prisma.bodyTypePrice.count();
        console.log("\n🎯 Итоговая статистика базы данных:");
        console.log(`🏢 Брендов: ${brandsCount}`);
        console.log(`🚗 Моделей: ${carsCount}`);
        console.log(`💰 Цен: ${pricesCount}`);
        console.log("\n✅ Импорт завершен успешно!");
    }
    catch (error) {
        console.error("❌ Критическая ошибка импорта:", error);
        throw error;
    }
}
main()
    .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Ошибка импорта:", message);
})
    .finally(() => {
    void prisma.$disconnect();
});
//# sourceMappingURL=import-cars.js.map