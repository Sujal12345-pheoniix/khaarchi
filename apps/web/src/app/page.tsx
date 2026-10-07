'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Home,
  Plus,
  Users,
  LogOut,
  Building2,
  HeartHandshake,
  ArrowRight,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Layers,
  Key,
  Copy,
  Check,
  LogIn,
  AlertCircle,
} from 'lucide-react';
import { HomeType } from '@homeexpense/shared';

interface HomeItem {
  id: string;
  name: string;
  type: string;
  currency: string;
  description?: string;
  inviteCode?: string;
  currentUserRole: string;
  currentMemberId: string;
  members: { id: string }[];
}

export default function HomesHubPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading, logout } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<HomeType>(HomeType.BACHELOR);
  const [currency, setCurrency] = useState('INR');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Join by code state
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Redirect if unauthenticated
  React.useEffect(() => {
    if (!authLoading && !token) {
      router.push('/login');
    }
  }, [authLoading, token, router]);

  const { data: homes, isLoading: homesLoading } = useQuery<HomeItem[]>({
    queryKey: ['homes'],
    queryFn: () => apiClient<HomeItem[]>('/homes'),
    enabled: !!token,
  });

  const createHomeMutation = useMutation({
    mutationFn: (newHome: { name: string; type: HomeType; currency: string; description?: string }) =>
      apiClient('/homes', {
        method: 'POST',
        body: JSON.stringify(newHome),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['homes'] });
      setShowCreateModal(false);
      setName('');
      setDescription('');
      router.push(`/homes/${data.id}`);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create home.');
    },
  });

  const joinHomeMutation = useMutation({
    mutationFn: (code: string) =>
      apiClient<{ homeId: string; message: string }>('/homes/join', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['homes'] });
      setShowJoinModal(false);
      setJoinCode('');
      setJoinError(null);
      router.push(`/homes/${data.homeId}`);
    },
    onError: (err: any) => {
      setJoinError(err.message || 'Invalid or expired invite code.');
    },
  });

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    if (!joinCode.trim()) {
      setJoinError('Please enter a secret code.');
      return;
    }
    joinHomeMutation.mutate(joinCode.trim().toUpperCase());
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    createHomeMutation.mutate({ name, type, currency, description: description || undefined });
  };

  if (authLoading || (!token && authLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-canvas">
        <Loader2 className="h-7 w-7 animate-spin text-ink" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-canvas text-on-surface font-sans antialiased">
      {/* Editorial Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-outline-variant/60 bg-surface-canvas/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-white font-bold text-sm tracking-tight shadow-elevation-1">
              HE
            </div>
            <div>
              <span className="font-bold tracking-tight text-ink text-base">HomeExpense</span>
              <span className="ml-2 text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                Equilibrium OS
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-ink">{user?.name}</p>
              <p className="text-[11px] text-on-surface-variant font-mono">{user?.email}</p>
            </div>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="flex items-center space-x-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 hover:text-black transition shadow-sm"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-600" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-10">
        {/* Header Hero Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-slate-500 mb-1">
              <Layers className="h-3.5 w-3.5 text-emerald-600" />
              <span>Multi-Tenant Ledger Spaces</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Household Ledgers
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-xl">
              Switch between bachelor roommate debt-simplification networks and family pooled budget envelopes with deterministic double-entry integrity.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setJoinError(null);
                setJoinCode('');
                setShowJoinModal(true);
              }}
              className="inline-flex items-center justify-center space-x-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition shadow-sm active:scale-[0.98]"
            >
              <Key className="h-3.5 w-3.5 text-emerald-600" />
              <span>Join with Code</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center space-x-2 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-md active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Create New Home</span>
            </button>
          </div>
        </div>

        {/* Homes Grid */}
        {homesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-52 rounded-2xl border border-outline-variant bg-surface-container-lowest animate-pulse p-6"
              />
            ))}
          </div>
        ) : homes && homes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {homes.map((h) => (
              <div
                key={h.id}
                onClick={() => router.push(`/homes/${h.id}`)}
                className="group cursor-pointer rounded-2xl border border-outline-variant/80 bg-surface-container-lowest p-6 hover:border-outline hover:shadow-elevation-2 transition duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${
                        h.type === HomeType.BACHELOR
                          ? 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]'
                          : 'bg-secondary-container text-secondary border border-[#86efac]/40'
                      }`}
                    >
                      {h.type === HomeType.BACHELOR ? (
                        <Building2 className="h-3 w-3 mr-1" />
                      ) : (
                        <HeartHandshake className="h-3 w-3 mr-1" />
                      )}
                      <span>{h.type === HomeType.BACHELOR ? 'Bachelor Mode' : 'Family Mode'}</span>
                    </span>

                    <span className="text-[11px] text-on-surface-variant font-mono uppercase bg-surface-container px-2 py-0.5 rounded-md border border-outline-variant/60">
                      {h.currentUserRole}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight text-ink group-hover:text-primary transition">
                    {h.name}
                  </h3>
                  {h.description && (
                    <p className="text-xs text-on-surface-variant mt-2 line-clamp-2 leading-relaxed">
                      {h.description}
                    </p>
                  )}

                  {/* Secret Code Pill */}
                  {h.inviteCode && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(h.inviteCode!);
                        setCopiedCodeId(h.id);
                        setTimeout(() => setCopiedCodeId(null), 2000);
                      }}
                      className="mt-3.5 inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-surface-container border border-outline-variant/70 text-xs font-mono text-ink hover:bg-surface-container-high transition group/code"
                      title="Click to copy secret invite code"
                    >
                      <Key className="h-3 w-3 text-secondary" />
                      <span className="font-bold tracking-wide">{h.inviteCode}</span>
                      {copiedCodeId === h.id ? (
                        <Check className="h-3 w-3 text-secondary ml-1" />
                      ) : (
                        <Copy className="h-3 w-3 text-on-surface-variant group-hover/code:text-ink ml-1" />
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-4 border-t border-outline-variant/60 flex items-center justify-between text-xs text-on-surface-variant">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-on-surface-variant/70" />
                    <span className="font-numeric">{h.members?.length || 1} members</span>
                    <span className="text-outline-variant">•</span>
                    <span className="font-mono font-medium text-ink">{h.currency}</span>
                  </div>

                  <div className="flex items-center space-x-1 font-semibold text-ink group-hover:translate-x-1 transition">
                    <span>Open Ledger</span>
                    <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-outline-variant/80 bg-surface-container-lowest/80 p-8 sm:p-12 shadow-sm text-center">
            <div className="max-w-md mx-auto mb-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-high mx-auto mb-3 text-ink">
                <Building2 className="h-7 w-7 stroke-[1.8]" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-ink">Welcome to HomeExpense</h2>
              <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                You are not currently part of any household. Start tracking shared expenses by establishing a new home or joining an existing one with a secret code.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto text-left">
              {/* Card 1: Create New */}
              <div
                onClick={() => setShowCreateModal(true)}
                className="group cursor-pointer rounded-2xl border border-outline-variant bg-surface-container-low/60 p-5 hover:border-ink hover:bg-surface-container-low transition shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white mb-3 shadow-sm">
                    <Plus className="h-5 w-5 stroke-[2.5]" />
                  </div>
                  <h3 className="text-sm font-bold text-ink group-hover:text-primary transition">
                    Create New Home
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    Set up a fresh household ledger for flatmates or family with custom currencies and split engines.
                  </p>
                </div>
                <div className="mt-5 flex items-center space-x-1.5 text-xs font-semibold text-ink">
                  <span>Establish Home</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition" />
                </div>
              </div>

              {/* Card 2: Join Existing */}
              <div
                onClick={() => {
                  setJoinError(null);
                  setJoinCode('');
                  setShowJoinModal(true);
                }}
                className="group cursor-pointer rounded-2xl border border-outline-variant bg-surface-container-low/60 p-5 hover:border-secondary hover:bg-surface-container-low transition shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/15 text-secondary mb-3">
                    <Key className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-ink group-hover:text-secondary transition">
                    Join with Secret Code
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    Have an invite code from your flatmate or family member? Enter it here to join instantly.
                  </p>
                </div>
                <div className="mt-5 flex items-center space-x-1.5 text-xs font-semibold text-secondary">
                  <span>Enter Code</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition" />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Create Home Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold tracking-tight text-slate-900">Establish New Household</h3>
              <span className="text-[11px] font-mono uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-semibold">
                Setup
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Set up a shared financial space for your apartment or family.
            </p>

            {formError && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600 font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1.5">Household Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 402 Pine St Bachelors / Sunset Villa"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1.5">Household Archetype</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType(HomeType.BACHELOR)}
                    className={`rounded-xl border p-3.5 text-left transition ${
                      type === HomeType.BACHELOR
                        ? 'border-slate-900 bg-slate-100 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className="h-4 w-4 mb-1.5 text-slate-900" />
                    <p className="text-xs font-bold text-slate-900">Bachelor / Flat</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Roommates splitting bills & pairwise settlement</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType(HomeType.FAMILY)}
                    className={`rounded-xl border p-3.5 text-left transition ${
                      type === HomeType.FAMILY
                        ? 'border-slate-900 bg-slate-100 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <HeartHandshake className="h-4 w-4 mb-1.5 text-emerald-600" />
                    <p className="text-xs font-bold text-slate-900">Family</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Pooled expenses & category budget envelopes</p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1.5">Ledger Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none font-mono"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1.5">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional notes"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createHomeMutation.isPending}
                  className="rounded-full bg-slate-900 px-6 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50 flex items-center space-x-2 shadow-md active:scale-95"
                >
                  {createHomeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />}
                  <span>Establish Home</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Home Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold tracking-tight text-slate-900">Join Household</h3>
              <span className="text-[11px] font-mono uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-semibold">
                Secret Code
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Enter the unique secret code provided by your flatmate or family member to access the shared ledger.
            </p>

            {joinError && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600 font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{joinError}</span>
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1.5">Household Secret Code</label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="e.g. KX-9A4B2C"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 py-2.5 text-sm font-mono tracking-wider text-slate-900 uppercase placeholder-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Codes usually look like <span className="font-mono font-semibold text-slate-700">KX-XXXXXX</span>
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinHomeMutation.isPending}
                  className="rounded-full bg-slate-900 px-6 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50 flex items-center space-x-2 shadow-md active:scale-95"
                >
                  {joinHomeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />}
                  <span>Join Household</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
