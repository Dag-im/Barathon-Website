import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { APP_CONFIG, AppConfig } from './config/config';
import { loadConfig } from './config/config';

async function bootstrap(): Promise<void> {
  const config: AppConfig = loadConfig();
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1', { exclude: ['api/docs', 'api/docs-json', 'api/v1/openapi.json'] });

  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: false, limit: '64kb' }));
  app.use(cookieParser());
  app.getHttpAdapter().getInstance().set('trust proxy', config.env.TRUST_PROXY);
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: config.isProduction,
    }),
  );
  app.use((_req: unknown, res: { removeHeader: (h: string) => void; setHeader: (h: string, v: string) => void }, next: () => void) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.enableCors({
    origin: config.env.ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'ETag'],
    maxAge: 600,
  });
  app.enableShutdownHooks();

  if (config.env.SWAGGER_ENABLED) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Barathon Trading API').setVersion('0.1.0').addCookieAuth('bt_at').build(),
    );
    SwaggerModule.setup('api/docs', app, doc, { jsonDocumentUrl: 'api/v1/openapi.json' });
  }

  void APP_CONFIG;
  await app.listen(config.env.PORT, '0.0.0.0');
  app.get(Logger).log(`API listening on :${config.env.PORT}`);
}

void bootstrap();
