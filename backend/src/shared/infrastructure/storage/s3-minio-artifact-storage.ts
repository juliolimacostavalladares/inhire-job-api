import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import { ArtifactStorage, StoredArtifact } from './artifact-storage.port';
import { AppError } from '@shared/domain/errors/app-error';
import { SanitizedLogger } from '../logger/sanitized-logger.service';

@Injectable()
export class S3MinioArtifactStorage implements ArtifactStorage, OnModuleInit {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly logger?: SanitizedLogger) {
    const endpoint = (process.env.S3_ENDPOINT || 'http://localhost:9004').trim();
    const region = (process.env.S3_REGION || 'us-east-1').trim();
    const accessKeyId = (process.env.S3_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'minioadmin').trim();
    const secretAccessKey = (process.env.S3_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'minioadmin').trim();
    this.bucketName = (process.env.S3_BUCKET || 'inhire-artifacts').trim();

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucketExists();
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
    } catch {
      try {
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
        if (this.logger) {
          this.logger.log({ message: `Bucket '${this.bucketName}' created successfully in MinIO` }, 'S3MinioArtifactStorage');
        }
      } catch (err: unknown) {
        // Bucket may already exist or be created by another replica
      }
    }
  }

  async upload(key: string, data: Buffer, mimeType: string): Promise<StoredArtifact> {
    const checksum = crypto.createHash('sha256').update(data).digest('hex');
    const size = data.length;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: data,
        ContentType: mimeType,
        Metadata: {
          checksum,
        },
      }),
    );

    if (this.logger) {
      this.logger.log({
        operation: 's3_artifact_uploaded',
        bucket: this.bucketName,
        key,
        size,
        mimeType,
      }, 'S3MinioArtifactStorage');
    }

    return { key, checksum, size, mimeType };
  }

  async download(key: string): Promise<Buffer> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      if (!response.Body) {
        throw AppError.notFound(`Artifact body empty for key: ${key}`);
      }

      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      throw AppError.notFound(`Artifact not found in storage: ${key}`);
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
    } catch {
      // Best effort deletion
    }
  }
}
