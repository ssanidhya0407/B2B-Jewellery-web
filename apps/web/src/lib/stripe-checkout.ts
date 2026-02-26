const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

function getAuthToken(): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const match = document.cookie.match(/(?:^|;\s*)accessToken=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : undefined;
}

export async function startStripeCheckout(input: StartStripeCheckoutInput): Promise<void> {
    const token = getAuthToken();
    const response = await fetch(`${API_URL}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(input),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(String((data as { message?: string })?.message || 'Unable to start Stripe checkout'));
    }

    const checkoutUrl = String((data as { url?: string })?.url || '');
    if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
    }

    const sessionId = String((data as { sessionId?: string })?.sessionId || '');
    if (!sessionId) throw new Error('Stripe session was not created.');

    // Fallback: redirect through Stripe's hosted checkout page
    window.location.assign(`https://checkout.stripe.com/pay/${sessionId}`);
}

export async function verifyStripeSession(sessionId: string): Promise<StripeVerifyResult> {
    const response = await fetch(`${API_URL}/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`);
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
