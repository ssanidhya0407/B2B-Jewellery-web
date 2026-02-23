import { redirect } from 'next/navigation';

interface Params {
    params: {
        cartId: string;
    };
}

export default function LegacyCartPage({ params }: Params) {
    redirect(`/app/cart/${params.cartId}`);
}
