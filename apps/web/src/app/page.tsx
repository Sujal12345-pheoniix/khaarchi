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
} from 'lucide-react';
import { HomeType } from '@homeexpense/shared';

interface HomeItem {
  id: string;
  name: string;
  type: string;
  currency: string;
  description?: string;
  currentUserRole: string;
  currentMemberId: string;
  members: { id: string }[];
}

export default function HomesHubPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading, logout } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<HomeType>(HomeType.BACHELOR);
  const [currency, setCurrency] = useState('INR');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

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
              className="flex items-center space-x-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:text-ink hover:border-outline transition shadow-sm"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-10">
        {/* Header Hero Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 pb-6 border-b border-outline-variant/60">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-on-surface-variant mb-1">
              <Layers className="h-3.5 w-3.5 text-secondary" />
              <span>Multi-Tenant Ledger Spaces</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-ink">
              Household Ledgers
            </h1>
            <p className="text-sm text-on-surface-variant mt-1 max-w-xl">
              Switch between bachelor roommate debt-simplification networks and family pooled budget envelopes with deterministic double-entry integrity.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center space-x-2 rounded-full bg-ink px-5 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 transition shadow-elevation-1 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Create New Home</span>
          </button>
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
          <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest/60 p-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-high mx-auto mb-4 text-ink">
              <Building2 className="h-6 w-6 stroke-[1.8]" />
            </div>
            <h3 className="text-base font-bold text-ink">No household ledgers found</h3>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto mt-1.5 mb-6 leading-relaxed">
              You are not a member of any household yet. Establish your first shared space to track expenses, debts, and split ledgers with cent-perfect precision.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center space-x-2 rounded-full bg-ink px-5 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 transition shadow-elevation-1"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Create Your First Home</span>
            </button>
          </div>
        )}
      </main>

      {/* Create Home Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-elevation-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold tracking-tight text-ink">Establish New Household</h3>
              <span className="text-[11px] font-mono uppercase bg-surface-container px-2 py-0.5 rounded text-on-surface-variant">
                Setup
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mb-5">
              Set up a shared financial space for your apartment or family.
            </p>

            {formError && (
              <div className="mb-4 rounded-xl bg-error-container border border-error/30 p-3 text-xs text-error font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Household Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 402 Pine St Bachelors / Sunset Villa"
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3.5 py-2.5 text-sm text-ink placeholder-on-surface-variant/60 focus:border-ink focus:bg-surface-container-lowest focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Household Archetype</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType(HomeType.BACHELOR)}
                    className={`rounded-xl border p-3.5 text-left transition ${
                      type === HomeType.BACHELOR
                        ? 'border-ink bg-surface-container-highest shadow-sm'
                        : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
                    }`}
                  >
                    <Building2 className="h-4 w-4 mb-1.5 text-ink" />
                    <p className="text-xs font-bold text-ink">Bachelor / Flat</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">Roommates splitting bills & pairwise settlement</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType(HomeType.FAMILY)}
                    className={`rounded-xl border p-3.5 text-left transition ${
                      type === HomeType.FAMILY
                        ? 'border-ink bg-surface-container-highest shadow-sm'
                        : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
                    }`}
                  >
                    <HeartHandshake className="h-4 w-4 mb-1.5 text-secondary" />
                    <p className="text-xs font-bold text-ink">Family</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">Pooled expenses & category budget envelopes</p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Ledger Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3.5 py-2.5 text-sm text-ink focus:border-ink focus:bg-surface-container-lowest focus:outline-none font-mono"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional notes"
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3.5 py-2.5 text-sm text-ink placeholder-on-surface-variant/60 focus:border-ink focus:bg-surface-container-lowest focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-5 border-t border-outline-variant/60">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-full border border-outline-variant px-4 py-2 text-xs font-medium text-on-surface-variant hover:text-ink hover:bg-surface-container transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createHomeMutation.isPending}
                  className="rounded-full bg-ink px-5 py-2 text-xs font-semibold text-white hover:bg-neutral-800 transition disabled:opacity-50 flex items-center space-x-1.5 shadow-elevation-1"
                >
                  {createHomeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Establish Home</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
