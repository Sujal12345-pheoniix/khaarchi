'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { ShieldCheck, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await apiClient<{ accessToken: string; user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });

      login(data.accessToken, data.user);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
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

        <h2 className="text-xl font-bold tracking-tight text-ink mb-1.5">Create your account</h2>
        <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
          Manage household split finances with mathematical proof and zero balance drift.
        </p>

        {error && (
          <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-error/30 bg-error-container p-3 text-xs text-error font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-error" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Johnson"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3.5 py-2.5 text-sm text-ink placeholder-on-surface-variant/60 focus:border-ink focus:bg-surface-container-lowest focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Email Address</label>
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
            <label className="block text-xs font-semibold text-ink mb-1.5">Password (min 8 chars)</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center space-x-2 rounded-full bg-slate-900 px-4 py-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 shadow-md active:scale-[0.99] mt-2 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <>
                <span>Register Account</span>
                <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-600">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-slate-900 hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
