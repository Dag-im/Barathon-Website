import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/access.decorators';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (database and object storage)' })
  async ready() {
    const [db, storage] = await Promise.all([this.prisma.ping(), this.storage.ping()]);
    const info = { database: db ? 'up' : 'down', storage: storage ? 'up' : 'down' };
    if (!db || !storage) {
      throw new HttpException({ code: 'NOT_READY', message: 'Not ready', status: 'error', info }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { status: 'ok', info };
  }
}
