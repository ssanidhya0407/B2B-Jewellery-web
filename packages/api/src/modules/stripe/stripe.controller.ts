import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('stripe')
export class StripeController {
    constructor(private readonly stripeService: StripeService) { }

    /**
     * POST /api/stripe/create-checkout-session
     * Body: { orderId, amount, successUrl, cancelUrl }
     */
    @Post('create-checkout-session')
    async createCheckoutSession(
        @Body() body: { orderId: string; amount: number; successUrl: string; cancelUrl: string },
    ) {
        return this.stripeService.createCheckoutSession(body);
    }

    /**
     * GET /api/stripe/verify-session?session_id=xxx
     * Public so the redirect callback can verify without JWT.
     */
    @Public()
    @Get('verify-session')
    async verifySession(@Query('session_id') sessionId: string) {
        if (!sessionId) {
            return { paid: false, error: 'Missing session_id' };
        }
        return this.stripeService.verifySession(sessionId);
    }
}
