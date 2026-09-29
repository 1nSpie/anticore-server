import { BlogController } from '../blog/blog.controller';
import { BlogService } from '../blog/blog.service';
import { WorksController } from '../works/works.controller';
import { WorksService } from '../works/works.service';
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request = require("supertest");
import { AdminAuthService } from "../auth/admin-auth.service";
import { MediaController } from "./media.controller";
import { ContentAdminGuard } from "./content-admin.guard";
import { MAX_IMAGE_BYTES, MediaService } from "./media.service";

describe("Upload HTTP authorization and limits", () => {
  let app: INestApplication;
  const upload = jest.fn().mockResolvedValue({ key: "blog/test.webp" });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MediaController, BlogController, WorksController],
      providers: [
        { provide: BlogService, useValue: { findAdminPosts: () => [], createPost: () => ({ id: 1 }) } },
        { provide: WorksService, useValue: { findAllWorks: () => [], createWork: () => ({ id: 2 }) } },
        ContentAdminGuard,
        { provide: MediaService, useValue: { upload } },
        {
          provide: AdminAuthService,
          useValue: {
            verifyToken: (token: string) => ({
              isValid: token !== "bad",
              payload: { sub: "1", role: token === "admin" ? "admin" : "USER" },
            }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => upload.mockClear());
  it("rejects anonymous, invalid and customer tokens before upload", async () => {
    await request(app.getHttpServer()).post("/admin/media/blog").expect(401);
    await request(app.getHttpServer())
      .post("/admin/media/blog")
      .set("Authorization", "Bearer bad")
      .expect(401);
    await request(app.getHttpServer())
      .post("/admin/media/blog")
      .set("Authorization", "Bearer customer")
      .attach("file", Buffer.from("x"), "x.jpg")
      .expect(403);
    expect(upload).not.toHaveBeenCalled();
  });
  it("accepts an admin multipart file", async () => {
    await request(app.getHttpServer())
      .post("/admin/media/blog")
      .set("Authorization", "Bearer admin")
      .attach("file", Buffer.from("image"), "x.jpg")
      .expect(201, { key: "blog/test.webp" });
    expect(upload).toHaveBeenCalledWith(
      "blog",
      expect.objectContaining({ buffer: Buffer.from("image") }),
    );
  });
  it("rejects oversized and unexpected multipart input", async () => {
    await request(app.getHttpServer())
      .post("/admin/media/blog")
      .set("Authorization", "Bearer admin")
      .attach("file", Buffer.alloc(MAX_IMAGE_BYTES + 1), "x.jpg")
      .expect(413);
    await request(app.getHttpServer())
      .post("/admin/media/blog")
      .set("Authorization", "Bearer admin")
      .attach("other", Buffer.from("x"), "x.jpg")
      .expect(400);
    expect(upload).not.toHaveBeenCalled();
  });
  it('protects content writes and draft listings with the same role check', async () => {
    for (const route of ['/blog/posts', '/works']) {
      await request(app.getHttpServer()).post(route).expect(401);
      await request(app.getHttpServer()).post(route).set('Authorization', 'Bearer customer').expect(403);
    }
    for (const route of ['/blog/admin/posts', '/works/admin/all']) {
      await request(app.getHttpServer()).get(route).expect(401);
      await request(app.getHttpServer()).get(route).set('Authorization', 'Bearer customer').expect(403);
      await request(app.getHttpServer()).get(route).set('Authorization', 'Bearer admin').expect(200, []);
    }
  });

  it('accepts the work form payload and rejects nested invalid gallery data', async () => {
    const payload = { title: 'Work', description: 'Description', slug: 'test-work',
      carBrand: 'Honda', carModel: 'CRV', year: '2020', duration: '2 дня', categoryId: 1,
      beforeImage: 'works/before.webp', afterImage: 'works/after.webp', featured: false,
      published: true, services: ['Мойка'], images: [{ url: 'works/test.webp', alt: 'Фото', order: 0 }],
    };
    await request(app.getHttpServer()).post('/works').set('Authorization', 'Bearer admin').send(payload).expect(201, { id: 2 });
    await request(app.getHttpServer()).post('/works').set('Authorization', 'Bearer admin').send({ ...payload, images: [{ url: 1 }] }).expect(400);
  });

});
