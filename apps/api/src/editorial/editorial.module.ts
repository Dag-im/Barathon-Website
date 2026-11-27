
import { Module } from '@nestjs/common';
import {
  FaqAdminController,
  FaqPublicController,
  FaqService,
  PostCategoriesAdminController,
  PostCategoriesPublicController,
  PostsAdminController,
  PostsPublicController,
  PostsService,
  TagsAdminController,
  TestimonialsAdminController,
  TestimonialsPublicController,
  TestimonialsService,
} from './editorial';

@Module({
  imports: [],
  controllers: [
    PostsAdminController,
    PostsPublicController,
    PostCategoriesAdminController,
    PostCategoriesPublicController,
    TagsAdminController,
    TestimonialsAdminController,
    TestimonialsPublicController,
    FaqAdminController,
    FaqPublicController,
  ],
  providers: [PostsService, TestimonialsService, FaqService],
  exports: [PostsService, FaqService],
})
export class EditorialModule {}
