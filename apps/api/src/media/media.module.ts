import { Global, Module } from '@nestjs/common';
import { MediaAdminController } from './media.controller';
import { MediaService } from './media.service';
import { MediaRefService } from './media.refs';

@Global()
@Module({
  controllers: [MediaAdminController],
  providers: [MediaService, MediaRefService],
  exports: [MediaService, MediaRefService],
})
export class MediaModule {}
