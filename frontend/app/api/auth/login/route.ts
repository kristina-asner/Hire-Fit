import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API_URL = process.env.BACKEND_API_URL;

export async function POST(request: NextRequest) {
    if (!BACKEND_API_URL) {
        return NextResponse.json(
            { error: 'Server configuration error: Missing Backend URL' },
            { status: 500 }
        );
    }

    let body: { name?: string; password?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        const response = await fetch(`${BACKEND_API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: body.name || '', password: body.password || '' }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Login failed' }));
            return NextResponse.json({ error: errorData.detail || 'Invalid name or password' }, { status: response.status });
        }

        const data = await response.json();

        const res = NextResponse.json({ success: true, name: data.name });
        const cookieOpts = {
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax' as const,
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 days, matches backend token TTL
        };
        res.cookies.set('hf_token', data.token, { ...cookieOpts, httpOnly: true });
        // Readable by the client so the UI can show "Signed in as ..." - not sensitive on its own.
        res.cookies.set('hf_user', data.name, { ...cookieOpts, httpOnly: false });
        return res;

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: `Failed to connect to backend: ${message}` },
            { status: 500 }
        );
    }
}
