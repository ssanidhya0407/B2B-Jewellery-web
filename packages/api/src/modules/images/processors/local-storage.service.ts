import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Stores images on the local filesystem and serves them via the API's
 * static-file route.  Used as a zero-config fallback when Firebase
 * credentials are not available (demo / local-dev mode).
 */
@Injectable()
export class LocalStorageService {
    private readonly uploadDir: string;
    private readonly baseUrl: string;

    constructor(private readonly configService: ConfigService) {
        // Store uploads next to the API source root
        this.uploadDir = path.resolve(process.cwd(), 'uploads');
        fs.mkdirSync(path.join(this.uploadDir, 'images'), { recursive: true });
        fs.mkdirSync(path.join(this.uploadDir, 'thumbnails'), { recursive: true });

        const port = this.configService.get<number>('port') || 3001;
        this.baseUrl = `http://localhost:${port}/uploads`;
        console.log(`📁 Local storage: files saved to ${this.uploadDir}, served at ${this.baseUrl}`);
    }

    async uploadImage(
        buffer: Buffer,
        _mimeType: string,
    ): Promise<{ imageUrl: string; thumbnailUrl: string }> {
        const fileId = uuidv4();

        // Process & write original
        const processed = await sharp(buffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();

        const imagePath = path.join(this.uploadDir, 'images', `${fileId}.jpg`);
        fs.writeFileSync(imagePath, processed);

        // Process & write thumbnail
        const thumb = await sharp(buffer)
            .resize(300, 300, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toBuffer();

        const thumbPath = path.join(this.uploadDir, 'thumbnails', `${fileId}_thumb.jpg`);
        fs.writeFileSync(thumbPath, thumb);

        return {
            imageUrl: `${this.baseUrl}/images/${fileId}.jpg`,
            thumbnailUrl: `${this.baseUrl}/thumbnails/${fileId}_thumb.jpg`,
        };
    }

    async deleteImage(imageUrl: string): Promise<void> {
        const match = imageUrl.match(/\/uploads\/(images|thumbnails)\/(.+)$/);
        if (!match) return;
        const filePath = path.join(this.uploadDir, match[1], match[2]);
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }
}
