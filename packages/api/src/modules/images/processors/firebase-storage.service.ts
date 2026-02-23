import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

function requiredEnv(value: string | undefined, name: string): string {
    if (!value) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}

@Injectable()
export class FirebaseStorageService {
    private readonly bucketName: string;

    constructor(private readonly configService: ConfigService) {
        this.bucketName = requiredEnv(
            this.configService.get<string>('firebase.storageBucket') ||
            this.configService.get<string>('FIREBASE_STORAGE_BUCKET'),
            'FIREBASE_STORAGE_BUCKET',
        );

        const projectId =
            this.configService.get<string>('firebase.projectId') ||
            this.configService.get<string>('FIREBASE_PROJECT_ID');
        const clientEmail =
            this.configService.get<string>('firebase.clientEmail') ||
            this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
        const privateKeyRaw =
            this.configService.get<string>('firebase.privateKey') ||
            this.configService.get<string>('FIREBASE_PRIVATE_KEY');

        // Allow using Application Default Credentials (e.g., GOOGLE_APPLICATION_CREDENTIALS)
        // by omitting explicit service account vars.
        const hasServiceAccount = Boolean(projectId && clientEmail && privateKeyRaw);

        if (getApps().length === 0) {
            if (hasServiceAccount) {
                const privateKey = privateKeyRaw!.replace(/\\n/g, '\n');
                initializeApp({
                    credential: cert({
                        projectId,
                        clientEmail,
                        privateKey,
                    }),
                    storageBucket: this.bucketName,
                });
            } else {
                initializeApp({
                    storageBucket: this.bucketName,
                });
            }
        }
    }

    async uploadImage(
        buffer: Buffer,
        mimeType: string,
    ): Promise<{ imageUrl: string; thumbnailUrl: string }> {
        const fileId = uuidv4();

        // Process original image (resize if too large)
        const processedImage = await sharp(buffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();

        // Create thumbnail
        const thumbnail = await sharp(buffer)
            .resize(300, 300, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toBuffer();

        const imageToken = uuidv4();
        const thumbnailToken = uuidv4();

        const originalPath = `uploads/${fileId}.jpg`;
        const thumbnailPath = `thumbnails/${fileId}_thumb.jpg`;

        await this.uploadBuffer(originalPath, processedImage, 'image/jpeg', imageToken);
        await this.uploadBuffer(thumbnailPath, thumbnail, 'image/jpeg', thumbnailToken);

        return {
            imageUrl: this.buildDownloadUrl(originalPath, imageToken),
            thumbnailUrl: this.buildDownloadUrl(thumbnailPath, thumbnailToken),
        };
    }

    async deleteImage(imageUrl: string): Promise<void> {
        const objectPath = this.extractObjectPathFromDownloadUrl(imageUrl);
        if (!objectPath) return;

        const bucket = getStorage().bucket(this.bucketName);
        await bucket.file(objectPath).delete({ ignoreNotFound: true });
    }

    private async uploadBuffer(
        objectPath: string,
        data: Buffer,
        contentType: string,
        downloadToken: string,
    ): Promise<void> {
        const bucket = getStorage().bucket(this.bucketName);
        const file = bucket.file(objectPath);

        await file.save(data, {
            resumable: false,
            contentType,
            metadata: {
                metadata: {
                    // Used by Firebase Storage to create stable download URLs
                    firebaseStorageDownloadTokens: downloadToken,
                },
            },
        });
    }

    private buildDownloadUrl(objectPath: string, token: string): string {
        // Firebase Storage download URL format
        return `https://firebasestorage.googleapis.com/v0/b/${this.bucketName}/o/${encodeURIComponent(
            objectPath,
        )}?alt=media&token=${token}`;
    }

    private extractObjectPathFromDownloadUrl(url: string): string | null {
        // Matches: .../o/<encodedPath>?...
        const match = url.match(/\/o\/([^?]+)/);
        if (!match) return null;
        try {
            return decodeURIComponent(match[1]);
        } catch {
            return null;
        }
    }
}
