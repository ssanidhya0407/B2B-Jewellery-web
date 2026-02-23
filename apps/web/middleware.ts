import { NextRequest, NextResponse } from 'next/server';

type UserType = 'external' | 'sales' | 'operations' | 'admin';

/** Which user types can access each route prefix */
const ROUTE_ACCESS: Record<string, UserType[]> = {
    '/app': ['external'],
    '/ops': ['operations', 'admin'],
    '/sales': ['sales', 'admin'],
    '/admin': ['admin'],
};

/** Where each role should land after login */
const ROLE_HOME: Record<UserType, string> = {
    external: '/app',
    sales: '/sales',
    operations: '/ops',
    admin: '/admin',
};

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

function getRoutePrefix(pathname: string): string | null {
    for (const prefix of Object.keys(ROUTE_ACCESS)) {
        if (pathname === prefix || pathname.startsWith(prefix + '/')) {
            return prefix;
        }
    }
    return null;
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Legacy route redirects
    if (pathname === '/upload') return NextResponse.redirect(new URL('/app/upload', request.url));
    if (pathname === '/requests') return NextResponse.redirect(new URL('/app/requests', request.url));
    if (pathname.startsWith('/recommendations/')) {
        return NextResponse.redirect(new URL(pathname.replace('/recommendations/', '/app/recommendations/'), request.url));
    }
    if (pathname.startsWith('/cart/')) {
        return NextResponse.redirect(new URL(pathname.replace('/cart/', '/app/cart/'), request.url));
    }

    const routePrefix = getRoutePrefix(pathname);
    const isAuthPath = pathname === '/login' || pathname === '/register';

    // Public pages — no auth needed
    if (!routePrefix && !isAuthPath) {
        return NextResponse.next();
    }

    // Read token
    const token = request.cookies.get('accessToken')?.value;
    const payload = token ? decodeJwtPayload(token) : null;

    // Clear expired tokens
    if (token && (!payload || isExpired(payload.exp))) {
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('accessToken');
        response.cookies.delete('refreshToken');
        return response;
    }

    const userType = payload?.userType;

    // If on login/register and already authenticated → redirect to role home
    if (isAuthPath && token && payload && !isExpired(payload.exp) && userType) {
        return NextResponse.redirect(new URL(ROLE_HOME[userType], request.url));
    }

    // Protected route — must be logged in
    if (routePrefix) {
        if (!token || !payload || !userType) {
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('next', pathname);
            return NextResponse.redirect(loginUrl);
        }

        const allowedRoles = ROUTE_ACCESS[routePrefix];

        // User doesn't have the right role for this route
        if (!allowedRoles.includes(userType)) {
            // Redirect to their correct home
            return NextResponse.redirect(new URL(ROLE_HOME[userType], request.url));
        }

        return NextResponse.next();
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
