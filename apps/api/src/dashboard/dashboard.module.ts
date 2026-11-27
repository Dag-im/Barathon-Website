import { ContactModule } from '../contact/contact.module';
import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';

@Module({ imports: [ContactModule], controllers: [DashboardController] })
export class DashboardModule {}
