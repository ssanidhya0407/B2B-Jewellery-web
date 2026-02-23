import { Controller, Get, Post, Param } from '@nestjs/common';
import { User } from '@prisma/client';
import { RecommendationsService } from './recommendations.service';
import { CurrentUser } from '../../common/decorators';

@Controller('recommendations')
export class RecommendationsController {
    constructor(private readonly recommendationsService: RecommendationsService) { }

    @Get(':sessionId')
    async getRecommendations(
        @Param('sessionId') sessionId: string,
        @CurrentUser() user: User,
    ): Promise<unknown> {
        return this.recommendationsService.getRecommendations(sessionId, user.id);
    }

    @Post(':sessionId/regenerate')
    async regenerateRecommendations(
        @Param('sessionId') sessionId: string,
        @CurrentUser() user: User,
    ): Promise<unknown> {
        return this.recommendationsService.regenerateRecommendations(sessionId, user.id);
    }
}
