import { Readable } from 'stream';

export interface ObjectStat {
  size: number;
  contentType: string | null;
}

/** Minimal object-store contract used by the media pipeline (MinIO in production). */
export interface StorageDriver {
  ensureBuckets(): Promise<void>;
  put(bucket: string, key: string, body: Buffer, contentType: string): Promise<void>;
  remove(bucket: string, key: string): Promise<void>;
  stat(bucket: string, key: string): Promise<ObjectStat | null>;
  /** Streams bytes [start, end] (inclusive); end omitted means "to the end". */
  read(bucket: string, key: string, start?: number, end?: number): Promise<Readable>;
  ping(): Promise<boolean>;
}
