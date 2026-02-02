import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding segments...');

  const segments = [
    {
      segment: 1,
      standartML: 15000,
      standartMLBody: 18000,
      complexML: 22000,
      complexMLBody: 26000,
    },
    {
      segment: 2,
      standartML: 17000,
      standartMLBody: 21000,
      complexML: 25000,
      complexMLBody: 30000,
    },
    {
      segment: 3,
      standartML: 20000,
      standartMLBody: 24000,
      complexML: 28000,
      complexMLBody: 34000,
    },
    {
      segment: 4,
      standartML: 23000,
      standartMLBody: 28000,
      complexML: 32000,
      complexMLBody: 38000,
    },
    {
      segment: 5,
      standartML: 27000,
      standartMLBody: 33000,
      complexML: 38000,
      complexMLBody: 45000,
    },
    {
      segment: 6,
      standartML: 32000,
      standartMLBody: 40000,
      complexML: 45000,
      complexMLBody: 55000,
    },
  ];

  for (const segmentData of segments) {
    await prisma.bodyTypePrice.upsert({
      where: { segment: segmentData.segment },
      update: segmentData,
      create: segmentData,
    });
    console.log(`Segment ${segmentData.segment} created/updated`);
  }

  console.log('Segments seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
