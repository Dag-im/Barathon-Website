import { Readable } from 'stream';
import type { ObjectStat, StorageDriver } from './storage.driver';

/** In-memory object store for unit and e2e tests. */
export class MemoryStorageDriver implements StorageDriver {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();
  failWrites = false;

  private id(bucket: string, key: string): string {
    return `${bucket}/${key}`;
  }

  async ensureBuckets(): Promise<void> {}

  async put(bucket: string, key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.failWrites) throw new Error('storage unavailable');
    this.objects.set(this.id(bucket, key), { body, contentType });
  }

  async remove(bucket: string, key: string): Promise<void> {
    this.objects.delete(this.id(bucket, key));
  }

  async stat(bucket: string, key: string): Promise<ObjectStat | null> {
    const o = this.objects.get(this.id(bucket, key));
    return o ? { size: o.body.length, contentType: o.contentType } : null;
  }

  async read(bucket: string, key: string, start = 0, end?: number): Promise<Readable> {
    const o = this.objects.get(this.id(bucket, key));
    if (!o) throw new Error('NoSuchKey');
    return Readable.from([o.body.subarray(start, end === undefined ? undefined : end + 1)]);
  }

  async ping(): Promise<boolean> {
    return !this.failWrites;
  }
}
