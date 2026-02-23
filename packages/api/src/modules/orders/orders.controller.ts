import { Body, Controller, Get, Param, Post, Request } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { SalesService } from '../sales/sales.service';

@Controller('orders')
export class OrdersController {
    constructor(
        private ordersService: OrdersService,
        private salesService: SalesService,
    ) {}

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

    @Get()
    async getMyOrders(@Request() req: { user: { id: string } }) {
        return this.ordersService.getMyOrders(req.user.id);
    }

    @Get(':id')
    async getOrder(@Param('id') id: string, @Request() req: { user: { id: string } }) {
        return this.ordersService.getOrder(id, req.user.id);
    }

    @Post(':id/pay')
    async initiatePayment(
        @Param('id') id: string,
        @Request() req: { user: { id: string } },
        @Body() body: { method: 'card' | 'bank_transfer' | 'upi'; amount: number; transactionRef?: string },
    ) {
        return this.ordersService.initiatePayment(id, req.user.id, body);
    }

    @Post('cron/expire-quotations')
    async expireQuotations() {
        return this.ordersService.expireOldQuotations();
    }
}
