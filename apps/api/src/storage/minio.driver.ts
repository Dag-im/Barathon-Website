import { Logger } from '@nestjs/common';
import { Readable } from 'stream';
import * as Minio from 'minio';
import type { AppConfig } from '../config/config';
import type { ObjectStat, StorageDriver } from './storage.driver';

/** MinIO (S3 API) driver. Buckets and the anonymous-read policy for media/* are applied idempotently. */
export class MinioStorageDriver implements StorageDriver {
  private readonly logger = new Logger('MinIO');
  private readonly client: Minio.Client;

  constructor(private readonly config: AppConfig) {
    const env = config.env;
    this.client = new Minio.Client({
      endPoint: env.MINIO_ENDPOINT,
      port: env.MINIO_PORT,
      useSSL: env.MINIO_USE_SSL,
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
      region: env.MINIO_REGION,
    });
  }

  async ensureBuckets(): Promise<void> {
    const { MINIO_BUCKET_PUBLIC: pub, MINIO_BUCKET_PRIVATE: priv } = this.config.env;
    for (const bucket of [pub, priv]) {
      if (!(await this.client.bucketExists(bucket))) {
        await this.client.makeBucket(bucket, this.config.env.MINIO_REGION);
        this.logger.log(`created bucket ${bucket}`);
      }
    }
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${pub}/media/*`],
        },
      ],
    };
    await this.client.setBucketPolicy(pub, JSON.stringify(policy));
  }

  async put(bucket: string, key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.putObject(bucket, key, body, body.length, { 'Content-Type': contentType });
  }

  async remove(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
  }

  async stat(bucket: string, key: string): Promise<ObjectStat | null> {
    try {
      const s = await this.client.statObject(bucket, key);
      return { size: s.size, contentType: (s.metaData?.['content-type'] as string) ?? null };
    } catch {
      return null;
    }
  }

  async read(bucket: string, key: string, start = 0, end?: number): Promise<Readable> {
    if (start === 0 && end === undefined) return this.client.getObject(bucket, key);
    const length = end === undefined ? undefined : end - start + 1;
    return this.client.getPartialObject(bucket, key, start, length);
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.bucketExists(this.config.env.MINIO_BUCKET_PUBLIC);
      return true;
    } catch {
      return false;
    }
  }
}
