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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-slate-100">
      {/* Top Navbar */}
      <header className="border-b border-surface-border bg-surface/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold">
              HE
            </div>
            <span className="font-bold tracking-tight text-white text-lg">HomeExpense</span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="flex items-center space-x-1 rounded-lg border border-surface-border px-3 py-1.5 text-xs text-slate-400 hover:bg-surface-elevated hover:text-white transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Your Homes</h2>
            <p className="text-sm text-slate-400 mt-1">
              Select an existing home financial environment or establish a new one.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Home</span>
          </button>
        </div>

        {/* Homes Grid */}
        {homesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 rounded-xl border border-surface-border bg-surface animate-pulse"
              />
            ))}
          </div>
        ) : homes && homes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {homes.map((h) => (
              <div
                key={h.id}
                onClick={() => router.push(`/homes/${h.id}`)}
                className="group cursor-pointer rounded-xl border border-surface-border bg-surface p-6 hover:border-indigo-500/50 hover:bg-surface-elevated transition duration-150 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        h.type === HomeType.BACHELOR
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {h.type === HomeType.BACHELOR ? (
                        <Building2 className="h-3 w-3 mr-1" />
                      ) : (
                        <HeartHandshake className="h-3 w-3 mr-1" />
                      )}
                      <span>{h.type}</span>
                    </span>

                    <span className="text-xs text-slate-400 font-mono uppercase bg-slate-800 px-2 py-0.5 rounded">
                      {h.currentUserRole}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition">
                    {h.name}
                  </h3>
                  {h.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{h.description}</p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-surface-border flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <Users className="h-4 w-4 text-slate-500" />
                    <span>{h.members?.length || 1} members</span>
                  </div>

                  <div className="flex items-center space-x-1 font-medium text-indigo-400 group-hover:translate-x-1 transition">
                    <span>Enter Home</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-surface-border bg-surface/50 p-12 text-center">
            <Building2 className="h-12 w-12 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">No homes found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-6">
              You are not a member of any home yet. Create your first home to start managing household expenses.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Create Your First Home</span>
            </button>
          </div>
        )}
      </main>

      {/* Create Home Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Create New Home</h3>
            <p className="text-xs text-slate-400 mb-4">
              Set up a shared financial space for your apartment or family.
            </p>

            {formError && (
              <div className="mb-4 rounded-lg bg-red-950/40 border border-red-500/30 p-2.5 text-xs text-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Home Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 402 Pine St Bachelors / Sunset Villa"
                  className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Home Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType(HomeType.BACHELOR)}
                    className={`rounded-lg border p-3 text-left transition ${
                      type === HomeType.BACHELOR
                        ? 'border-indigo-500 bg-indigo-950/40 text-white'
                        : 'border-surface-border bg-surface-elevated text-slate-400 hover:text-white'
                    }`}
                  >
                    <Building2 className="h-4 w-4 mb-1 text-amber-400" />
                    <p className="text-xs font-semibold">Bachelor / Flat</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Roommates splitting rent & bills</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType(HomeType.FAMILY)}
                    className={`rounded-lg border p-3 text-left transition ${
                      type === HomeType.FAMILY
                        ? 'border-indigo-500 bg-indigo-950/40 text-white'
                        : 'border-surface-border bg-surface-elevated text-slate-400 hover:text-white'
                    }`}
                  >
                    <HeartHandshake className="h-4 w-4 mb-1 text-emerald-400" />
                    <p className="text-xs font-semibold">Family</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Household budget & shared pool</p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional notes"
                    className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-surface-border px-4 py-2 text-xs font-medium text-slate-300 hover:bg-surface-elevated transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createHomeMutation.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {createHomeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Create Home</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
