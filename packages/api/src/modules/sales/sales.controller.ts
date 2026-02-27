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
import { SalesService } from './sales.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';

@Controller('sales')
@UseGuards(RolesGuard)
@Roles(UserType.sales, UserType.admin)
export class SalesController {
    constructor(private readonly salesService: SalesService) {}

    // ─── Dashboard ───

    @Get('dashboard')
    async getDashboard(@CurrentUser() user: User) {
        return this.salesService.getDashboardMetrics(user.id);
    }

    // ─── Quote Request Details ───

    @Get('requests/:id')
    async getRequestDetails(@Param('id') cartId: string) {
        return this.salesService.getQuoteRequestDetails(cartId);
    }

    // ─── Stock Check ───

    @Post('check-stock')
    async checkStock(@Body('skuIds') skuIds: string[]) {
        return this.salesService.checkStockAvailability(skuIds);
    }

    @Get('markup/:category/:sourceType')
    async getMarkup(@Param('category') category: string, @Param('sourceType') sourceType: string) {
        return this.salesService.getApplicableMarkup(category, sourceType);
    }

    // ─── Quotation CRUD ───

    @Post('quotations')
    async createQuotation(
        @Body() body: {
            cartId: string;
            items: Array<{ cartItemId: string; finalUnitPrice: number; notes?: string }>;
            terms: string;
            deliveryTimeline: string;
            paymentTerms: string;
        },
        @CurrentUser() user: User,
    ) {
        return this.salesService.createQuotation(
            body.cartId,
            body.items,
            body.terms,
            body.deliveryTimeline,
            body.paymentTerms,
            user.id,
        );
    }

    @Post('quotations/:id/send')
    async sendQuotation(@Param('id') quotationId: string) {
        return this.salesService.sendQuotation(quotationId);
    }

    @Put('quotations/:id/revise')
    async reviseQuotation(
        @Param('id') quotationId: string,
        @Body() body: { items: Array<{ cartItemId: string; finalUnitPrice: number }>; terms?: string },
    ) {
        return this.salesService.reviseQuotation(quotationId, body.items, body.terms);
    }

    @Post('quotations/:id/extend-expiry')
    async extendQuotationExpiry(@Param('id') quotationId: string, @CurrentUser() user: User) {
        return this.salesService.extendQuotationExpiry(quotationId, user.id);
    }

    // ─── Order Conversion ───

    @Post('quotations/:id/convert-order')
    async convertToOrder(@Param('id') quotationId: string, @CurrentUser() user: User) {
        return this.salesService.convertToOrder(quotationId, user.id);
    }

    // ─── Messages ───

    @Get('requests/:id/messages')
    async getMessages(@Param('id') cartId: string) {
        return this.salesService.getMessages(cartId);
    }

    @Post('requests/:id/messages')
    async sendMessage(
        @Param('id') cartId: string,
        @Body('content') content: string,
        @CurrentUser() user: User,
    ) {
        return this.salesService.sendMessage(cartId, user.id, content);
    }

    // ─── Commission ───

    @Get('commissions')
    async getCommissions(@CurrentUser() user: User) {
        return this.salesService.getCommissionReport(user.id);
    }

    @Get('commissions/structure')
    async getCommissionStructure() {
        return this.salesService.getCommissionStructure();
    }

    @Post('commissions/structure')
    async saveCommissionStructure(
        @Body() body: {
            baseRate: number;
            highValueRate: number;
            highValueThreshold: number;
            paidBonusRate: number;
        },
    ) {
        return this.salesService.saveCommissionStructure(body);
    }

    // ─── Buyer Onboarding ───

    @Get('buyers')
    async getBuyers() {
        return this.salesService.getBuyers();
    }

    @Get('buyers/:id/requests')
    async getBuyerRequests(@Param('id') buyerId: string, @CurrentUser() user: User) {
        return this.salesService.getBuyerRequests(user.id, buyerId);
    }

    // ═══════════════════════════════════════════════════════════════
    // QUOTATION WORKFLOW — Phase 8: Balance & Commission
    // ═══════════════════════════════════════════════════════════════

    @Get('assigned-requests')
    async getAssignedRequests(@CurrentUser() user: User) {
        return this.salesService.getAssignedRequests(user.id);
    }

    @Post('orders/:id/request-balance')
    async requestBalancePayment(@Param('id') orderId: string, @CurrentUser() user: User) {
        return this.salesService.requestBalancePayment(orderId, user.id);
    }

    @Post('orders/:id/payment-link')
    async createPaymentLink(@Param('id') orderId: string, @CurrentUser() user: User) {
        return this.salesService.createOrderPaymentLink(orderId, user.id);
    }

    @Post('quotations/:id/payment-link')
    async createQuotationPaymentLink(@Param('id') quotationId: string, @CurrentUser() user: User) {
        return this.salesService.createQuotationPaymentLink(quotationId, user.id);
    }

    @Post('orders/:id/payment-link/resend')
    async resendPaymentLink(@Param('id') orderId: string, @CurrentUser() user: User) {
        return this.salesService.resendOrderPaymentLink(orderId, user.id);
    }

    @Post('quotations/:id/payment-link/resend')
    async resendQuotationPaymentLink(@Param('id') quotationId: string, @CurrentUser() user: User) {
        return this.salesService.resendQuotationPaymentLink(quotationId, user.id);
    }

    @Get('orders/:id/payment-status')
    async getPaymentStatus(@Param('id') orderId: string, @CurrentUser() user: User) {
        return this.salesService.getOrderPaymentStatus(orderId, user.id);
    }

    @Get('quotations/:id/payment-status')
    async getQuotationPaymentStatus(@Param('id') quotationId: string, @CurrentUser() user: User) {
        return this.salesService.getQuotationPaymentStatus(quotationId, user.id);
    }

    @Post('orders/:id/payment-confirm')
    async confirmPayment(
        @Param('id') orderId: string,
        @Body() body: { source?: string; reference?: string },
        @CurrentUser() user: User,
    ) {
        return this.salesService.confirmOrderPayment(orderId, user.id, body);
    }

    @Post('quotations/:id/payment-confirm')
    async confirmQuotationPayment(
        @Param('id') quotationId: string,
        @Body() body: { source?: string; reference?: string },
        @CurrentUser() user: User,
    ) {
        return this.salesService.confirmQuotationPayment(quotationId, user.id, body);
    }

    @Post('orders/:id/forward-to-ops')
    async forwardPaidOrderToOps(@Param('id') orderId: string, @CurrentUser() user: User) {
        return this.salesService.forwardPaidOrderToOps(orderId, user.id);
    }

    @Post('orders/:id/calculate-commission')
    async calculateCommission(@Param('id') orderId: string) {
        return this.salesService.calculateCommission(orderId);
    }

    @Get('tracker/:cartId')
    async getQuotationTracker(@Param('cartId') cartId: string) {
        return this.salesService.getQuotationTracker(cartId);
    }
}
