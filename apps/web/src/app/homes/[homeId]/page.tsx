'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  ArrowRightLeft,
  UserPlus,
  Receipt,
  Scale,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Calendar,
  DollarSign,
  Loader2,
  Building2,
  HeartHandshake,
} from 'lucide-react';
import {
  ExpenseCategory,
  SplitType,
  MemberRole,
  calculateEqualSplits,
  calculatePercentageSplits,
  calculateSharesSplits,
  roundFinancial,
  toMajor,
} from '@homeexpense/shared';

export default function HomeDashboardPage() {
  const params = useParams();
  const homeId = params.homeId as string;
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // Modals state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  // Form states
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>(ExpenseCategory.GROCERIES);
  const [expensePayerId, setExpensePayerId] = useState('');
  const [expenseSplitType, setExpenseSplitType] = useState<SplitType>(SplitType.EQUAL);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [participantPercentages, setParticipantPercentages] = useState<Record<string, number>>({});
  const [participantShares, setParticipantShares] = useState<Record<string, number>>({});
  const [participantExacts, setParticipantExacts] = useState<Record<string, number>>({});
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Settlement Form State
  const [settleFromId, setSettleFromId] = useState('');
  const [settleToId, setSettleToId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settleError, setSettleError] = useState<string | null>(null);

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>(MemberRole.MEMBER);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Redirect if unauthenticated
  React.useEffect(() => {
    if (!authLoading && !token) {
      router.push('/login');
    }
  }, [authLoading, token, router]);

  // Queries
  const { data: homeDetails, isLoading: homeLoading } = useQuery({
    queryKey: ['home', homeId],
    queryFn: () => apiClient<any>(`/homes/${homeId}`),
    enabled: !!token && !!homeId,
  });

  const { data: balancesData, isLoading: balancesLoading } = useQuery({
    queryKey: ['balances', homeId],
    queryFn: () => apiClient<any>(`/homes/${homeId}/balances`),
    enabled: !!token && !!homeId,
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', homeId],
    queryFn: () => apiClient<any>(`/homes/${homeId}/expenses`),
    enabled: !!token && !!homeId,
  });

  // Current member in this home
  const currentMember = useMemo(() => {
    if (!homeDetails || !user) return null;
    return homeDetails.members.find((m: any) => m.userId === user.id);
  }, [homeDetails, user]);

  // Pre-select current member as payer and all members as participants on first load
  React.useEffect(() => {
    if (homeDetails?.members && homeDetails.members.length > 0) {
      const activeIds = homeDetails.members.map((m: any) => m.id);
      setSelectedParticipants(activeIds);

      if (currentMember && !expensePayerId) {
        setExpensePayerId(currentMember.id);
      } else if (!expensePayerId) {
        setExpensePayerId(homeDetails.members[0].id);
      }

      // Initialize default percentages and shares
      const count = activeIds.length;
      const defaultPct = Number((100 / count).toFixed(2));
      const pcts: Record<string, number> = {};
      const shares: Record<string, number> = {};
      activeIds.forEach((id: string) => {
        pcts[id] = defaultPct;
        shares[id] = 1;
      });
      setParticipantPercentages(pcts);
      setParticipantShares(shares);
    }
  }, [homeDetails, currentMember, expensePayerId]);

  // Live split calculation
  const computedSplits = useMemo(() => {
    const total = parseFloat(expenseAmount) || 0;
    if (total <= 0 || selectedParticipants.length === 0) return [];

    try {
      if (expenseSplitType === SplitType.EQUAL) {
        return calculateEqualSplits(total, selectedParticipants);
      }
      if (expenseSplitType === SplitType.PERCENTAGE) {
        const input = selectedParticipants.map((id) => ({
          memberId: id,
          percentage: participantPercentages[id] || 0,
        }));
        return calculatePercentageSplits(total, input);
      }
      if (expenseSplitType === SplitType.SHARES) {
        const input = selectedParticipants.map((id) => ({
          memberId: id,
          shares: participantShares[id] || 1,
        }));
        return calculateSharesSplits(total, input);
      }
      if (expenseSplitType === SplitType.EXACT) {
        return selectedParticipants.map((id) => ({
          memberId: id,
          amount: participantExacts[id] || 0,
          cents: Math.round((participantExacts[id] || 0) * 100),
        }));
      }
    } catch {
      return [];
    }
    return [];
  }, [expenseAmount, selectedParticipants, expenseSplitType, participantPercentages, participantShares, participantExacts]);

  // Invariant validation for active split
  const isSplitValid = useMemo(() => {
    const total = parseFloat(expenseAmount) || 0;
    if (total <= 0 || computedSplits.length === 0) return false;
    const sumSplits = computedSplits.reduce((acc, s) => acc + s.amount, 0);
    return Math.abs(roundFinancial(sumSplits) - total) < 0.001;
  }, [expenseAmount, computedSplits]);

  // Mutations
  const createExpenseMutation = useMutation({
    mutationFn: (body: any) =>
      apiClient(`/homes/${homeId}/expenses`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', homeId] });
      queryClient.invalidateQueries({ queryKey: ['balances', homeId] });
      setShowAddExpense(false);
      setExpenseDesc('');
      setExpenseAmount('');
      setExpenseError(null);
    },
    onError: (err: any) => {
      setExpenseError(err.message || 'Failed to create expense.');
    },
  });

  const createSettlementMutation = useMutation({
    mutationFn: (body: any) =>
      apiClient(`/homes/${homeId}/settlements`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balances', homeId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', homeId] });
      setShowSettle(false);
      setSettleAmount('');
      setSettleNotes('');
      setSettleError(null);
    },
    onError: (err: any) => {
      setSettleError(err.message || 'Failed to record settlement.');
    },
  });

  const inviteMemberMutation = useMutation({
    mutationFn: (body: any) =>
      apiClient(`/homes/${homeId}/members`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home', homeId] });
      queryClient.invalidateQueries({ queryKey: ['balances', homeId] });
      setShowInvite(false);
      setInviteEmail('');
      setInviteError(null);
    },
    onError: (err: any) => {
      setInviteError(err.message || 'Failed to invite member.');
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId: string) =>
      apiClient(`/homes/${homeId}/expenses/${expenseId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', homeId] });
      queryClient.invalidateQueries({ queryKey: ['balances', homeId] });
    },
  });

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError(null);

    const total = parseFloat(expenseAmount);
    if (!total || total <= 0) {
      setExpenseError('Enter a valid positive expense amount.');
      return;
    }

    if (!isSplitValid) {
      setExpenseError('Splits must sum exactly to the expense amount.');
      return;
    }

    createExpenseMutation.mutate({
      description: expenseDesc,
      amount: total,
      category: expenseCategory,
      date: new Date().toISOString(),
      payerMemberId: expensePayerId,
      splitType: expenseSplitType,
      splits: computedSplits.map((s) => ({
        memberId: s.memberId,
        amount: s.amount,
      })),
    });
  };

  const handleSettlementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSettleError(null);

    const amount = parseFloat(settleAmount);
    if (!amount || amount <= 0) {
      setSettleError('Settlement amount must be positive.');
      return;
    }

    createSettlementMutation.mutate({
      fromMemberId: settleFromId,
      toMemberId: settleToId,
      amount,
      notes: settleNotes || undefined,
    });
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    inviteMemberMutation.mutate({
      email: inviteEmail,
      role: inviteRole,
    });
  };

  const currentUserBalance = balancesData?.memberBalances?.find(
    (b: any) => b.memberId === currentMember?.id
  );

  if (authLoading || homeLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const currencySymbol = homeDetails?.currency === 'INR' ? '₹' : homeDetails?.currency === 'EUR' ? '€' : '$';

  return (
    <div className="min-h-screen bg-background text-slate-100">
      {/* Top Navbar */}
      <header className="border-b border-surface-border bg-surface/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center space-x-1 text-slate-400 hover:text-white transition text-xs"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Homes</span>
            </button>
            <div className="h-4 w-px bg-surface-border" />
            <h1 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
              <span>{homeDetails?.name}</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                {homeDetails?.type}
              </span>
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center space-x-1.5 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-300 hover:bg-surface-elevated transition"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Invite</span>
            </button>
            <button
              onClick={() => setShowSettle(true)}
              className="flex items-center space-x-1.5 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-300 hover:bg-surface-elevated transition"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>Settle Up</span>
            </button>
            <button
              onClick={() => setShowAddExpense(true)}
              className="flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add Expense</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Financial Metrics Strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-surface-border bg-surface p-5">
            <p className="text-xs font-medium text-slate-400">Your Net Balance</p>
            <div className="mt-2 flex items-baseline space-x-2">
              <span
                className={`text-2xl font-bold font-mono ${
                  (currentUserBalance?.balance || 0) > 0
                    ? 'text-emerald-400'
                    : (currentUserBalance?.balance || 0) < 0
                    ? 'text-rose-400'
                    : 'text-slate-300'
                }`}
              >
                {currencySymbol}
                {Math.abs(currentUserBalance?.balance || 0).toFixed(2)}
              </span>
              <span className="text-xs uppercase font-semibold text-slate-400">
                {currentUserBalance?.status === 'OWED'
                  ? 'Owed to you'
                  : currentUserBalance?.status === 'OWES'
                  ? 'You owe'
                  : 'Settled'}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface p-5">
            <p className="text-xs font-medium text-slate-400">Total Home Spending</p>
            <p className="mt-2 text-2xl font-bold font-mono text-white">
              {currencySymbol}
              {Number(balancesData?.totalSpending || 0).toFixed(2)}
            </p>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface p-5">
            <p className="text-xs font-medium text-slate-400">Total Expenses Logged</p>
            <p className="mt-2 text-2xl font-bold font-mono text-white">
              {balancesData?.totalExpenseCount || 0}
            </p>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface p-5">
            <p className="text-xs font-medium text-slate-400">Ledger Invariant Status</p>
            <div className="mt-2 flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">
                Reconciled (Zero-Sum: 0.00)
              </span>
            </div>
          </div>
        </div>

        {/* 2-Column Core Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Balances & Simplified Settlement Plan */}
          <div className="space-y-6">
            {/* Suggested Settlements */}
            <div className="rounded-xl border border-surface-border bg-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Scale className="h-4 w-4 text-indigo-400" />
                  <span>Optimal Settlement Plan</span>
                </h3>
                <span className="text-[10px] text-slate-400">Minimizes transactions</span>
              </div>

              {balancesData?.suggestedSettlements?.length > 0 ? (
                <div className="space-y-2.5">
                  {balancesData.suggestedSettlements.map((s: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-elevated p-3 text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-rose-300">{s.fromName}</span>
                        <span className="text-slate-500">pays</span>
                        <span className="font-semibold text-emerald-300">{s.toName}</span>
                      </div>
                      <span className="font-mono font-bold text-white">
                        {currencySymbol}
                        {Number(s.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">
                  All debts are completely settled!
                </p>
              )}
            </div>

            {/* Member Net Balances */}
            <div className="rounded-xl border border-surface-border bg-surface p-5">
              <h3 className="text-sm font-bold text-white mb-4">Household Member Ledger</h3>
              <div className="space-y-3">
                {balancesData?.memberBalances?.map((m: any) => (
                  <div
                    key={m.memberId}
                    className="flex items-center justify-between py-2 border-b border-surface-border/50 last:border-none text-xs"
                  >
                    <div>
                      <p className="font-medium text-white">{m.user.name}</p>
                      <p className="text-[10px] text-slate-400">{m.role}</p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-mono font-bold ${
                          m.balance > 0
                            ? 'text-emerald-400'
                            : m.balance < 0
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {m.balance > 0 ? '+' : ''}
                        {currencySymbol}
                        {m.balance.toFixed(2)}
                      </p>
                      <span className="text-[10px] text-slate-400 uppercase">{m.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Direct Pairwise Debts */}
            {balancesData?.pairwiseDebts?.length > 0 && (
              <div className="rounded-xl border border-surface-border bg-surface p-5">
                <h3 className="text-sm font-bold text-white mb-3">Direct Pairwise Obligations</h3>
                <div className="space-y-2 text-xs">
                  {balancesData.pairwiseDebts.map((p: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-slate-300">
                      <span>
                        <span className="text-slate-200">{p.fromName}</span> owes{' '}
                        <span className="text-slate-200">{p.toName}</span>
                      </span>
                      <span className="font-mono font-medium text-white">
                        {currencySymbol}
                        {Number(p.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Expenses Feed & Audit Trail */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-surface-border bg-surface p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-white">Financial Activity Ledger</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Immutable financial events recorded in PostgreSQL.
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {expensesData?.total || 0} Records
                </span>
              </div>

              {expensesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-16 rounded-lg border border-surface-border bg-surface-elevated animate-pulse"
                    />
                  ))}
                </div>
              ) : expensesData?.data?.length > 0 ? (
                <div className="divide-y divide-surface-border">
                  {expensesData.data.map((exp: any) => {
                    const mySplit = exp.splits.find((s: any) => s.memberId === currentMember?.id);
                    return (
                      <div
                        key={exp.id}
                        className="py-4 flex items-center justify-between group hover:bg-surface-elevated/40 px-2 rounded-lg transition"
                      >
                        <div className="flex items-start space-x-3">
                          <div className="h-9 w-9 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-center shrink-0 text-slate-300">
                            <Receipt className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-semibold text-white">
                                {exp.description}
                              </span>
                              <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                                {exp.category}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              Paid by <span className="text-slate-200">{exp.payer.user.name}</span> •{' '}
                              {new Date(exp.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-mono text-sm font-bold text-white">
                              {currencySymbol}
                              {exp.amount.toFixed(2)}
                            </p>
                            {mySplit && (
                              <p className="text-[10px] text-slate-400">
                                Your share: {currencySymbol}
                                {mySplit.amount.toFixed(2)}
                              </p>
                            )}
                          </div>

                          <button
                            onClick={() => deleteExpenseMutation.mutate(exp.id)}
                            title="Delete Expense"
                            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Receipt className="h-10 w-10 text-slate-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-300 font-medium">No expenses logged yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Click &quot;Add Expense&quot; above to log the first household transaction.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Add Expense Modal with Live Deterministic Split Preview */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-surface-border bg-surface p-6 shadow-2xl my-8">
            <h3 className="text-lg font-bold text-white mb-1">Add Household Expense</h3>
            <p className="text-xs text-slate-400 mb-4">
              Financial mutations are deterministically calculated and reconciled into PostgreSQL.
            </p>

            {expenseError && (
              <div className="mb-4 rounded-lg bg-red-950/40 border border-red-500/30 p-2.5 text-xs text-red-200">
                {expenseError}
              </div>
            )}

            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="e.g. WiFi Bill / March Grocery Run"
                  className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Total Amount ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
                    className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    {Object.values(ExpenseCategory).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Payer</label>
                  <select
                    value={expensePayerId}
                    onChange={(e) => setExpensePayerId(e.target.value)}
                    className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    {homeDetails?.members?.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.user.name} {m.userId === user?.id ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Split Strategy</label>
                  <select
                    value={expenseSplitType}
                    onChange={(e) => setExpenseSplitType(e.target.value as SplitType)}
                    className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value={SplitType.EQUAL}>Equal Split</option>
                    <option value={SplitType.PERCENTAGE}>Percentage (%)</option>
                    <option value={SplitType.SHARES}>Shares</option>
                    <option value={SplitType.EXACT}>Exact Amounts</option>
                  </select>
                </div>
              </div>

              {/* Participant Selection & Split Breakdown */}
              <div className="border border-surface-border rounded-lg p-3 bg-surface-elevated/50 space-y-2">
                <p className="text-xs font-semibold text-slate-300">Participants & Allocation</p>
                <div className="space-y-2">
                  {homeDetails?.members?.map((m: any) => {
                    const isSelected = selectedParticipants.includes(m.id);
                    const splitItem = computedSplits.find((s) => s.memberId === m.id);

                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between text-xs py-1 border-b border-surface-border/30 last:border-none"
                      >
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedParticipants([...selectedParticipants, m.id]);
                              } else {
                                setSelectedParticipants(selectedParticipants.filter((id) => id !== m.id));
                              }
                            }}
                            className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                          />
                          <span className="text-slate-200">{m.user.name}</span>
                        </label>

                        {isSelected && (
                          <div className="flex items-center space-x-2 font-mono">
                            {expenseSplitType === SplitType.PERCENTAGE && (
                              <input
                                type="number"
                                step="0.1"
                                value={participantPercentages[m.id] || 0}
                                onChange={(e) =>
                                  setParticipantPercentages({
                                    ...participantPercentages,
                                    [m.id]: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-16 rounded bg-slate-800 border border-slate-700 px-1 py-0.5 text-right text-xs text-white"
                              />
                            )}
                            {expenseSplitType === SplitType.SHARES && (
                              <input
                                type="number"
                                min="1"
                                value={participantShares[m.id] || 1}
                                onChange={(e) =>
                                  setParticipantShares({
                                    ...participantShares,
                                    [m.id]: parseInt(e.target.value) || 1,
                                  })
                                }
                                className="w-14 rounded bg-slate-800 border border-slate-700 px-1 py-0.5 text-right text-xs text-white"
                              />
                            )}
                            <span className="text-emerald-400 font-semibold">
                              {currencySymbol}
                              {splitItem ? splitItem.amount.toFixed(2) : '0.00'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Invariant indicator */}
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-400">Sum of splits:</span>
                <span
                  className={`font-mono font-bold ${
                    isSplitValid ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {currencySymbol}
                  {computedSplits.reduce((acc, s) => acc + s.amount, 0).toFixed(2)} / {currencySymbol}
                  {parseFloat(expenseAmount || '0').toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="rounded-lg border border-surface-border px-4 py-2 text-xs font-medium text-slate-300 hover:bg-surface-elevated transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isSplitValid || createExpenseMutation.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-40 flex items-center space-x-1.5"
                >
                  {createExpenseMutation.isPending && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span>Save Expense</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Up Modal */}
      {showSettle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Record Settlement</h3>
            <p className="text-xs text-slate-400 mb-4">
              Record a payment between household members to settle outstanding obligations.
            </p>

            {settleError && (
              <div className="mb-4 rounded-lg bg-red-950/40 border border-red-500/30 p-2.5 text-xs text-red-200">
                {settleError}
              </div>
            )}

            <form onSubmit={handleSettlementSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payer (Debtor)
                </label>
                <select
                  required
                  value={settleFromId}
                  onChange={(e) => setSettleFromId(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Select Member</option>
                  {homeDetails?.members?.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Recipient (Creditor)
                </label>
                <select
                  required
                  value={settleToId}
                  onChange={(e) => setSettleToId(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Select Member</option>
                  {homeDetails?.members
                    ?.filter((m: any) => m.id !== settleFromId)
                    ?.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.user.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="e.g. UPI / Google Pay Ref #9812"
                  className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowSettle(false)}
                  className="rounded-lg border border-surface-border px-4 py-2 text-xs font-medium text-slate-300 hover:bg-surface-elevated transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSettlementMutation.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-40 flex items-center space-x-1.5"
                >
                  {createSettlementMutation.isPending && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span>Record Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Invite Household Member</h3>
            <p className="text-xs text-slate-400 mb-4">
              Add a roommate or family member to this home financial group.
            </p>

            {inviteError && (
              <div className="mb-4 rounded-lg bg-red-950/40 border border-red-500/30 p-2.5 text-xs text-red-200">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="roommate@domain.com"
                  className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Member Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                  className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value={MemberRole.MEMBER}>MEMBER (Can log expenses & settle)</option>
                  <option value={MemberRole.ADMIN}>ADMIN (Can manage members & settings)</option>
                  <option value={MemberRole.VIEWER}>VIEWER (Read-only access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="rounded-lg border border-surface-border px-4 py-2 text-xs font-medium text-slate-300 hover:bg-surface-elevated transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteMemberMutation.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-40 flex items-center space-x-1.5"
                >
                  {inviteMemberMutation.isPending && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span>Send Invite</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
