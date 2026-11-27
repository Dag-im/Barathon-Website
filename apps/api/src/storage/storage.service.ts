import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { AppConfig, APP_CONFIG } from '../config/config';
import { MinioStorageDriver } from './minio.driver';
import type { StorageDriver } from './storage.driver';

/** Facade over the configured object store. Tests swap the driver for an in-memory one. */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger('Storage');
  private driver: StorageDriver;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.driver = new MinioStorageDriver(config);
  }

  setDriver(driver: StorageDriver): void {
    this.driver = driver;
  }

  get bucketPublic(): string {
    return this.config.env.MINIO_BUCKET_PUBLIC;
  }

  get bucketPrivate(): string {
    return this.config.env.MINIO_BUCKET_PRIVATE;
  }

  async onModuleInit(): Promise<void> {
    if (this.config.env.NODE_ENV === 'test') return;
    try {
      await this.driver.ensureBuckets();
    } catch (err) {
      this.logger.warn(`bucket initialisation failed: ${(err as Error).message}`);
    }
  }

  get raw(): StorageDriver {
    return this.driver;
  }

  ping(): Promise<boolean> {
    return this.driver.ping().catch(() => false);
  }
}
