import { redirect } from 'next/navigation';

interface Params {
    params: {
        sessionId: string;
    };
}

export default function LegacyRecommendationsPage({ params }: Params) {
    redirect(`/app/recommendations/${params.sessionId}`);
}
