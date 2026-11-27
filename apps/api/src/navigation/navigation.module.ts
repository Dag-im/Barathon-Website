import { Module } from '@nestjs/common';
import { MenusAdminController, MenusPublicController } from './navigation.controller';
import { NavigationService } from './navigation.service';

@Module({ controllers: [MenusAdminController, MenusPublicController], providers: [NavigationService], exports: [NavigationService] })
export class NavigationModule {}
