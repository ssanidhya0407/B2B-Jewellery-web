import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
    private stripe: Stripe | null = null;

    constructor(private configService: ConfigService) {
        const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
        if (!secretKey) {
            console.warn('⚠️  STRIPE_SECRET_KEY is not set – Stripe endpoints will fail.');
        } else {
            this.stripe = new Stripe(secretKey, { apiVersion: '2025-04-30.basil' as any });
        }
    }

    private getStripe(): Stripe {
        if (!this.stripe) {
            throw new BadRequestException('Stripe is not configured. Set STRIPE_SECRET_KEY in your .env file.');
        }
        return this.stripe;
    }

    async createCheckoutSession(input: {
        orderId: string;
        amount: number;
        successUrl: string;
        cancelUrl: string;
        customerEmail?: string;
    }) {
        if (!input.amount || input.amount <= 0) {
            throw new BadRequestException('Amount must be greater than 0');
        }

        const session = await this.getStripe().checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            customer_email: input.customerEmail || undefined,
            line_items: [
                {
                    price_data: {
                        currency: 'inr',
                        product_data: {
                            name: `Order ${input.orderId.slice(0, 8)}`,
                            description: `Payment for B2B Jewellery order`,
                        },
                        unit_amount: Math.round(input.amount * 100), // Stripe uses paise
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                orderId: input.orderId,
            },
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
        });

        return {
            sessionId: session.id,
            url: session.url,
        };
    }

    async verifySession(sessionId: string) {
        const session = await this.getStripe().checkout.sessions.retrieve(sessionId);

        const paid =
            session.payment_status === 'paid' ||
            session.status === 'complete';

        return {
            paid,
            sessionId: session.id,
            amount: (session.amount_total || 0) / 100,
            paymentIntentId:
                typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : session.payment_intent?.id || null,
            orderId: session.metadata?.orderId || null,
        };
    }
}
