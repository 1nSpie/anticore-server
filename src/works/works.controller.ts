import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  ParseIntPipe 
} from '@nestjs/common';
import { WorksService } from './works.service';
import { CreateWorkDto, UpdateWorkDto, CreateWorkCategoryDto, UpdateWorkCategoryDto } from './dto/work.dto';

@Controller('works')
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  // Works endpoints
  @Post()
  createWork(@Body() createWorkDto: CreateWorkDto) {
    return this.worksService.createWork(createWorkDto);
  }

  @Get()
  findAllWorks(
    @Query('categoryId') categoryId?: string,
    @Query('featured') featured?: string,
    @Query('published') published?: string
  ) {
    return this.worksService.findAllWorks(
      categoryId ? parseInt(categoryId) : undefined,
      featured ? featured === 'true' : undefined,
      published ? published === 'true' : true // Default to published only
    );
  }

  @Get('stats')
  getWorksStats() {
    return this.worksService.getWorksStats();
  }

  @Get('slug/:slug')
  findWorkBySlug(@Param('slug') slug: string) {
    return this.worksService.findWorkBySlug(slug);
  }

  @Get(':id')
  findWorkById(@Param('id', ParseIntPipe) id: number) {
    return this.worksService.findWorkById(id);
  }

  @Put(':id')
  updateWork(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateWorkDto: UpdateWorkDto
  ) {
    return this.worksService.updateWork(id, updateWorkDto);
  }

  @Delete(':id')
  deleteWork(@Param('id', ParseIntPipe) id: number) {
    return this.worksService.deleteWork(id);
  }

  // Work Categories endpoints
  @Post('categories')
  createWorkCategory(@Body() createCategoryDto: CreateWorkCategoryDto) {
    return this.worksService.createWorkCategory(createCategoryDto);
  }

  @Get('categories/all')
  findAllWorkCategories() {
    return this.worksService.findAllWorkCategories();
  }

  @Get('categories/:id')
  findWorkCategoryById(@Param('id', ParseIntPipe) id: number) {
    return this.worksService.findWorkCategoryById(id);
  }

  @Put('categories/:id')
  updateWorkCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateWorkCategoryDto
  ) {
    return this.worksService.updateWorkCategory(id, updateCategoryDto);
  }

  @Delete('categories/:id')
  deleteWorkCategory(@Param('id', ParseIntPipe) id: number) {
    return this.worksService.deleteWorkCategory(id);
  }
}
