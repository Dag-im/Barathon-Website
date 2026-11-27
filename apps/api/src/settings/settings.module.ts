import { Module } from '@nestjs/common';
import { SettingsAdminController, SettingsPublicController, UiStringsAdminController } from './settings.controller';
import { SettingsService, UiStringService } from './settings.service';

@Module({
  controllers: [SettingsAdminController, UiStringsAdminController, SettingsPublicController],
  providers: [SettingsService, UiStringService],
  exports: [SettingsService, UiStringService],
})
export class SettingsModule {}
