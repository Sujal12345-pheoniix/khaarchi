'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  HeartHandshake,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';

export default function AcceptInvitationPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const { user, token: authToken, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // Fetch invitation details
  const { data: invite, isLoading: inviteLoading, error: inviteQueryError } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => apiClient<any>(`/homes/invitations/${token}`),
    enabled: !!token,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: () =>
      apiClient(`/homes/invitations/${token}/accept`, {
        method: 'POST',
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['homes'] });
      router.push(`/homes/${data.home?.id || invite?.homeId}`);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to accept invitation.');
    },
  });

  if (inviteLoading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-canvas text-ink">
        <Loader2 className="h-8 w-8 animate-spin text-ink" />
      </div>
    );
  }

  if (inviteQueryError || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-surface-canvas font-sans antialiased text-on-surface">
        <div className="w-full max-w-md rounded-2xl border border-outline-variant/80 bg-surface-container-lowest p-8 text-center shadow-elevation-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-error-container text-error mx-auto mb-4">
            <AlertCircle className="h-6 w-6 stroke-[2]" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-ink mb-2">Invalid or Expired Invitation</h2>
          <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
            This invitation link is invalid, has expired, or has already been used. Please ask the home owner or administrator for a new invite.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center space-x-2 rounded-full bg-ink px-6 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 transition shadow-elevation-1"
          >
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-surface-canvas font-sans antialiased text-on-surface">
      <div className="w-full max-w-md rounded-2xl border border-outline-variant/80 bg-surface-container-lowest p-8 shadow-elevation-2 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white font-bold shadow-elevation-1">
            HE
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-ink">HomeExpense</h1>
            <p className="text-xs text-on-surface-variant font-mono">Household Invitation</p>
          </div>
        </div>

        {/* Invitation Card Banner */}
        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span
              className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
                invite.homeType === 'BACHELOR'
                  ? 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]'
                  : 'bg-secondary-container text-secondary border border-[#86efac]/40'
              }`}
            >
              {invite.homeType === 'BACHELOR' ? (
                <Building2 className="h-3 w-3 mr-1" />
              ) : (
                <HeartHandshake className="h-3 w-3 mr-1" />
              )}
              <span>{invite.homeType === 'BACHELOR' ? 'Bachelor Mode' : 'Family Mode'}</span>
            </span>

            <span className="text-[11px] font-mono uppercase bg-surface-container-highest px-2 py-0.5 rounded text-on-surface-variant font-semibold">
              Role: {invite.role}
            </span>
          </div>

          <h2 className="text-2xl font-black tracking-tight text-ink mb-1">{invite.homeName}</h2>
          {invite.description && (
            <p className="text-xs text-on-surface-variant line-clamp-2 mb-2">{invite.description}</p>
          )}

          <div className="mt-3 pt-3 border-t border-outline-variant/40 flex items-center justify-between text-[11px] text-on-surface-variant">
            <span>Invited by <strong className="text-ink">{invite.inviterName}</strong></span>
            <span className="font-mono text-ink font-semibold">{invite.currency}</span>
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-error/30 bg-error-container p-3 text-xs text-error font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-error" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth State Actions */}
        {authToken && user ? (
          <div>
            <div className="flex items-center space-x-2 text-xs text-on-surface-variant mb-4 bg-surface-container px-3 py-2 rounded-xl border border-outline-variant/40">
              <UserCheck className="h-4 w-4 text-secondary shrink-0" />
              <span>Signed in as <strong className="text-ink">{user.name}</strong> ({user.email})</span>
            </div>

            <button
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              className="w-full flex items-center justify-center space-x-2 rounded-full bg-ink py-3 px-4 text-xs font-semibold text-white hover:bg-neutral-800 transition shadow-elevation-1 disabled:opacity-50"
            >
              {acceptMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Accept Invitation & Join Home</span>
                  <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-on-surface-variant text-center mb-4">
              You must sign in or create an account to accept this invitation.
            </p>
            <Link
              href={`/login?redirect=/invite/${token}`}
              className="w-full flex items-center justify-center space-x-2 rounded-full bg-ink py-3 px-4 text-xs font-semibold text-white hover:bg-neutral-800 transition shadow-elevation-1"
            >
              <span>Sign In to Accept</span>
              <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
            </Link>
            <Link
              href={`/register?redirect=/invite/${token}`}
              className="w-full flex items-center justify-center space-x-2 rounded-full border border-outline-variant bg-surface-container-lowest py-2.5 px-4 text-xs font-semibold text-ink hover:bg-surface-container-low transition"
            >
              <span>Create New Account</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
