import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3StorageService {
    private s3Client: S3Client;
    private bucketName: string;
    private endpoint: string;

    constructor(private readonly configService: ConfigService) {
        this.endpoint = this.configService.get<string>('s3.endpoint') || 'http://localhost:9000';
        this.bucketName = this.configService.get<string>('s3.bucketName') || 'jewellery-images';

        this.s3Client = new S3Client({
            endpoint: this.endpoint,
            region: this.configService.get<string>('s3.region') || 'us-east-1',
            credentials: {
                accessKeyId: this.configService.get<string>('s3.accessKey') || 'minioadmin',
                secretAccessKey: this.configService.get<string>('s3.secretKey') || 'minioadmin',
            },
            forcePathStyle: true, // Required for MinIO
        });
    }

    async uploadImage(
        buffer: Buffer,
        mimeType: string,
    ): Promise<{ imageUrl: string; thumbnailUrl: string }> {
        const fileId = uuidv4();
        const extension = this.getExtension(mimeType);

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

        // Upload original
        const originalKey = `uploads/${fileId}.${extension}`;
        await this.s3Client.send(
            new PutObjectCommand({
                Bucket: this.bucketName,
                Key: originalKey,
                Body: processedImage,
                ContentType: 'image/jpeg',
            }),
        );

        // Upload thumbnail
        const thumbnailKey = `thumbnails/${fileId}_thumb.jpg`;
        await this.s3Client.send(
            new PutObjectCommand({
                Bucket: this.bucketName,
                Key: thumbnailKey,
                Body: thumbnail,
                ContentType: 'image/jpeg',
            }),
        );

        const baseUrl = this.endpoint.replace('localhost', '127.0.0.1');

        return {
            imageUrl: `${baseUrl}/${this.bucketName}/${originalKey}`,
            thumbnailUrl: `${baseUrl}/${this.bucketName}/${thumbnailKey}`,
        };
    }

    async deleteImage(imageUrl: string): Promise<void> {
        const key = this.extractKeyFromUrl(imageUrl);
        if (key) {
            await this.s3Client.send(
                new DeleteObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                }),
            );
        }
    }

    private getExtension(mimeType: string): string {
        const map: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
        };
        return map[mimeType] || 'jpg';
    }

    private extractKeyFromUrl(url: string): string | null {
        const match = url.match(/\/([^/]+\/[^/]+)$/);
        return match ? match[1] : null;
    }
}
