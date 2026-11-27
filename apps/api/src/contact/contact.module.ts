import { SettingsModule } from '../settings/settings.module';
import { Module } from '@nestjs/common';
import { ContactPublicController, MessagesAdminController } from './contact.controller';
import { ContactService } from './contact.service';

@Module({ imports: [SettingsModule], controllers: [ContactPublicController, MessagesAdminController], providers: [ContactService], exports: [ContactService] })
export class ContactModule {}
