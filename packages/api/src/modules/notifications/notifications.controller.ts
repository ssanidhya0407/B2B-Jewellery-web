import { Controller, Get, Param, Post, Query, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
    constructor(private notificationsService: NotificationsService) {}

    @Get()
    async getMyNotifications(
        @Request() req: { user: { id: string } },
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.notificationsService.getForUser(
            req.user.id,
            page ? parseInt(page) : 1,
            limit ? parseInt(limit) : 20,
        );
    }

    @Post(':id/read')
    async markAsRead(@Param('id') id: string, @Request() req: { user: { id: string } }) {
        await this.notificationsService.markAsRead(id, req.user.id);
        return { success: true };
    }

    @Post('read-all')
    async markAllAsRead(@Request() req: { user: { id: string } }) {
        await this.notificationsService.markAllAsRead(req.user.id);
        return { success: true };
    }
}
