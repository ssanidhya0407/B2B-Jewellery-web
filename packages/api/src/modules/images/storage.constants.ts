/**
 * Injection token for the storage service.
 * Used to abstract Firebase / Local storage behind a single token.
 */
export const STORAGE_SERVICE = 'STORAGE_SERVICE';

export interface StorageService {
    uploadImage(buffer: Buffer, mimeType: string): Promise<{ imageUrl: string; thumbnailUrl: string }>;
    deleteImage?(imageUrl: string): Promise<void>;
}
