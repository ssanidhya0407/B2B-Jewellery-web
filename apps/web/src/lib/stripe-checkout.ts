import { loadStripe } from '@stripe/stripe-js';

type StartStripeCheckoutInput = {
    orderId: string;
    amount: number;
    successUrl: string;
    cancelUrl: string;
};

type StripeVerifyResult = {
    paid: boolean;
    amount?: number;
    sessionId?: string;
    paymentIntentId?: string;
};

export async function startStripeCheckout(input: StartStripeCheckoutInput): Promise<void> {
    const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(String((data as { message?: string })?.message || 'Unable to start Stripe checkout'));
    }

    const sessionId = String((data as { sessionId?: string })?.sessionId || '');
    if (!sessionId) {
        throw new Error('Stripe session was not created.');
    }

    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
        throw new Error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
    }

    const stripe = await loadStripe(publishableKey);
    if (!stripe) {
        throw new Error('Unable to initialize Stripe');
    }

    const result = await stripe.redirectToCheckout({ sessionId });
    if (result.error) {
        throw new Error(result.error.message || 'Stripe redirect failed');
    }
}

export async function verifyStripeSession(sessionId: string): Promise<StripeVerifyResult> {
    const response = await fetch(`/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(String((data as { message?: string })?.message || 'Unable to verify Stripe session'));
    }
    return {
        paid: Boolean((data as { paid?: boolean })?.paid),
        amount: Number((data as { amount?: number })?.amount || 0),
        sessionId: String((data as { sessionId?: string })?.sessionId || ''),
        paymentIntentId: String((data as { paymentIntentId?: string })?.paymentIntentId || ''),
    };
}
