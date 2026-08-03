"use client";

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios, { AxiosError } from 'axios';
import { Target, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await axios.post('/api/auth/login', { name, password });
            router.push('/');
            router.refresh();
        } catch (err) {
            const message = err instanceof AxiosError ? err.response?.data?.error : undefined;
            setError(message || 'Invalid name or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex items-center justify-center px-6">
            <div className="w-full max-w-sm">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-orange-600 w-10 h-10 rounded-md flex items-center justify-center mb-3">
                        <Target className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-lg font-semibold tracking-tight text-gray-900">
                        Hire<span className="text-orange-600">Fit</span>
                    </span>
                    <p className="text-sm text-gray-500 mt-1">Sign in to access the recruitment dashboard</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                            Name
                        </label>
                        <input
                            id="name"
                            type="text"
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Your password"
                            className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                        />
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2.5">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !name.trim() || !password}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Sign in
                    </button>

                    <p className="text-center text-sm text-gray-500">
                        Don&apos;t have an account?{' '}
                        <Link href="/signup" className="text-orange-600 font-medium hover:text-orange-700">
                            Sign up
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
