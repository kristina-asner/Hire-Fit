// frontend/app/api/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
    console.log("🔵 API Route hit: Starting request proxy...");

    // 1. Read the environment variable
    const BACKEND_API_URL = process.env.BACKEND_API_URL;

    // Critical check - is the variable defined?
    if (!BACKEND_API_URL) {
        console.error("❌ Critical Error: BACKEND_API_URL is undefined in Vercel!");
        return NextResponse.json(
            { error: 'Server configuration error: Missing Backend URL' },
            { status: 500 }
        );
    }

    const token = (await cookies()).get('hf_token')?.value;
    if (!token) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log(`🔗 Connecting to Backend at: ${BACKEND_API_URL}`);

    try {
        // 2. Read the form from the Frontend
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            console.error("❌ Error: No file found in request");
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        console.log(`📄 File received: ${(file as File).name}, Size: ${(file as File).size} bytes`);

        // 3. Send to Python (Fetch handles the multipart headers automatically — that's the magic)
        const response = await fetch(`${BACKEND_API_URL}/analyze`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        });

        // 4. Handle the response from Python
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Python Backend Error (${response.status}):`, errorText);
            return NextResponse.json(
                { error: `Backend failed: ${errorText}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        console.log("✅ Success! Data received from Python:", data);

        return NextResponse.json(data);

    } catch (error) {
        console.error("❌ Proxy Internal Error:", error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: `Failed to connect to backend: ${message}` },
            { status: 500 }
        );
    }
}