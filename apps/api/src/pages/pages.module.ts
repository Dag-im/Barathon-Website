import { CatalogueModule } from '../catalogue/catalogue.module';
import { SettingsModule } from '../settings/settings.module';
import { Module } from '@nestjs/common';
import { BlockTypesController, PagesAdminController, PagesPublicController } from './pages.controller';
import { PagesService } from './pages.service';
import { BlocksResolver } from './blocks.resolver';

@Module({
  imports: [CatalogueModule, SettingsModule],
  controllers: [PagesAdminController, BlockTypesController, PagesPublicController],
  providers: [PagesService, BlocksResolver],
  exports: [PagesService, BlocksResolver],
})
export class PagesModule {}
