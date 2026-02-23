import Cookies from 'js-cookie';

export type UserType = 'external' | 'sales' | 'operations' | 'admin';

export interface AuthPayload {
    sub: string;
    email: string;
    userType: UserType;
    exp?: number;
}

export function decodeJwtPayload(token: string): AuthPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;

        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
        return JSON.parse(atob(padded)) as AuthPayload;
    } catch {
        return null;
    }
}

export function getAuthPayload(): AuthPayload | null {
    const token = Cookies.get('accessToken');
    if (!token) return null;
    return decodeJwtPayload(token);
}

export function clearAuthCookies() {
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
}
