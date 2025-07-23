"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function seedWorks() {
    console.log('Deleting existing works...');
    await prisma.workImage.deleteMany();
    await prisma.workService.deleteMany();
    await prisma.work.deleteMany();
    await prisma.workCategory.deleteMany();
    console.log('Previous works deleted successfully!');
    const categories = await Promise.all([
        prisma.workCategory.upsert({
            where: { slug: 'Стандарт-ML' },
            update: {},
            create: {
                name: 'Стандарт ML',
                slug: 'Стандарт-ML',
            },
        }),
        prisma.workCategory.upsert({
            where: { slug: 'Стандарт-ML/Body' },
            update: {},
            create: {
                name: 'Стандарт ML/Body',
                slug: 'Стандарт-ML/Body',
            },
        }),
        prisma.workCategory.upsert({
            where: { slug: 'Комплекс-ML' },
            update: {},
            create: {
                name: 'Комплекс ML',
                slug: 'Комплекс-ML',
            },
        }),
        prisma.workCategory.upsert({
            where: { slug: 'Комплекс-ML/Body' },
            update: {},
            create: {
                name: 'Комплекс ML/Body',
                slug: 'Комплекс-ML/Body',
            },
        }),
    ]);
    const works = [
        {
            title: 'Toyota Land Cruiser 200 - Комплекс ML/Body',
            description: 'При данном типе обработки демонтируются колёса, подкрылки, локеры, защиты дна, пластиковые накладки порогов и, при необходимости, задний бампер. Дно автомобиля тщательно моется под высоким давлением с обработкой всех скрытых полостей, после чего полностью сушится. Далее внутренние полости дверей, капота и багажника обрабатываются ML консервантом, а проблемные зоны — кислотным и БПМ составами с последующей обработкой восками. Завершает процесс сборка всех демонтированных элементов.',
            slug: 'toyota-land-200-complex',
            beforeImage: 'works/landcruser-before.jpg',
            afterImage: 'works/landcruser-after.jpg',
            duration: 'до 8 часов',
            year: '2024',
            carBrand: 'Toyota',
            carModel: 'Land Cruiser 200',
            categoryId: categories[3].id,
            featured: true,
            services: [
                'Обработка скрытых полостей',
                'Защита днища',
                'Обработка порогов',
            ],
            images: [
                {
                    url: 'works/landcruser-1.jpg',
                    order: 1,
                },
                {
                    url: 'works/landcruser-2.jpg',
                    order: 2,
                },
            ],
        },
        {
            title: 'Honda Stepwgn - Стандарт ML',
            description: 'При обработке демонтируются колёса, подкрылки, локеры, защиты дна, пластиковые накладки порогов, а при необходимости — и задний бампер. Дно автомобиля тщательно промывается под высоким давлением с очисткой всех скрытых полостей и полностью высушивается. Затем обрабатываются места коррозии, после чего дно, арки и полости покрываются ML консервантом, а подвеска — минеральными восками. Финальным этапом становится сборка демонтированных элементов и узлов.',
            slug: 'honda-stepwgn-winter-protection',
            beforeImage: 'works/honda-before.jpg',
            afterImage: 'works/honda-after.jpg',
            duration: 'до 10 часов',
            year: '2024',
            carBrand: 'Honda',
            carModel: 'Stepwgn',
            categoryId: categories[0].id,
            featured: true,
            services: [
                'Обработка скрытых полостей',
                'Защита днища',
                'Обработка порогов',
            ],
            images: [
                {
                    url: 'works/honda-1.jpg',
                    order: 1,
                },
                {
                    url: 'works/honda-2.jpg',
                    order: 2,
                },
                {
                    url: 'works/honda-3.jpg',
                    order: 3,
                },
            ],
        },
        {
            title: 'Hyundai Tucson - Стандарт ML/Body',
            description: 'При обработке демонтируются колёса, подкрылки, локеры, защиты дна, пластиковые накладки порогов, а при необходимости — задний бампер. Дно автомобиля тщательно промывается под высоким давлением с очисткой всех скрытых полостей и полностью высушивается. Далее обрабатываются очаги коррозии, после чего дно и арки покрываются БПМ составом, полости — ML консервантом, а подвеска — минеральными восками. Завершающим этапом становится сборка всех узлов и элементов.',
            slug: 'Стандарт-ML/Body',
            beforeImage: 'works/tucson-before.jpg',
            afterImage: 'works/tucson-after.jpg',
            duration: 'до 8 часов',
            year: '2025',
            carBrand: 'Hyundai',
            carModel: 'Tucson',
            categoryId: categories[1].id,
            featured: false,
            services: [
                'Обработка скрытых полостей',
                'Защита днища',
                'Обработка порогов',
            ],
            images: [
                {
                    url: 'works/tucson-1.jpg',
                    order: 1,
                },
                {
                    url: 'works/tucson-2.jpg',
                    order: 2,
                },
                {
                    url: 'works/tucson-3.jpg',
                    order: 3,
                },
            ],
        },
        {
            title: 'Changan CS35 Plus- Стандарт ML/Body',
            description: 'При обработке демонтируются колёса, подкрылки, локеры, защиты дна, пластиковые накладки порогов, а при необходимости — задний бампер. Дно автомобиля тщательно промывается под высоким давлением с очисткой всех скрытых полостей и полностью высушивается. Далее обрабатываются очаги коррозии, после чего дно и арки покрываются БПМ составом, полости — ML консервантом, а подвеска — минеральными восками. Завершающим этапом становится сборка всех узлов и элементов.',
            slug: 'Стандарт-ML/Body',
            beforeImage: 'works/changan-before.jpg',
            afterImage: 'works/changan-after.jpg',
            duration: 'до 10 часов',
            year: '2025',
            carBrand: 'Changan',
            carModel: 'CS35 Plus',
            categoryId: categories[1].id,
            featured: true,
            services: [
                'Обработка скрытых полостей',
                'Защита днища',
                'Обработка порогов',
            ],
            images: [
                {
                    url: 'works/changan-1.jpg',
                    order: 1,
                },
                {
                    url: 'works/changan-2.jpg',
                    order: 2,
                },
            ],
        },
        {
            title: 'Volvo XC90 - Комплекс ML',
            description: 'При обработке демонтируются колёса, подкрылки, локеры, защиты дна, пластиковые накладки порогов, а при необходимости — задний бампер. Дно автомобиля тщательно промывается под высоким давлением с очисткой всех скрытых полостей и полностью высушивается. Далее обрабатываются очаги коррозии, после чего дно и арки покрываются БПМ составом, полости — ML консервантом, а подвеска — минеральными восками. Завершающим этапом становится сборка всех узлов и элементов.',
            slug: 'Комплекс-ML',
            beforeImage: 'works/volvo-before.jpg',
            afterImage: 'works/volvo-after.jpg',
            duration: 'до 10 часов',
            year: '2025',
            carBrand: 'Volvo',
            carModel: 'XC90',
            categoryId: categories[2].id,
            featured: true,
            services: [
                'Обработка скрытых полостей',
                'Защита днища',
                'Обработка порогов',
            ],
            images: [
                {
                    url: 'works/volvo-1.jpg',
                    order: 1,
                },
                {
                    url: 'works/volvo-2.jpg',
                    order: 2,
                },
                {
                    url: 'works/volvo-3.jpg',
                    order: 3,
                },
            ],
        },
    ];
    for (const workData of works) {
        const { services, images, ...work } = workData;
        await prisma.work.upsert({
            where: { slug: work.slug },
            update: {},
            create: {
                ...work,
                services: {
                    create: services.map((service) => ({ name: service })),
                },
                images: {
                    create: images.map((image) => ({
                        url: image.url,
                        order: image.order,
                    })),
                },
            },
        });
    }
    console.log('Works seeded successfully!');
}
seedWorks()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=works-seed.js.map