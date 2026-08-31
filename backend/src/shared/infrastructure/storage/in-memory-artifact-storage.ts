import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { ArtifactStorage, StoredArtifact } from './artifact-storage.port';
import { AppError } from '@shared/domain/errors/app-error';

@Injectable()
export class InMemoryArtifactStorage implements ArtifactStorage {
  private readonly storage = new Map<string, { data: Buffer; mimeType: string; checksum: string; size: number }>();

  async upload(key: string, data: Buffer, mimeType: string): Promise<StoredArtifact> {
    const checksum = crypto.createHash('sha256').update(data).digest('hex');
    const size = data.length;
    this.storage.set(key, { data, mimeType, checksum, size });
    return { key, checksum, size, mimeType };
  }

  async download(key: string): Promise<Buffer> {
    const item = this.storage.get(key);
    if (!item) {
      throw AppError.notFound(`Artifact not found: ${key}`);
    }
    return item.data;
  }

  async getSignedUrl(key: string, _expiresInSeconds = 300): Promise<string> {
    const item = this.storage.get(key);
    if (!item) {
      throw AppError.notFound(`Artifact not found: ${key}`);
    }
    return `https://storage.inhire.internal/signed/${key}?token=mock_signed_token`;
  }

  async exists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }
}
