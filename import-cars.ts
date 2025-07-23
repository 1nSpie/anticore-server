import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

const classes = [
  {
    segment: 1,
    standartML: 18000,
    standartMLBody: 20000,
    complexML: 23000,
    complexMLBody: 25000,
  },
  {
    segment: 2,
    standartML: 21000,
    standartMLBody: 23000,
    complexML: 28000,
    complexMLBody: 30000,
  },
  {
    segment: 3,
    standartML: 24000,
    standartMLBody: 26000,
    complexML: 33000,
    complexMLBody: 35000,
  },
  {
    segment: 4,
    standartML: 27000,
    standartMLBody: 29000,
    complexML: 38000,
    complexMLBody: 40000,
  },
  {
    segment: 5,
    standartML: 30000,
    standartMLBody: 32000,
    complexML: 43000,
    complexMLBody: 45000,
  },
  {
    segment: 6,
    standartML: 33000,
    standartMLBody: 35000,
    complexML: 48000,
    complexMLBody: 50000,
  },
];

async function main() {
  try {
    // Проверяем существование файла
    const filePath = path.join(__dirname, 'table.xlsx');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Файл ${filePath} не найден`);
    }

    console.log('📖 Читаем Excel файл...');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Преобразуем лист в JSON с заголовками
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
    }) as any[][];
    const headers = jsonData[0] as string[];

    console.log(`📊 Найдено ${jsonData.length - 1} строк данных`);
    console.log(`📋 Заголовки: ${headers.join(', ')}`);

    // Очищаем существующие данные (опционально)
    console.log('🗑️ Очищаем старые данные...');
    await prisma.bodyTypePrice.deleteMany({});
    await prisma.car.deleteMany({});
    await prisma.brand.deleteMany({});

    let processedRows = 0;
    let skippedRows = 0;

    // Обрабатываем каждую строку (пропускаем заголовок)
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];

      if (!row || !row[0]) {
        skippedRows++;
        continue; // пропускаем пустые строки
      }

      const brandName: string = row[0]?.toString().trim();
      const modelName = row[1]?.toString().trim();
      const segment = parseInt(row[2]) || 1;

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

        await prisma.bodyTypePrice.createMany({
          data: classes,
          skipDuplicates: true,
        });

        console.log(`💰 Добавлено цен: ${classes.length}`);
        processedRows++;
      } catch (error) {
        console.error(
          `❌ Ошибка при обработке строки ${i + 1} (${brandName} ${modelName}):`,
          error,
        );
        skippedRows++;
      }
    }

    console.log('\n📈 Статистика импорта:');
    console.log(`✅ Обработано строк: ${processedRows}`);
    console.log(`⚠️ Пропущено строк: ${skippedRows}`);
    console.log(`📊 Всего строк в файле: ${jsonData.length - 1}`);

    // Показываем финальную статистику
    const brandsCount = await prisma.brand.count();
    const carsCount = await prisma.car.count();
    const pricesCount = await prisma.bodyTypePrice.count();

    console.log('\n🎯 Итоговая статистика базы данных:');
    console.log(`🏢 Брендов: ${brandsCount}`);
    console.log(`🚗 Моделей: ${carsCount}`);
    console.log(`💰 Цен: ${pricesCount}`);

    console.log('\n✅ Импорт завершен успешно!');
  } catch (error) {
    console.error('❌ Критическая ошибка импорта:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Ошибка импорта:', e.message);
  })
  .finally(async () => await prisma.$disconnect());
