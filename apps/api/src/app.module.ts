import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard, SecurityGuard } from './auth/guards';
import { MediaModule } from './media/media.module';
import { SeoModule } from './seo/seo.module';
import { RevalidationModule } from './revalidation/revalidation.module';
import { RedirectsModule } from './redirects/redirects.module';
import { SettingsModule } from './settings/settings.module';
import { ContactInfoModule } from './contact-info/contact-info.module';
import { NavigationModule } from './navigation/navigation.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { PagesModule } from './pages/pages.module';
import { EditorialModule } from './editorial/editorial.module';
import { ContactModule } from './contact/contact.module';
import { SiteModule } from './site/site.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppThrottlerGuard } from './common/guards/throttle.guard';
import { requestIdMiddleware } from './common/utils/request-id';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        genReqId: (req: any) => req.id ?? randomUUID(),
        redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', '*.password', '*.currentPassword', '*.newPassword', '*.token', '*.code'],
        autoLogging: { ignore: (req: any) => String(req.url).startsWith('/api/v1/health') },
        transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    EventEmitterModule.forRoot(),
    ConfigModule,
    PrismaModule,
    StorageModule,
    AuditModule,
    SeoModule,
    RevalidationModule,
    RedirectsModule,
    MediaModule,
    AuthModule,
    SettingsModule,
    ContactInfoModule,
    NavigationModule,
    CatalogueModule,
    PagesModule,
    EditorialModule,
    ContactModule,
    SiteModule,
    DashboardModule,
    HealthModule,
    JobsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: SecurityGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes('*');
  }
}
