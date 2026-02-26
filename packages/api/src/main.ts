import * as path from 'path';
import { config } from 'dotenv';

// Load .env from the monorepo root BEFORE NestJS bootstrap
// so that process.env.DATABASE_URL is available when PrismaService is constructed
config({ path: path.resolve(__dirname, '../../../.env') });
config({ path: path.resolve(__dirname, '../../.env') });
config(); // also try local .env

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // Global prefix
    app.setGlobalPrefix('api');

    // Serve locally-stored uploads at /uploads (no api prefix)
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    app.useStaticAssets(uploadsDir, { prefix: '/uploads' });
    // CORS configuration
    app.enableCors({
        origin: [
            process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000',
        ],
        credentials: true,
    });

    // Validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    const port = process.env.PORT || 3001;
    await app.listen(port);

    console.log(`🚀 API Server running on http://localhost:${port}`);
    console.log(`📚 API Base URL: http://localhost:${port}/api`);
}

bootstrap();
