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
        const response = await fetch(`${BACKEND_API_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: body.name || '', password: body.password || '' }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Signup failed' }));
            return NextResponse.json({ error: errorData.detail || 'Could not create account' }, { status: response.status });
        }

        const data = await response.json();

        // Signup logs the new HR straight in, same cookies as /api/auth/login.
        const res = NextResponse.json({ success: true, name: data.name });
        const cookieOpts = {
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax' as const,
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
        };
        res.cookies.set('hf_token', data.token, { ...cookieOpts, httpOnly: true });
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
