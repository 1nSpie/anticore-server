import { ContentAdminGuard } from "../media/content-admin.guard";
import { CreateWorkDto, UpdateWorkDto } from "./dto/work.dto";
import {
  Controller,
  Get,
  Post,
  Patch,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from "@nestjs/common";
import { WorksService } from "./works.service";

@Controller("works")
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  @Get("admin/all")
  @UseGuards(ContentAdminGuard)
  adminWorks() {
    return this.worksService.findAllWorks();
  }

  @Post()
  @UseGuards(ContentAdminGuard)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  create(@Body() dto: CreateWorkDto) {
    return this.worksService.createWork(dto);
  }

  @Patch(":id")
  @UseGuards(ContentAdminGuard)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateWorkDto) {
    return this.worksService.updateWork(id, dto);
  }

  @Delete(":id")
  @UseGuards(ContentAdminGuard)
  delete(@Param("id", ParseIntPipe) id: number) {
    return this.worksService.deleteWork(id);
  }

  @Get()
  findAllWorks(
    @Query("categoryId") categoryId?: string,
    @Query("featured") featured?: string,
    @Query("published") published?: string,
  ) {
    return this.worksService.findAllWorks(
      categoryId ? parseInt(categoryId) : undefined,
      featured ? featured === "true" : undefined,
      true, // Public endpoint never exposes drafts
    );
  }

  @Get("stats")
  getWorksStats() {
    return this.worksService.getWorksStats();
  }

  @Get("slug/:slug")
  findWorkBySlug(@Param("slug") slug: string) {
    return this.worksService.findWorkBySlug(slug);
  }

  @Get(":id")
  findWorkById(@Param("id", ParseIntPipe) id: number) {
    return this.worksService.findWorkById(id);
  }

  @Get("categories/all")
  findAllWorkCategories() {
    return this.worksService.findAllWorkCategories();
  }

  @Get("categories/:id")
  findWorkCategoryById(@Param("id", ParseIntPipe) id: number) {
    return this.worksService.findWorkCategoryById(id);
  }
}
