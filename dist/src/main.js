"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const path_1 = require("path");
async function bootstrap() {
    const port = process.env.PORT ?? 4444;
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new common_1.ValidationPipe());
    app.enableCors({
        origin: [
            process.env.FRONTEND_BASE_URL ?? "",
            process.env.SERVER_SELECTEL ?? "",
        ],
        credentials: true,
    });
    app.enableCors({
        origin: [
            "https://xn--80aaag6amsblus.xn--p1ai",
            process.env.FRONTEND_BASE_URL ?? "",
            process.env.SERVER_SELECTEL ?? "",
        ],
        methods: "GET,POST,PUT,DELETE",
        credentials: true,
    });
    app.useStaticAssets((0, path_1.join)(__dirname, "..", "public"), {
        prefix: "/static/",
    });
    app.set("trust proxy", true);
    await app.listen(port);
}
bootstrap().catch((err) => console.error(err));
//# sourceMappingURL=main.js.map