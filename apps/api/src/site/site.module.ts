import { CatalogueModule } from '../catalogue/catalogue.module';
import { SettingsModule } from '../settings/settings.module';
import { NavigationModule } from '../navigation/navigation.module';
import { Module } from '@nestjs/common';
import { SiteController, SiteService } from './site.controller';

@Module({ imports: [CatalogueModule, SettingsModule, NavigationModule], controllers: [SiteController], providers: [SiteService] })
export class SiteModule {}
