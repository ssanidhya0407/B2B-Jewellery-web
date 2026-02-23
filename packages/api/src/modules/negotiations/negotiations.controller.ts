import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    UseGuards,
} from '@nestjs/common';
import { User, UserType } from '@prisma/client';
import { NegotiationsService } from './negotiations.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';

// ─── Internal (Sales / Admin / Ops) endpoints ────────────────────────────

@Controller('internal/negotiations')
@UseGuards(RolesGuard)
@Roles(UserType.sales, UserType.admin, UserType.operations)
export class NegotiationsInternalController {
    constructor(private readonly negotiationsService: NegotiationsService) { }

    /** Open negotiation on a sent quotation */
    @Post('open')
    async openNegotiation(
        @Body() body: { quotationId: string; note?: string },
        @CurrentUser() user: User,
    ) {
        return this.negotiationsService.openNegotiation(body.quotationId, user.id, body.note);
    }

    /** Get negotiation by quotation ID */
    @Get('quotation/:quotationId')
    async getByQuotationId(@Param('quotationId') quotationId: string) {
        return this.negotiationsService.getByQuotationId(quotationId);
    }

    /** Get negotiation by its own ID */
    @Get(':id')
    async getById(@Param('id') id: string) {
        return this.negotiationsService.getById(id);
    }

    /** Sales submits counter-offer */
    @Post(':id/counter')
    async submitCounterOffer(
        @Param('id') negotiationId: string,
        @CurrentUser() user: User,
        @Body() body: {
            items: Array<{ cartItemId: string; proposedUnitPrice: number; quantity: number }>;
            message?: string;
        },
    ) {
        return this.negotiationsService.submitCounterOffer(
            negotiationId, user.id, user.userType, body,
        );
    }

    /** Sales accepts negotiation */
    @Post(':id/accept')
    async acceptNegotiation(
        @Param('id') negotiationId: string,
        @CurrentUser() user: User,
    ) {
        return this.negotiationsService.acceptNegotiation(negotiationId, user.id, user.userType);
    }

    /** Sales closes/rejects negotiation */
    @Post(':id/close')
    async closeNegotiation(
        @Param('id') negotiationId: string,
        @CurrentUser() user: User,
        @Body() body: { reason?: string },
    ) {
        return this.negotiationsService.closeNegotiation(negotiationId, user.id, user.userType, body.reason);
    }
}

// ─── Buyer endpoints ──────────────────────────────────────────────────────

@Controller('negotiations')
export class NegotiationsBuyerController {
    constructor(private readonly negotiationsService: NegotiationsService) { }

    /** Buyer gets negotiation for a quotation */
    @Get('quotation/:quotationId')
    async getForBuyer(
        @Param('quotationId') quotationId: string,
        @CurrentUser() user: User,
    ) {
        return this.negotiationsService.getForBuyer(quotationId, user.id);
    }

    /** Buyer submits counter-offer */
    @Post(':id/counter')
    async submitCounterOffer(
        @Param('id') negotiationId: string,
        @CurrentUser() user: User,
        @Body() body: {
            items: Array<{ cartItemId: string; proposedUnitPrice: number; quantity: number }>;
            message?: string;
        },
    ) {
        return this.negotiationsService.submitCounterOffer(
            negotiationId, user.id, user.userType, body,
        );
    }

    /** Buyer accepts negotiation */
    @Post(':id/accept')
    async acceptNegotiation(
        @Param('id') negotiationId: string,
        @CurrentUser() user: User,
    ) {
        return this.negotiationsService.acceptNegotiation(negotiationId, user.id, user.userType);
    }

    /** Buyer closes/walks away from negotiation */
    @Post(':id/close')
    async closeNegotiation(
        @Param('id') negotiationId: string,
        @CurrentUser() user: User,
        @Body() body: { reason?: string },
    ) {
        return this.negotiationsService.closeNegotiation(negotiationId, user.id, user.userType, body.reason);
    }
}
