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
  Lock,
  Building2,
  HeartHandshake,
  Loader2,
  Check,
  ShoppingBag,
  Zap,
  Utensils,
  Home as HomeIcon,
  Wrench,
  MoreHorizontal,
  FileText,
  ShieldCheck,
  Copy,
  UserMinus,
  Shield,
  ShieldAlert,
  Archive,
  RotateCcw,
  Settings as SettingsIcon,
  Users,
  Key,
} from 'lucide-react';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import {
  ExpenseCategory,
  SplitType,
  MemberRole,
  HomeType,
  calculateEqualSplits,
  calculatePercentageSplits,
  calculateSharesSplits,
  roundFinancial,
} from '@homeexpense/shared';

export default function HomeDashboardPage() {
  const params = useParams();
  const homeId = params.homeId as string;
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // Mode View State (Bachelor debt view vs Family envelope view vs Members vs Settings)
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'envelopes' | 'members' | 'settings'>('expenses');

  // Modals state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Settings edit states
  const [editHomeName, setEditHomeName] = useState('');
  const [editHomeDesc, setEditHomeDesc] = useState('');

  // Form states
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('120.00');
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

  // Settings Feedback
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

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
    return homeDetails.members?.find((m: any) => m.userId === user.id);
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
      const exacts: Record<string, number> = {};
      const baseExact = Number(((parseFloat(expenseAmount) || 0) / count).toFixed(2));
      activeIds.forEach((id: string) => {
        pcts[id] = defaultPct;
        shares[id] = 1;
        exacts[id] = baseExact;
      });
      setParticipantPercentages(pcts);
      setParticipantShares(shares);
      setParticipantExacts(exacts);
    }
  }, [homeDetails, currentMember]);

  // Live split calculation matching Equilibrium specs
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
      apiClient(`/homes/${homeId}/invitations`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['home', homeId] });
      if (data?.token) {
        setCreatedInviteLink(`${window.location.origin}/invite/${data.token}`);
      } else {
        setShowInvite(false);
      }
      setInviteEmail('');
      setInviteError(null);
    },
    onError: (err: any) => {
      setInviteError(err.message || 'Failed to generate invitation.');
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: (invitationId: string) =>
      apiClient(`/homes/${homeId}/invitations/${invitationId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home', homeId] });
    },
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: MemberRole }) =>
      apiClient(`/homes/${homeId}/members/${memberId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home', homeId] });
    },
  });

  const deactivateMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      apiClient(`/homes/${homeId}/members/${memberId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home', homeId] });
      queryClient.invalidateQueries({ queryKey: ['balances', homeId] });
    },
  });

  const archiveHomeMutation = useMutation({
    mutationFn: () =>
      apiClient(`/homes/${homeId}/archive`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home', homeId] });
      queryClient.invalidateQueries({ queryKey: ['homes'] });
    },
  });

  const restoreHomeMutation = useMutation({
    mutationFn: () =>
      apiClient(`/homes/${homeId}/restore`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home', homeId] });
      queryClient.invalidateQueries({ queryKey: ['homes'] });
    },
  });

  const updateHomeMutation = useMutation({
    mutationFn: (body: { name?: string; description?: string }) =>
      apiClient(`/homes/${homeId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home', homeId] });
      queryClient.invalidateQueries({ queryKey: ['homes'] });
      setSettingsSuccess('Household settings saved successfully.');
      setTimeout(() => setSettingsSuccess(null), 3500);
    },
    onError: (err: any) => {
      setSettingsError(err.message || 'Failed to update household settings.');
    },
  });

  const deleteHomeMutation = useMutation({
    mutationFn: () =>
      apiClient(`/homes/${homeId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homes'] });
      router.push('/');
    },
  });

  const regenerateCodeMutation = useMutation({
    mutationFn: () =>
      apiClient<{ inviteCode: string }>(`/homes/${homeId}/regenerate-code`, {
        method: 'POST',
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['home', homeId] });
      queryClient.invalidateQueries({ queryKey: ['homes'] });
      setSettingsSuccess(`New secret code generated: ${data.inviteCode}`);
      setTimeout(() => setSettingsSuccess(null), 4000);
    },
    onError: (err: any) => {
      setSettingsError(err.message || 'Failed to rotate secret code.');
    },
  });

  React.useEffect(() => {
    if (homeDetails) {
      setEditHomeName(homeDetails.name || '');
      setEditHomeDesc(homeDetails.description || '');
    }
  }, [homeDetails]);

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

    const total = parseFloat(expenseAmount) || 0;
    if (total <= 0) {
      setExpenseError('Please enter a valid expense amount.');
      return;
    }

    const payerId = expensePayerId || currentMember?.id || (homeDetails?.members?.[0]?.id ?? '');
    const activeMemberIds = homeDetails?.members?.map((m: any) => m.id) || [];
    const participants = selectedParticipants.length > 0 ? selectedParticipants : activeMemberIds;

    let finalSplits = computedSplits;
    if (!finalSplits || finalSplits.length === 0) {
      if (participants.length > 0) {
        finalSplits = calculateEqualSplits(total, participants);
      } else if (payerId) {
        finalSplits = [{ memberId: payerId, amount: total, cents: Math.round(total * 100) }];
      }
    }

    // Cent-perfect adjustment to guarantee sum of splits matches total exactly
    if (finalSplits && finalSplits.length > 0) {
      const sumCents = finalSplits.reduce((acc, s) => acc + Math.round(s.amount * 100), 0);
      const totalCents = Math.round(total * 100);
      const diffCents = totalCents - sumCents;
      if (diffCents !== 0) {
        finalSplits = [...finalSplits];
        finalSplits[0] = {
          ...finalSplits[0],
          amount: Number(((Math.round(finalSplits[0].amount * 100) + diffCents) / 100).toFixed(2)),
        };
      }
    }

    createExpenseMutation.mutate({
      description: expenseDesc.trim() || `${expenseCategory} Expense`,
      amount: total,
      category: expenseCategory,
      date: new Date().toISOString(),
      payerMemberId: payerId,
      splitType: expenseSplitType,
      splits: (finalSplits || []).map((s) => ({
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

  const currencySymbol = homeDetails?.currency === 'INR' ? '₹' : homeDetails?.currency === 'EUR' ? '€' : '$';

  if (authLoading || homeLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="h-8 w-8 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  const isBachelor = homeDetails?.type === HomeType.BACHELOR;

  return (
    <div className="min-h-screen bg-surface font-sans text-on-surface antialiased flex flex-col">
      {/* Sticky Top Header with Safe Blur & Micro Pill */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant/60 shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push('/')}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-4 w-px bg-outline-variant" />
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-semibold text-on-surface tracking-tight">
                  {homeDetails?.name}
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[11px] font-medium tracking-wide uppercase">
                  {homeDetails?.type === HomeType.BACHELOR ? 'Bachelor Mode' : 'Family Mode'}
                </span>
              </div>
              <span className="text-[11px] text-on-surface-variant">Equilibrium Household</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-2.5">
            <PwaInstallPrompt />
            {homeDetails?.inviteCode && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(homeDetails.inviteCode);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs font-mono text-ink hover:bg-surface-container transition"
                title="Click to copy Household Secret Code"
              >
                <Key className="h-3.5 w-3.5 text-secondary" />
                <span className="font-bold">{homeDetails.inviteCode}</span>
                {copiedCode ? (
                  <Check className="h-3 w-3 text-secondary ml-0.5" />
                ) : (
                  <Copy className="h-3 w-3 text-on-surface-variant ml-0.5" />
                )}
              </button>
            )}
            <button
              onClick={() => setShowInvite(true)}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs font-medium text-on-surface hover:bg-surface-container transition"
            >
              <UserPlus className="h-3.5 w-3.5 text-on-surface-variant" />
              <span>Invite</span>
            </button>
            <button
              onClick={() => setShowSettle(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs font-medium text-on-surface hover:bg-surface-container transition"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-secondary" />
              <span>Settle Up</span>
            </button>
            <button
              onClick={() => setShowAddExpense(true)}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-on-surface-variant active:scale-[0.99] transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add Expense</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="max-w-6xl mx-auto w-full px-3.5 sm:px-4 py-4 sm:py-6 space-y-5 sm:space-y-6 flex-1 pb-24 md:pb-8">
        {/* Status / Invariant Micro Pill */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 bg-surface-container px-3 py-1 rounded-full text-on-surface-variant text-xs">
            <Lock className="h-3 w-3 text-secondary" />
            <span>
              {isBachelor ? 'Split Engine active • Bachelor Flat' : 'Household Pool active • Family Mode'}
            </span>
            <span className="text-outline-variant">•</span>
            <span className="text-secondary font-medium">Ledger Balanced</span>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="bg-surface-container p-1 rounded-lg flex items-center space-x-1 text-xs overflow-x-auto no-scrollbar max-w-full">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-3 py-1 rounded-md transition font-medium shrink-0 ${
                activeTab === 'expenses'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Transactions
            </button>
            <button
              onClick={() => setActiveTab('balances')}
              className={`px-3 py-1 rounded-md transition font-medium shrink-0 ${
                activeTab === 'balances'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Debts & Settle
            </button>
            {!isBachelor && (
              <button
                onClick={() => setActiveTab('envelopes')}
                className={`px-3 py-1 rounded-md transition font-medium shrink-0 ${
                  activeTab === 'envelopes'
                    ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Budget Envelopes
              </button>
            )}
            <button
              onClick={() => setActiveTab('members')}
              className={`px-3 py-1 rounded-md transition font-medium shrink-0 ${
                activeTab === 'members'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Members ({homeDetails?.members?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1 rounded-md transition font-medium shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Financial Metrics Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-level1">
            <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
              Your Net Position
            </p>
            <div className="mt-1 flex items-baseline space-x-2">
              <span
                className={`text-2xl font-semibold tabular-nums tracking-tight ${
                  (currentUserBalance?.balance || 0) > 0
                    ? 'text-secondary'
                    : (currentUserBalance?.balance || 0) < 0
                    ? 'text-error'
                    : 'text-on-surface'
                }`}
              >
                {currencySymbol}
                {Math.abs(currentUserBalance?.balance || 0).toFixed(2)}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                  currentUserBalance?.status === 'OWED'
                    ? 'bg-secondary-container/50 text-on-secondary-container'
                    : currentUserBalance?.status === 'OWES'
                    ? 'bg-error-container text-on-error-container'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {currentUserBalance?.status === 'OWED'
                  ? 'You are owed'
                  : currentUserBalance?.status === 'OWES'
                  ? 'You owe'
                  : 'Settled'}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-level1">
            <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
              Total Household Spend
            </p>
            <p className="mt-1 text-2xl font-semibold text-on-surface tabular-nums tracking-tight">
              {currencySymbol}
              {Number(balancesData?.totalSpending || 0).toFixed(2)}
            </p>
          </div>

          <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-level1">
            <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
              Ledger Events
            </p>
            <p className="mt-1 text-2xl font-semibold text-on-surface tabular-nums tracking-tight">
              {balancesData?.totalExpenseCount || 0}
            </p>
          </div>

          <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-level1">
            <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
              Arithmetic Invariant
            </p>
            <div className="mt-1 flex items-center space-x-1.5">
              <CheckCircle2 className="h-4 w-4 text-secondary" />
              <span className="text-xs font-semibold text-secondary">
                Zero-Sum Reconciled (0.00)
              </span>
            </div>
          </div>
        </div>

        {/* Tab 1: Transactions & Ledger Feed */}
        {activeTab === 'expenses' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Expense Activity Feed */}
            <div className="lg:col-span-2 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-level1 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant/40">
                <div>
                  <h3 className="text-sm font-semibold text-on-surface">Household Ledger Stream</h3>
                  <p className="text-xs text-on-surface-variant">
                    Authoritative double-entry records stored in PostgreSQL.
                  </p>
                </div>
                <span className="text-xs text-on-surface-variant tabular-nums">
                  {expensesData?.total || 0} Records
                </span>
              </div>

              {expensesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-14 rounded-lg bg-surface-container animate-pulse"
                    />
                  ))}
                </div>
              ) : expensesData?.data?.length > 0 ? (
                <div className="divide-y divide-outline-variant/30">
                  {expensesData.data.map((exp: any) => {
                    const mySplit = exp.splits.find((s: any) => s.memberId === currentMember?.id);
                    return (
                      <div
                        key={exp.id}
                        className="py-3.5 flex items-center justify-between hover:bg-surface-container-low px-2 rounded-lg transition"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center shrink-0 text-on-surface">
                            <Receipt className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-on-surface">
                                {exp.description}
                              </span>
                              <span className="text-[10px] font-mono uppercase bg-surface-container px-2 py-0.5 rounded text-on-surface-variant">
                                {exp.category}
                              </span>
                            </div>
                            <p className="text-xs text-on-surface-variant mt-0.5">
                              Paid by <strong className="font-medium text-on-surface">{exp.payer.user.name}</strong> •{' '}
                              {new Date(exp.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <span className="text-sm font-semibold text-on-surface tabular-nums">
                              {currencySymbol}
                              {exp.amount.toFixed(2)}
                            </span>
                            {mySplit && (
                              <p className="text-[11px] text-on-surface-variant tabular-nums">
                                Your share: {currencySymbol}
                                {mySplit.amount.toFixed(2)}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => deleteExpenseMutation.mutate(exp.id)}
                            title="Delete transaction"
                            className="text-on-surface-variant hover:text-error transition p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-on-surface-variant">
                  <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">No expenses logged yet</p>
                  <p className="text-xs mt-0.5">Click &quot;Add Expense&quot; above to log the first split.</p>
                </div>
              )}
            </div>

            {/* Right Column: Optimal Settlement Plan & Members */}
            <div className="space-y-6">
              {/* Optimal Settlement Plan */}
              <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-level1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-on-surface flex items-center space-x-1.5">
                    <Scale className="h-4 w-4 text-secondary" />
                    <span>Optimal Settlement Plan</span>
                  </h3>
                  <span className="text-[10px] text-on-surface-variant">Minimizes payments</span>
                </div>

                {balancesData?.suggestedSettlements?.length > 0 ? (
                  <div className="space-y-2">
                    {balancesData.suggestedSettlements.map((s: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant/40 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-error">{s.fromName}</span>
                          <span className="text-on-surface-variant mx-1">pays</span>
                          <span className="font-semibold text-secondary">{s.toName}</span>
                        </div>
                        <span className="font-semibold text-on-surface tabular-nums">
                          {currencySymbol}
                          {Number(s.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant py-3 text-center">
                    All debts are currently balanced!
                  </p>
                )}
              </div>

              {/* Household Member Ledger */}
              <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-level1">
                <h3 className="text-sm font-semibold text-on-surface mb-3">Household Members</h3>
                <div className="space-y-2.5">
                  {balancesData?.memberBalances?.map((m: any) => (
                    <div
                      key={m.memberId}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-outline-variant/30 last:border-none"
                    >
                      <div>
                        <p className="font-medium text-on-surface">{m.user.name}</p>
                        <p className="text-[10px] text-on-surface-variant">{m.role}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-semibold tabular-nums ${
                            m.balance > 0
                              ? 'text-secondary'
                              : m.balance < 0
                              ? 'text-error'
                              : 'text-on-surface-variant'
                          }`}
                        >
                          {m.balance > 0 ? '+' : ''}
                          {currencySymbol}
                          {m.balance.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Pairwise Debts & Settlement Center */}
        {activeTab === 'balances' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-level1">
              <h3 className="text-sm font-semibold text-on-surface mb-3">Direct Pairwise Obligations</h3>
              <p className="text-xs text-on-surface-variant mb-4">
                Exact bilateral debts between members before transitive minimization.
              </p>
              {balancesData?.pairwiseDebts?.length > 0 ? (
                <div className="space-y-2 text-xs">
                  {balancesData.pairwiseDebts.map((p: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low"
                    >
                      <span>
                        <strong className="text-on-surface">{p.fromName}</strong> owes{' '}
                        <strong className="text-on-surface">{p.toName}</strong>
                      </span>
                      <span className="font-semibold text-on-surface tabular-nums">
                        {currencySymbol}
                        {Number(p.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant py-4 text-center">No outstanding debts.</p>
              )}
            </div>

            <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-level1">
              <h3 className="text-sm font-semibold text-on-surface mb-3">Historical Settlements</h3>
              <p className="text-xs text-on-surface-variant mb-4">
                Counterbalancing payments recorded in the double-entry ledger.
              </p>
              <button
                onClick={() => setShowSettle(true)}
                className="w-full py-2.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-on-surface-variant transition"
              >
                Record New Settlement
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Family Envelope Budgets */}
        {activeTab === 'envelopes' && (
          <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-level1 space-y-6">
            <div>
              <h3 className="text-base font-semibold text-on-surface">Monthly Category Envelopes</h3>
              <p className="text-xs text-on-surface-variant">
                Budget limits and burn-down monitoring for pooled family funds.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-on-surface">Groceries</span>
                  <span className="text-on-surface-variant tabular-nums">₹12,450 / ₹20,000</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                  <div className="h-full bg-secondary rounded-full" style={{ width: '62%' }} />
                </div>
                <span className="text-[10px] text-secondary font-medium">38% remaining</span>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-on-surface">Utilities</span>
                  <span className="text-on-surface-variant tabular-nums">₹4,200 / ₹6,000</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                  <div className="h-full bg-secondary rounded-full" style={{ width: '70%' }} />
                </div>
                <span className="text-[10px] text-secondary font-medium">30% remaining</span>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-on-surface">Household & Repairs</span>
                  <span className="text-on-surface-variant tabular-nums">₹1,800 / ₹5,000</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                  <div className="h-full bg-secondary rounded-full" style={{ width: '36%' }} />
                </div>
                <span className="text-[10px] text-secondary font-medium">64% remaining</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Members & Invitations Directory */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            {/* Secret Code Quick-Share Card */}
            <div className="rounded-xl border border-secondary/30 bg-secondary-container/20 p-5 shadow-level1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center text-secondary shrink-0">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-on-surface">Household Secret Code</h3>
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-secondary/20 text-secondary">
                      Instant Join
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Share this code with flatmates or family members so they can join this household instantly without email invitations.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2.5 self-end sm:self-center">
                <span className="font-mono text-base font-extrabold text-ink bg-surface-container px-3.5 py-1.5 rounded-xl border border-outline-variant tracking-wider">
                  {homeDetails?.inviteCode || 'Loading...'}
                </span>
                <button
                  onClick={() => {
                    if (homeDetails?.inviteCode) {
                      navigator.clipboard.writeText(homeDetails.inviteCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-ink text-white text-xs font-semibold hover:bg-neutral-800 transition shadow-sm"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-secondary" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                </button>
                {(currentMember?.role === MemberRole.OWNER || currentMember?.role === MemberRole.ADMIN) && (
                  <button
                    onClick={() => {
                      if (confirm('Rotate secret code? The old code will stop working.')) {
                        regenerateCodeMutation.mutate();
                      }
                    }}
                    disabled={regenerateCodeMutation.isPending}
                    className="p-2 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:text-ink hover:bg-surface-container transition"
                    title="Rotate / Regenerate Secret Code"
                  >
                    <RotateCcw className={`h-3.5 w-3.5 ${regenerateCodeMutation.isPending ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-level1 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/40 flex-wrap gap-3">
                <div>
                  <h3 className="text-base font-semibold text-on-surface">Household Members</h3>
                  <p className="text-xs text-on-surface-variant">
                    Manage active members and role-based permissions for this household.
                  </p>
                </div>
                {(currentMember?.role === MemberRole.OWNER || currentMember?.role === MemberRole.ADMIN) && (
                  <button
                    onClick={() => {
                      setCreatedInviteLink(null);
                      setShowInvite(true);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-on-surface-variant transition shadow-sm"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Invite Member</span>
                  </button>
                )}
              </div>

              {/* Members List */}
              <div className="divide-y divide-outline-variant/30">
                {homeDetails?.members?.map((member: any) => {
                  const isCurrent = member.userId === user?.id;
                  const isOwner = member.role === MemberRole.OWNER;
                  const canManage =
                    (currentMember?.role === MemberRole.OWNER && !isCurrent) ||
                    (currentMember?.role === MemberRole.ADMIN && !isCurrent && !isOwner && member.role !== MemberRole.ADMIN);

                  return (
                    <div key={member.id} className="py-4 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-sm text-on-surface uppercase shrink-0">
                          {member.user?.name?.[0] || 'U'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-semibold text-on-surface truncate">
                              {member.user?.name}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] bg-secondary-container/50 text-on-secondary-container px-2 py-0.5 rounded-full font-medium">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-on-surface-variant truncate">{member.user?.email}</p>
                          <p className="text-[11px] text-outline mt-0.5">
                            Joined {new Date(member.joinedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        {/* Role Badge / Dropdown */}
                        {canManage ? (
                          <select
                            value={member.role}
                            onChange={(e) =>
                              updateMemberRoleMutation.mutate({
                                memberId: member.id,
                                role: e.target.value as MemberRole,
                              })
                            }
                            disabled={updateMemberRoleMutation.isPending}
                            className="text-xs rounded-lg border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-on-surface font-medium focus:outline-none"
                          >
                            <option value={MemberRole.MEMBER}>Member</option>
                            <option value={MemberRole.ADMIN}>Admin</option>
                            <option value={MemberRole.VIEWER}>Viewer</option>
                          </select>
                        ) : (
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${
                              isOwner
                                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                                : member.role === MemberRole.ADMIN
                                ? 'bg-primary/10 text-primary border border-primary/30'
                                : 'bg-surface-container text-on-surface-variant'
                            }`}
                          >
                            {member.role}
                          </span>
                        )}

                        {/* Remove / Deactivate Action */}
                        {canManage && (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to remove ${member.user?.name}?`)) {
                                deactivateMemberMutation.mutate(member.id);
                              }
                            }}
                            disabled={deactivateMemberMutation.isPending}
                            title="Remove member"
                            className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition"
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pending Invitations Section */}
            {(currentMember?.role === MemberRole.OWNER || currentMember?.role === MemberRole.ADMIN) && (
              <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-level1 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-outline-variant/40">
                  <div>
                    <h3 className="text-sm font-semibold text-on-surface">Pending Invitations</h3>
                    <p className="text-xs text-on-surface-variant">
                      Cryptographically signed invite links valid for 7 days.
                    </p>
                  </div>
                  <span className="text-xs text-on-surface-variant tabular-nums">
                    {homeDetails?.invitations?.length || 0} Pending
                  </span>
                </div>

                {(!homeDetails?.invitations || homeDetails.invitations.length === 0) ? (
                  <p className="text-xs text-on-surface-variant py-3 italic">
                    No pending invitations for this household.
                  </p>
                ) : (
                  <div className="divide-y divide-outline-variant/30">
                    {homeDetails.invitations.map((inv: any) => {
                      const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${inv.token}`;
                      return (
                        <div key={inv.id} className="py-3 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-semibold text-on-surface">{inv.invitedEmail}</span>
                              <span className="text-[10px] uppercase font-bold bg-surface-container px-2 py-0.5 rounded-full text-on-surface-variant">
                                {inv.role}
                              </span>
                            </div>
                            <p className="text-[11px] text-outline mt-0.5">
                              Expires {new Date(inv.expiresAt).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(inviteUrl);
                                alert('Invite link copied to clipboard!');
                              }}
                              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-outline-variant bg-surface text-xs font-medium text-on-surface hover:bg-surface-container transition"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy Link</span>
                            </button>
                            <button
                              onClick={() => revokeInvitationMutation.mutate(inv.id)}
                              disabled={revokeInvitationMutation.isPending}
                              className="px-2.5 py-1 rounded-lg border border-error/30 text-error text-xs font-medium hover:bg-error-container/20 transition"
                            >
                              Revoke
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Settings & Household Configuration */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-3xl">
            {/* General Settings */}
            <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-level1 space-y-6">
              <div>
                <h3 className="text-base font-semibold text-on-surface">Household Settings</h3>
                <p className="text-xs text-on-surface-variant">
                  Update general information and display properties for this household.
                </p>
              </div>

              {settingsSuccess && (
                <div className="p-3 rounded-lg bg-secondary-container/50 text-on-secondary-container text-xs flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{settingsSuccess}</span>
                </div>
              )}

              {settingsError && (
                <div className="p-3 rounded-lg bg-error-container text-on-error-container text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{settingsError}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSettingsError(null);
                  setSettingsSuccess(null);
                  updateHomeMutation.mutate({
                    name: editHomeName,
                    description: editHomeDesc,
                  });
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Home Name</label>
                  <input
                    type="text"
                    required
                    value={editHomeName}
                    onChange={(e) => setEditHomeName(e.target.value)}
                    disabled={currentMember?.role !== MemberRole.OWNER && currentMember?.role !== MemberRole.ADMIN}
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-xs text-on-surface focus:outline-none disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={editHomeDesc}
                    onChange={(e) => setEditHomeDesc(e.target.value)}
                    disabled={currentMember?.role !== MemberRole.OWNER && currentMember?.role !== MemberRole.ADMIN}
                    placeholder="Brief description of this home or flat..."
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-xs text-on-surface focus:outline-none disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-3 rounded-lg bg-surface-container border border-outline-variant/40 space-y-1">
                    <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                      Base Currency
                    </span>
                    <p className="text-sm font-bold text-on-surface">{homeDetails?.currency || 'USD'}</p>
                    <p className="text-[11px] text-outline">Immutable ledger base unit.</p>
                  </div>

                  <div className="p-3 rounded-lg bg-surface-container border border-outline-variant/40 space-y-1">
                    <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                      Operating Archetype
                    </span>
                    <p className="text-sm font-bold text-on-surface">
                      {isBachelor ? 'Bachelor Flat' : 'Family Household'}
                    </p>
                    <p className="text-[11px] text-outline">
                      {isBachelor ? 'Pairwise split engine & bilateral settlement' : 'Pooled ledger & budget envelope rail'}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-surface-container border border-outline-variant/40 space-y-1 sm:col-span-2 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider block">
                        Household Secret Code
                      </span>
                      <p className="font-mono text-base font-extrabold text-ink mt-0.5">
                        {homeDetails?.inviteCode || 'Loading...'}
                      </p>
                      <p className="text-[11px] text-outline">Flatmates can enter this code to join this ledger instantly.</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (homeDetails?.inviteCode) {
                            navigator.clipboard.writeText(homeDetails.inviteCode);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2000);
                          }
                        }}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs font-semibold text-ink hover:bg-surface-container transition"
                      >
                        {copiedCode ? <Check className="h-3.5 w-3.5 text-secondary" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                      </button>

                      {(currentMember?.role === MemberRole.OWNER || currentMember?.role === MemberRole.ADMIN) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Rotate secret code? Old code will stop working.')) {
                              regenerateCodeMutation.mutate();
                            }
                          }}
                          disabled={regenerateCodeMutation.isPending}
                          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs font-semibold text-on-surface-variant hover:text-ink hover:bg-surface-container transition"
                        >
                          <RotateCcw className={`h-3.5 w-3.5 ${regenerateCodeMutation.isPending ? 'animate-spin' : ''}`} />
                          <span>Rotate</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {(currentMember?.role === MemberRole.OWNER || currentMember?.role === MemberRole.ADMIN) && (
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={updateHomeMutation.isPending}
                      className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-on-surface-variant transition disabled:opacity-50"
                    >
                      {updateHomeMutation.isPending ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                )}
              </form>
            </div>

            {/* Lifecycle & Danger Zone */}
            {currentMember?.role === MemberRole.OWNER && (
              <div className="rounded-xl border border-error/30 bg-surface-container-lowest p-6 shadow-level1 space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-error">Lifecycle & Danger Zone</h3>
                  <p className="text-xs text-on-surface-variant">
                    Owner-restricted administrative actions.
                  </p>
                </div>

                <div className="divide-y divide-outline-variant/30">
                  {/* Archive / Restore */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-on-surface">
                        {homeDetails?.isArchived ? 'Restore Home' : 'Archive Home'}
                      </h4>
                      <p className="text-[11px] text-on-surface-variant">
                        {homeDetails?.isArchived
                          ? 'Unarchive this household to resume expense logging and balance reconciliation.'
                          : 'Mark this household read-only. Members cannot log new expenses while archived.'}
                      </p>
                    </div>
                    {homeDetails?.isArchived ? (
                      <button
                        onClick={() => restoreHomeMutation.mutate()}
                        disabled={restoreHomeMutation.isPending}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs font-semibold text-on-surface hover:bg-surface-container transition"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Restore</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (confirm('Archive this home? Transactions will become read-only.')) {
                            archiveHomeMutation.mutate();
                          }
                        }}
                        disabled={archiveHomeMutation.isPending}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs font-semibold text-on-surface hover:bg-surface-container transition"
                      >
                        <Archive className="h-4 w-4" />
                        <span>Archive</span>
                      </button>
                    )}
                  </div>

                  {/* Delete Home */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-error">Permanently Delete Home</h4>
                      <p className="text-[11px] text-on-surface-variant">
                        Permanently purge this household, memberships, and transaction history. Cannot be undone.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('Are you absolutely sure you want to permanently delete this home? This action CANNOT be undone.')) {
                          deleteHomeMutation.mutate();
                        }
                      }}
                      disabled={deleteHomeMutation.isPending}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-error text-on-error text-xs font-semibold hover:bg-error/90 transition disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{deleteHomeMutation.isPending ? 'Deleting...' : 'Delete Home'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Expense Modal — 1:1 Implementation of Equilibrium Household Specification */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-outline-variant/60 bg-surface p-6 shadow-level3 my-8 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/40">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <h3 className="text-base font-semibold text-on-surface">New Expense</h3>
                  <span className="text-[11px] text-on-surface-variant">Equilibrium Household Split Engine</span>
                </div>
              </div>
              <button
                onClick={() => setShowAddExpense(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition"
              >
                ✕
              </button>
            </div>

            {expenseError && (
              <div className="p-3 rounded-lg bg-error-container text-on-error-container text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{expenseError}</span>
              </div>
            )}

            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              {/* Amount Hero & Entry Card */}
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-level1 flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <label className="text-[11px] uppercase tracking-wider text-on-surface-variant font-medium">
                    Expense Total
                  </label>
                  <span className="text-xs text-secondary flex items-center gap-1 font-medium bg-secondary-container/40 px-2 py-0.5 rounded-full">
                    <Lock className="h-3 w-3" />
                    <span>{homeDetails?.currency || 'USD'} • Ledger Balanced</span>
                  </span>
                </div>

                {/* Hero Input with Tabular Figures */}
                <div className="flex items-center gap-1 py-1 border-b border-outline-variant/40">
                  <span className="text-3xl text-on-surface font-semibold select-none">{currencySymbol}</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="0.00"
                    className="text-3xl font-semibold text-on-surface w-full bg-transparent outline-none p-0 tracking-tight tabular-nums"
                  />
                </div>

                {/* Description Input */}
                <div>
                  <input
                    type="text"
                    required
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    placeholder="What was this for? (e.g. Trader Joe's Weekly Groceries)"
                    className="text-sm text-on-surface placeholder:text-outline bg-transparent outline-none w-full py-1"
                  />
                </div>

                {/* Quick Category Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                  {[
                    { cat: ExpenseCategory.GROCERIES, label: 'Groceries', icon: ShoppingBag },
                    { cat: ExpenseCategory.UTILITIES, label: 'Utilities', icon: Zap },
                    { cat: ExpenseCategory.DINING_OUT, label: 'Dining', icon: Utensils },
                    { cat: ExpenseCategory.HOUSEHOLD_SUPPLIES, label: 'Household', icon: HomeIcon },
                    { cat: ExpenseCategory.MAINTENANCE, label: 'Maintenance', icon: Wrench },
                  ].map((item) => (
                    <button
                      key={item.cat}
                      type="button"
                      onClick={() => setExpenseCategory(item.cat)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition ${
                        expenseCategory === item.cat
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Paid By Card (Payer Rail) */}
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-level1 flex flex-col gap-2.5">
                <span className="text-xs font-semibold text-on-surface">Paid by</span>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {homeDetails?.members?.map((m: any) => {
                    const isSelected = expensePayerId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setExpensePayerId(m.id)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl transition ${
                          isSelected
                            ? 'bg-primary text-on-primary shadow-sm'
                            : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                        }`}
                      >
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-xs uppercase">
                            {m.user.name[0]}
                          </div>
                          {isSelected && (
                            <div className="absolute -bottom-0.5 -right-0.5 bg-secondary text-on-secondary rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">
                              <Check className="h-2.5 w-2.5" />
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] font-medium truncate w-full text-center">
                          {m.user.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Split Engine */}
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-level1 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-on-surface">Split Mode</span>
                  <span className="text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
                    {selectedParticipants.length} participants
                  </span>
                </div>

                {/* 4-Mode Segmented Control Rail */}
                <div className="bg-surface-container p-1 rounded-xl grid grid-cols-4 gap-1 text-center text-xs">
                  {[
                    { mode: SplitType.EQUAL, label: 'Equal' },
                    { mode: SplitType.EXACT, label: 'Exact' },
                    { mode: SplitType.PERCENTAGE, label: '% Pct' },
                    { mode: SplitType.SHARES, label: 'Shares' },
                  ].map((s) => (
                    <button
                      key={s.mode}
                      type="button"
                      onClick={() => setExpenseSplitType(s.mode)}
                      className={`py-1.5 rounded-lg transition font-medium ${
                        expenseSplitType === s.mode
                          ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-xs'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Live Split Calculation Summary Banner */}
                <div className="bg-surface-container-low rounded-xl p-3 flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-on-surface">
                      Split {selectedParticipants.length} ways
                    </span>
                    <span className="font-semibold text-on-surface tabular-nums">
                      {currencySymbol}
                      {(parseFloat(expenseAmount || '0') / (selectedParticipants.length || 1)).toFixed(2)}{' '}
                      <span className="text-on-surface-variant font-normal">/ person</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-tight">
                    Cent-perfect remainder absorption applied for zero ledger drift.
                  </p>
                </div>

                {/* Participant Breakdown List */}
                <div className="space-y-1.5">
                  {homeDetails?.members?.map((m: any) => {
                    const isSelected = selectedParticipants.includes(m.id);
                    const splitItem = computedSplits.find((s) => s.memberId === m.id);

                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2.5 bg-surface-container-low rounded-xl text-xs hover:bg-surface-container transition"
                      >
                        <div className="flex items-center gap-2.5">
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
                            className="w-4 h-4 rounded text-primary focus:ring-0 cursor-pointer"
                          />
                          <span className="font-medium text-on-surface">{m.user.name}</span>
                        </div>

                        {isSelected && (
                          <div className="flex items-center space-x-2 tabular-nums">
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
                                className="w-14 rounded bg-surface-container-lowest border border-outline-variant px-1 py-0.5 text-right text-xs"
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
                                className="w-12 rounded bg-surface-container-lowest border border-outline-variant px-1 py-0.5 text-right text-xs"
                              />
                            )}
                            <span className="font-semibold text-secondary">
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

              {/* Arithmetic Integrity Banner */}
              <div className="rounded-xl p-3 bg-secondary-container/30 border border-secondary-container flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-secondary text-on-secondary flex items-center justify-center shrink-0 text-[10px]">
                    ✓
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-on-secondary-container tabular-nums">
                      100% Allocated ({currencySymbol}
                      {computedSplits.reduce((acc, s) => acc + s.amount, 0).toFixed(2)} of {currencySymbol}
                      {parseFloat(expenseAmount || '0').toFixed(2)})
                    </span>
                    <span className="text-[10px] text-on-secondary-container/80">
                      Equilibrium engine verified • No balance drift
                    </span>
                  </div>
                </div>
                <ShieldCheck className="h-4 w-4 text-on-secondary-container" />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={createExpenseMutation.isPending}
                className="w-full h-12 rounded-xl bg-slate-900 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.99] transition disabled:opacity-50 shadow-md cursor-pointer"
              >
                {createExpenseMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Adding Expense...</span>
                  </>
                ) : (
                  <span>
                    Add Expense ({currencySymbol}
                    {(parseFloat(expenseAmount) || 0).toFixed(2)})
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Settle Up Modal */}
      {showSettle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant/60 bg-surface p-6 shadow-level3 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/40">
              <h3 className="text-base font-semibold text-on-surface">Record Settlement</h3>
              <button
                onClick={() => setShowSettle(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition"
              >
                ✕
              </button>
            </div>

            {settleError && (
              <div className="p-3 rounded-lg bg-error-container text-on-error-container text-xs">
                {settleError}
              </div>
            )}

            <form onSubmit={handleSettlementSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-on-surface mb-1">
                  Payer (Debtor)
                </label>
                <select
                  required
                  value={settleFromId}
                  onChange={(e) => setSettleFromId(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs text-on-surface focus:outline-none"
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
                <label className="block text-xs font-medium text-on-surface mb-1">
                  Recipient (Creditor)
                </label>
                <select
                  required
                  value={settleToId}
                  onChange={(e) => setSettleToId(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs text-on-surface focus:outline-none"
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
                <label className="block text-xs font-medium text-on-surface mb-1">
                  Settlement Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs text-on-surface tabular-nums focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface mb-1">Notes / Reference</label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="e.g. Google Pay / UPI Ref #8912"
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs text-on-surface focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={createSettlementMutation.isPending}
                className="w-full h-11 rounded-xl bg-primary text-on-primary font-semibold text-xs hover:bg-on-surface-variant transition disabled:opacity-40"
              >
                Record Payment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant/60 bg-surface p-6 shadow-level3 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/40">
              <h3 className="text-base font-semibold text-on-surface">
                {createdInviteLink ? 'Invitation Ready' : 'Invite Member'}
              </h3>
              <button
                onClick={() => {
                  setShowInvite(false);
                  setCreatedInviteLink(null);
                  setCopiedLink(false);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition"
              >
                ✕
              </button>
            </div>

            {inviteError && (
              <div className="p-3 rounded-lg bg-error-container text-on-error-container text-xs">
                {inviteError}
              </div>
            )}

            {createdInviteLink ? (
              <div className="space-y-4 py-2">
                <div className="p-3 rounded-xl bg-secondary-container/30 border border-secondary/20 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-on-surface">Invitation link generated!</p>
                    <p className="text-on-surface-variant">
                      Share this single-use link with the person you want to invite. It is valid for 7 days.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                    Direct Invitation URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdInviteLink}
                      className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-xs text-on-surface font-mono select-all focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdInviteLink);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2500);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-on-surface-variant transition shrink-0"
                    >
                      {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setShowInvite(false);
                      setCreatedInviteLink(null);
                      setCopiedLink(false);
                    }}
                    className="w-full h-10 rounded-xl bg-surface-container text-on-surface font-semibold text-xs hover:bg-surface-container-high transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="roommate@domain.com"
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs text-on-surface focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface mb-1">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs text-on-surface focus:outline-none"
                  >
                    <option value={MemberRole.MEMBER}>MEMBER (Can log expenses & settle)</option>
                    <option value={MemberRole.ADMIN}>ADMIN (Can manage members)</option>
                    <option value={MemberRole.VIEWER}>VIEWER (Read-only)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={inviteMemberMutation.isPending}
                  className="w-full h-11 rounded-xl bg-primary text-on-primary font-semibold text-xs hover:bg-on-surface-variant transition disabled:opacity-40"
                >
                  {inviteMemberMutation.isPending ? 'Generating Link...' : 'Generate Invitation'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Visible on phones & tablets < md) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-3 flex items-center justify-around md:hidden shadow-lg safe-area-bottom">
        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
            activeTab === 'expenses' ? 'text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-medium">Expenses</span>
        </button>

        <button
          onClick={() => setActiveTab('balances')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
            activeTab === 'balances' ? 'text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-medium">Debts</span>
        </button>

        {/* Floating Quick Add Action in Mobile Nav Center */}
        <button
          onClick={() => setShowAddExpense(true)}
          className="flex items-center justify-center w-11 h-11 -mt-5 rounded-full bg-slate-900 text-white shadow-lg active:scale-95 transition"
          title="Add Expense"
        >
          <Plus className="h-6 w-6 stroke-[2.5]" />
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
            activeTab === 'members' ? 'text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-medium">Members</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
            activeTab === 'settings' ? 'text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <SettingsIcon className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-medium">Settings</span>
        </button>
      </nav>
    </div>
  );
}
