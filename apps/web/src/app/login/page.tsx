'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { ShieldCheck, ArrowRight, AlertCircle, Loader2, Sparkles } from 'lucide-react';

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
    <div className="flex min-h-screen items-center justify-center p-4 bg-surface-canvas font-sans antialiased text-on-surface">
      <div className="w-full max-w-md rounded-2xl border border-outline-variant/80 bg-surface-container-lowest p-8 shadow-elevation-2">
        {/* Header Branding */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white font-bold shadow-elevation-1">
            HE
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="text-lg font-bold tracking-tight text-ink">HomeExpense</h1>
              <span className="text-[10px] font-mono uppercase bg-surface-container px-2 py-0.5 rounded text-on-surface-variant font-medium">
                v2.0
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">Equilibrium Financial OS</p>
          </div>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-ink mb-1.5">Sign in to your account</h2>
        <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
          Access your household double-entry ledgers and simplified debt matrices.
        </p>

        {error && (
          <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-error/30 bg-error-container p-3 text-xs text-error font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-error" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@household.local"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3.5 py-2.5 text-sm text-ink placeholder-on-surface-variant/60 focus:border-ink focus:bg-surface-container-lowest focus:outline-none transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-ink">Password</label>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3.5 py-2.5 text-sm text-ink placeholder-on-surface-variant/60 focus:border-ink focus:bg-surface-container-lowest focus:outline-none transition font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center space-x-2 rounded-full bg-ink px-4 py-3 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50 shadow-elevation-1 active:scale-[0.99] mt-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>Sign in to Ledger</span>
                <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-outline-variant/60 pt-4 text-center text-xs text-on-surface-variant">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-ink hover:underline">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
