import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { BlogService } from './blog.service';
import {
  CreateBlogPostDto,
  UpdateBlogPostDto,
  CreateCategoryDto,
  CreateTagDto,
  BlogQueryDto,
} from './dto/blog.dto';

@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  // Blog Posts Endpoints
  @Post('posts')
  @UsePipes(new ValidationPipe({ transform: true }))
  createPost(@Body() createPostDto: CreateBlogPostDto) {
    return this.blogService.createPost(createPostDto);
  }

  @Get('posts')
  @UsePipes(new ValidationPipe({ transform: true }))
  findAllPosts(@Query() query: BlogQueryDto) {
    return this.blogService.findAllPosts(query);
  }

  @Get('posts/featured')
  getFeaturedPost() {
    return this.blogService.getFeaturedPost();
  }

  @Get('posts/:id')
  findPostById(@Param('id', ParseIntPipe) id: number) {
    return this.blogService.findPostById(id);
  }

  @Get('posts/slug/:slug')
  findPostBySlug(@Param('slug') slug: string) {
    return this.blogService.findPostBySlug(slug);
  }

  @Get('posts/:id/related')
  async getRelatedPosts(@Param('id', ParseIntPipe) id: number) {
    const post = await this.blogService.findPostById(id);
    return this.blogService.getRelatedPosts(id, post.categoryId);
  }

  @Patch('posts/:id')
  @UsePipes(new ValidationPipe({ transform: true }))
  updatePost(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdateBlogPostDto,
  ) {
    return this.blogService.updatePost(id, updatePostDto);
  }

  @Delete('posts/:id')
  deletePost(@Param('id', ParseIntPipe) id: number) {
    return this.blogService.deletePost(id);
  }

  // Categories Endpoints
  @Post('categories')
  @UsePipes(new ValidationPipe({ transform: true }))
  createCategory(@Body() createCategoryDto: CreateCategoryDto) {
    return this.blogService.createCategory(createCategoryDto);
  }

  @Get('categories')
  findAllCategories() {
    return this.blogService.findAllCategories();
  }

  @Get('categories/:id')
  findCategoryById(@Param('id', ParseIntPipe) id: number) {
    return this.blogService.findCategoryById(id);
  }

  // Tags Endpoints
  @Post('tags')
  @UsePipes(new ValidationPipe({ transform: true }))
  createTag(@Body() createTagDto: CreateTagDto) {
    return this.blogService.createTag(createTagDto);
  }

  @Get('tags')
  findAllTags() {
    return this.blogService.findAllTags();
  }

  // Statistics Endpoint
  @Get('stats')
  getStats() {
    return this.blogService.getStats();
  }
}
