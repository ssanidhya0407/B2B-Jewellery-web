import {
    Controller,
    Post,
    Get,
    Param,
    UseInterceptors,
    UploadedFile,
    ParseFilePipe,
    MaxFileSizeValidator,
    FileTypeValidator,
    Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { User } from '@prisma/client';
import { ImagesService } from './images.service';
import { CurrentUser } from '../../common/decorators';
import { UploadImageDto } from './dto/upload-image.dto';

@Controller('images')
export class ImagesController {
    constructor(private readonly imagesService: ImagesService) { }

    @Post('upload')
    @UseInterceptors(FileInterceptor('image'))
    async uploadImage(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
                    new FileTypeValidator({ fileType: /(jpeg|jpg|png|webp)$/i }),
                ],
            }),
        )
        file: Express.Multer.File,
        @CurrentUser() user: User,
        @Body() body: UploadImageDto,
    ) {
        const session = await this.imagesService.processUpload(
            file,
            user.id,
            body.category,
            body.maxUnitPrice,
            body.context,
        );

        return {
            sessionId: session.id,
            status: session.sessionStatus,
            message: 'Image uploaded and processing started',
        };
    }

    @Get('session/:id')
    async getSession(@Param('id') sessionId: string, @CurrentUser() user: User) {
        return this.imagesService.getSessionWithDetails(sessionId, user.id);
    }

    @Get('sessions')
    async getUserSessions(@CurrentUser() user: User) {
        return this.imagesService.getUserSessions(user.id);
    }
}
