import { NextRequest, NextResponse } from 'next/server';

const TOKEN_COOKIE = 'hf_token';
const PUBLIC_PATHS = ['/login', '/signup'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get(TOKEN_COOKIE)?.value;

    const isPublicPath = PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/api/auth');

    if (!token && !isPublicPath) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    if (token && (pathname === '/login' || pathname === '/signup')) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    // Run on everything except static assets. Actual token *validity* is
    // enforced by the backend on every request (see api/analyze, api/status) -
    // this middleware only gates page navigation for UX.
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
