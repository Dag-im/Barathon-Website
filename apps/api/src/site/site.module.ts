import { CatalogueModule } from '../catalogue/catalogue.module';
import { SettingsModule } from '../settings/settings.module';
import { NavigationModule } from '../navigation/navigation.module';
import { Module } from '@nestjs/common';
import { SiteController, SiteService } from './site.controller';
import { PublicAliasesController } from './aliases.controller';
import { PagesModule } from '../pages/pages.module';
import { EditorialModule } from '../editorial/editorial.module';

@Module({ imports: [CatalogueModule, SettingsModule, NavigationModule, PagesModule, EditorialModule], controllers: [SiteController, PublicAliasesController], providers: [SiteService] })
export class SiteModule {}
