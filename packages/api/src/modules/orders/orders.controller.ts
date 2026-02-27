import { Body, Controller, Get, Param, Post, Request } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { SalesService } from '../sales/sales.service';

@Controller('orders')
export class OrdersController {
    constructor(
        private ordersService: OrdersService,
        private salesService: SalesService,
    ) { }

    @Get('my-quotations')
    async getMyQuotations(@Request() req: { user: { id: string } }) {
        return this.ordersService.getMyQuotations(req.user.id);
    }

    @Get('quotations/:id')
    async getQuotation(@Param('id') id: string, @Request() req: { user: { id: string } }) {
        return this.ordersService.getQuotationForBuyer(id, req.user.id);
    }

    @Post('quotations/:id/accept')
    async acceptQuotation(@Param('id') id: string, @Request() req: { user: { id: string } }) {
        return this.ordersService.acceptQuotation(id, req.user.id);
    }

    @Post('quotations/:id/reject')
    async rejectQuotation(
        @Param('id') id: string,
        @Request() req: { user: { id: string } },
        @Body() body: { reason?: string },
    ) {
        return this.ordersService.rejectQuotation(id, req.user.id, body.reason);
    }

    @Get('tracker/:cartId')
    async getQuotationTracker(@Param('cartId') cartId: string) {
        return this.salesService.getQuotationTracker(cartId);
    }

    @Get('tracker/:cartId/messages')
    async getQuotationMessages(@Param('cartId') cartId: string, @Request() req: { user: { id: string } }) {
        return this.ordersService.getQuotationMessages(cartId, req.user.id);
    }

    @Post('tracker/:cartId/messages')
    async sendQuotationMessage(
        @Param('cartId') cartId: string,
        @Request() req: { user: { id: string } },
        @Body('content') content: string,
    ) {
        return this.ordersService.sendQuotationMessage(cartId, req.user.id, content);
    }

    @Get()
    async getMyOrders(@Request() req: { user: { id: string } }) {
        return this.ordersService.getMyOrders(req.user.id);
    }

    @Get(':id')
    async getOrder(@Param('id') id: string, @Request() req: { user: { id: string } }) {
        return this.ordersService.getOrder(id, req.user.id);
    }

    @Get(':id/payment-policy')
    async getPaymentPolicy(@Param('id') id: string, @Request() req: { user: { id: string } }) {
        return this.ordersService.getPaymentPolicy(id, req.user.id);
    }

    @Post(':id/pay')
    async initiatePayment(
        @Param('id') id: string,
        @Request() req: { user: { id: string } },
        @Body() body: { method: 'card' | 'bank_transfer' | 'upi'; amount: number; paymentType?: 'advance' | 'balance'; transactionRef?: string },
    ) {
        return this.ordersService.initiatePayment(id, req.user.id, body);
    }

    @Post('cron/expire-quotations')
    async expireQuotations() {
        return this.ordersService.expireOldQuotations();
    }
}
