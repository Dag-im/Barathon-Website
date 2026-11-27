import { Module } from '@nestjs/common';
import { BrandsAdminController, BrandsPublicController, BrandsService } from './brands';
import { CategoriesAdminController, CategoriesPublicController, CategoriesService } from './categories';
import { ProductsAdminController, ProductsPublicController, ProductsService } from './products';
import { ProductsReadService } from './products.read';
import { ServicesAdminController, ServicesPublicController, ServicesService } from './services';
import { SubsidiariesAdminController, SubsidiariesPublicController, SubsidiariesService } from './subsidiaries';
import { VideosAdminController, VideosPublicController, VideosService } from './videos';
import { VideosReadService } from './videos.read';

@Module({
  controllers: [
    BrandsAdminController,
    BrandsPublicController,
    CategoriesAdminController,
    CategoriesPublicController,
    ProductsAdminController,
    ProductsPublicController,
    ServicesAdminController,
    ServicesPublicController,
    SubsidiariesAdminController,
    SubsidiariesPublicController,
    VideosAdminController,
    VideosPublicController,
  ],
  providers: [BrandsService, CategoriesService, ProductsService, ProductsReadService, ServicesService, SubsidiariesService, VideosService, VideosReadService],
  exports: [BrandsService, CategoriesService, ProductsService, ProductsReadService, ServicesService, SubsidiariesService, VideosService, VideosReadService],
})
export class CatalogueModule {}
