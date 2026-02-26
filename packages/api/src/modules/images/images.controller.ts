import { Controller, Get, Param, Post, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators';
import { ImagesService } from './images.service';

@Controller('images')
export class ImagesController {
    constructor(private readonly imagesService: ImagesService) {}

    @Post('upload')
    @UseInterceptors(FileInterceptor('image'))
    async uploadImage(
        @CurrentUser() user: User,
        @UploadedFile() file: Express.Multer.File,
        @Body('category') category?: string,
        @Body('context') context?: string,
        @Body('maxUnitPrice') maxUnitPrice?: string,
    ) {
        return this.imagesService.createSession(user.id, {
            category,
            context,
            maxUnitPrice: maxUnitPrice ? Number(maxUnitPrice) : undefined,
            imageUrl: file ? '/product-images/other-01.jpg' : undefined,
        });
    }

    @Post('feature-suggestions')
    @UseInterceptors(FileInterceptor('image'))
    async featureSuggestions(
        @UploadedFile() _file: Express.Multer.File,
        @Body('category') category?: string,
        @Body('context') context?: string,
    ) {
        return this.imagesService.suggestFeatures({ category, context });
    }

    @Get('session/:sessionId')
    async getSession(@Param('sessionId') sessionId: string, @CurrentUser() user: User) {
        return this.imagesService.getSession(sessionId, user.id);
    }

    @Get('sessions')
    async getSessions(@CurrentUser() user: User) {
        return this.imagesService.getSessions(user.id);
    }
}
