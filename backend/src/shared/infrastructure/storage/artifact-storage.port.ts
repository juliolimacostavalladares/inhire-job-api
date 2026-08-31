export interface StoredArtifact {
  key: string;
  checksum: string;
  size: number;
  mimeType: string;
}

export interface ArtifactStorage {
  upload(key: string, data: Buffer, mimeType: string): Promise<StoredArtifact>;
  download(key: string): Promise<Buffer>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

export const ARTIFACT_STORAGE_PORT = Symbol('ArtifactStorage');
