import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios, { AxiosError } from 'axios';

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

export async function GET() {
    const token = (await cookies()).get('hf_token')?.value;
    if (!token) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const response = await axios.get(`${BACKEND_API_URL}/analyses`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return NextResponse.json(response.data);

    } catch (error) {
        if (error instanceof AxiosError && error.response) {
            return NextResponse.json(error.response.data, { status: error.response.status });
        }
        return NextResponse.json(
            { error: 'Backend unreachable' },
            { status: 500 }
        );
    }
}

// Clears the entire shared history for every HR - used by "Clear All" in the dashboard.
export async function DELETE() {
    const token = (await cookies()).get('hf_token')?.value;
    if (!token) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const response = await axios.delete(`${BACKEND_API_URL}/analyses`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return NextResponse.json(response.data);

    } catch (error) {
        if (error instanceof AxiosError && error.response) {
            return NextResponse.json(error.response.data, { status: error.response.status });
        }
        return NextResponse.json(
            { error: 'Backend unreachable' },
            { status: 500 }
        );
    }
}
