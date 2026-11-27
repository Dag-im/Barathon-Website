import { Module } from '@nestjs/common';
import { ContactInfoAdminController } from './contact-info.controller';

@Module({ controllers: [ContactInfoAdminController] })
export class ContactInfoModule {}
