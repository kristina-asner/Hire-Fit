import { NextResponse } from 'next/server';

export async function POST() {
    const res = NextResponse.json({ success: true });
    res.cookies.delete('hf_token');
    res.cookies.delete('hf_user');
    return res;
}
