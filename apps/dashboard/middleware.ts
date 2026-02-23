import { NextRequest, NextResponse } from 'next/server';

type UserType = 'external' | 'sales' | 'operations' | 'admin';

const INTERNAL_TYPES: UserType[] = ['sales', 'operations', 'admin'];

function decodeJwtPayload(token: string): { userType?: UserType; exp?: number } | null {
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;

        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
        return JSON.parse(atob(padded)) as { userType?: UserType; exp?: number };
    } catch {
        return null;
    }
}

function isExpired(exp?: number): boolean {
    if (!exp) return false;
    return exp * 1000 < Date.now();
}

function buildWebUrl(pathname: string) {
    const webOrigin = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
    return new URL(pathname, webOrigin);
}

export function middleware(request: NextRequest) {
    const token = request.cookies.get('accessToken')?.value;
    if (!token) {
        const loginUrl = buildWebUrl('/login');
        loginUrl.searchParams.set('workspace', 'operations');
        loginUrl.searchParams.set('next', '/ops');
        return NextResponse.redirect(loginUrl);
    }

    const payload = decodeJwtPayload(token);
    if (!payload || isExpired(payload.exp)) {
        const response = NextResponse.redirect(buildWebUrl('/login?workspace=operations'));
        response.cookies.delete('accessToken');
        response.cookies.delete('refreshToken');
        return response;
    }

    if (!payload.userType || !INTERNAL_TYPES.includes(payload.userType)) {
        return NextResponse.redirect(buildWebUrl('/app'));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
