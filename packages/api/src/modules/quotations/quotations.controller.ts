import {
    Controller,
    Get,
    Post,
    Put,
    Param,
    Body,
    UseGuards,
} from '@nestjs/common';
import { User, UserType } from '@prisma/client';
import { QuotationsService } from './quotations.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';

@Controller('internal/quotations')
@UseGuards(RolesGuard)
@Roles(UserType.sales, UserType.admin, UserType.operations)
export class QuotationsController {
    constructor(private readonly quotationsService: QuotationsService) { }

    @Get('requests')
    async listRequests() {
        return this.quotationsService.getSubmittedRequests();
    }

    @Get('requests/:id')
    async getRequest(@Param('id') cartId: string) {
        return this.quotationsService.getRequestDetails(cartId);
    }

    @Put('requests/:id/status')
    async updateStatus(
        @Param('id') cartId: string,
        @Body('status') status: string,
    ) {
        return this.quotationsService.updateRequestStatus(cartId, status);
    }

    @Post()
    async createQuotation(
        @Body() body: { cartId: string; items: Array<{ cartItemId: string; finalUnitPrice: number }> },
        @CurrentUser() user: User,
    ) {
        return this.quotationsService.create(body.cartId, body.items, user.id);
    }

    @Put(':id')
    async updateQuotation(
        @Param('id') quotationId: string,
        @Body() body: { items?: Array<{ cartItemId: string; finalUnitPrice: number }>; terms?: string },
    ) {
        return this.quotationsService.update(quotationId, body);
    }

    @Post(':id/send')
    async sendQuotation(@Param('id') quotationId: string) {
        return this.quotationsService.send(quotationId);
    }
}
