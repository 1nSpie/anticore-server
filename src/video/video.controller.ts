// src/video/video.controller.ts
import { Controller, Get, Req, Res, HttpStatus } from "@nestjs/common";
import { Request, Response } from "express";
import { createReadStream, Stats } from "fs";
import { statSync } from "fs";
import { join } from "path";

@Controller("video")
export class VideoController {
  @Get(":filename")
  streamVideo(@Req() req: Request, @Res() res: Response) {
    const filename = req.params.filename;

    // Validate file extension and determine content type
    const getContentType = (filename: string) => {
      const ext = filename.toLowerCase().split(".").pop();
      switch (ext) {
        case "mp4":
          return "video/mp4";
        case "webm":
          return "video/webm";
        case "ogg":
          return "video/ogg";
        default:
          return null;
      }
    };

    const contentType = getContentType(filename);
    if (!contentType) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send("Unsupported video format");
    }

    const filePath = join(process.cwd(), "public", "video", filename);
    let videoStats: Stats;
    try {
      videoStats = statSync(filePath);
    } catch {
      return res.status(HttpStatus.NOT_FOUND).send("Видео не найдено");
    }

    const fileSize = videoStats?.size;
    const range = req.headers.range;

    // Обработка закрытия соединения клиентом
    req.on("close", () => {
      // Соединение закрыто, ничего не делаем - поток автоматически закроется
    });

    if (!range) {
      // Полная загрузка
      res.header({
        "Content-Type": contentType,
        "Content-Length": fileSize,
      });

      const stream = createReadStream(filePath);

      stream.on("error", (error) => {
        if (!res.headersSent) {
          res
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .send("Ошибка чтения видео");
        }
      });

      stream.pipe(res);

      // Закрываем поток при закрытии ответа
      res.on("close", () => {
        if (!stream.destroyed) {
          stream.destroy();
        }
      });

      return;
    }

    // Обработка Range
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      return res
        .status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
        .header("Content-Range", `bytes */${fileSize}`)
        .send("Requested range not satisfiable");
    }

    const chunkSize = end - start + 1;

    res.header({
      "Content-Type": contentType,
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Cache-Control": "public, max-age=31536000",
    });

    res.status(HttpStatus.PARTIAL_CONTENT);

    const stream = createReadStream(filePath, { start, end });

    stream.on("error", (error) => {
      if (!res.headersSent) {
        res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .send("Ошибка чтения видео");
      }
    });

    stream.pipe(res);

    // Закрываем поток при закрытии ответа
    res.on("close", () => {
      if (!stream.destroyed) {
        stream.destroy();
      }
    });
  }
}
