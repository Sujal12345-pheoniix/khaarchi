'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { ShieldCheck, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const data = await apiClient<{ accessToken: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      login(data.accessToken, data.user);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface p-8 shadow-2xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">HomeExpense</h1>
            <p className="text-xs text-slate-400">Household Financial Operating System</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-white mb-2">Sign in to your account</h2>
        <p className="text-sm text-slate-400 mb-6">Access your home ledgers and balances.</p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-surface-border pt-4 text-center text-xs text-slate-400">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-indigo-400 hover:text-indigo-300">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
