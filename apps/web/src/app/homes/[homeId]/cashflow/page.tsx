'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import {
  ArrowLeft,
  Wallet,
  Calendar,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building2,
  Receipt,
  Zap,
  Repeat,
  Info,
  Sliders,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Loader2,
  Lock,
} from 'lucide-react';
import { MemberRole, HomeType, BillStatus } from '@homeexpense/shared';

export default function HouseholdCashflowPage() {
  const params = useParams();
  const homeId = params.homeId as string;
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // Reserve edit state
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [reserveInput, setReserveInput] = useState('');
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [reserveSuccess, setReserveSuccess] = useState<string | null>(null);

  // Authentication redirect
  React.useEffect(() => {
    if (!authLoading && !token) {
      router.push('/login');
    }
  }, [authLoading, token, router]);

  // Household details query
  const { data: homeDetails } = useQuery({
    queryKey: ['home', homeId],
    queryFn: () => apiClient<any>(`/homes/${homeId}`),
    enabled: !!token && !!homeId,
  });

  // Safe-to-Spend Query
  const {
    data: cashflowData,
    isLoading: cashflowLoading,
    error: cashflowError,
  } = useQuery({
    queryKey: ['safe-to-spend', homeId],
    queryFn: () => apiClient<any>(`/homes/${homeId}/cashflow/safe-to-spend`),
    enabled: !!token && !!homeId,
    staleTime: 30000,
  });

  // Reserve update mutation (Owner only)
  const updateReserveMutation = useMutation({
    mutationFn: (amount: number) =>
      apiClient(`/homes/${homeId}/cashflow/reserve`, {
        method: 'PATCH',
        body: JSON.stringify({ protectedReserve: amount }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safe-to-spend', homeId] });
      queryClient.invalidateQueries({ queryKey: ['home', homeId] });
      setShowReserveModal(false);
      setReserveSuccess('Protected emergency reserve updated successfully.');
      setTimeout(() => setReserveSuccess(null), 4000);
    },
    onError: (err: any) => {
      setReserveError(err.message || 'Failed to update protected reserve.');
    },
  });

  // Current member in household
  const currentMember = React.useMemo(() => {
    if (!homeDetails || !user) return null;
    return homeDetails.members?.find((m: any) => m.userId === user.id);
  }, [homeDetails, user]);

  const isOwner = currentMember?.role === MemberRole.OWNER;
  const currencySymbol = homeDetails?.currency === 'INR' ? '₹' : homeDetails?.currency === 'EUR' ? '€' : '$';

  if (authLoading || cashflowLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-secondary mx-auto" />
          <p className="text-xs text-on-surface-variant font-medium">
            Evaluating Household Cashflow & Safe-to-Spend...
          </p>
        </div>
      </div>
    );
  }

  if (cashflowError || !cashflowData) {
    return (
      <div className="min-h-screen bg-surface p-6 flex items-center justify-center">
        <div className="max-w-md w-full p-6 rounded-2xl border border-error/30 bg-surface-container-lowest text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-error mx-auto" />
          <h2 className="text-base font-semibold text-on-surface">
            Could not calculate Safe-to-Spend
          </h2>
          <p className="text-xs text-on-surface-variant">
            {cashflowError instanceof Error
              ? cashflowError.message
              : 'Your financial records remain safe. Please check back in a moment.'}
          </p>
          <button
            onClick={() => router.push(`/homes/${homeId}`)}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold"
          >
            Back to Household
          </button>
        </div>
      </div>
    );
  }

  const {
    safeToSpend,
    dailySafeToSpend,
    status,
    confidence,
    dataSufficiency,
    period,
    components,
    obligations,
    commitments,
    warnings,
    assumptions,
    comparison,
  } = cashflowData;

  const isDeficit = status === 'DEFICIT' || safeToSpend < 0;
  const isInsufficient = status === 'INSUFFICIENT_DATA';

  const handleReserveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReserveError(null);
    const amount = parseFloat(reserveInput);
    if (isNaN(amount) || amount < 0) {
      setReserveError('Reserve amount must be a positive number.');
      return;
    }
    updateReserveMutation.mutate(amount);
  };

  return (
    <div className="min-h-screen bg-surface font-sans text-on-surface antialiased flex flex-col">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant/60">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push(`/homes/${homeId}`)}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-4 w-px bg-outline-variant" />
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-semibold text-on-surface tracking-tight">
                  Household Cashflow & Safe-to-Spend
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[11px] font-medium uppercase">
                  {homeDetails?.type === HomeType.BACHELOR ? 'Bachelor Flat' : 'Family Mode'}
                </span>
              </div>
              <span className="text-[11px] text-on-surface-variant">
                Deterministic Financial Capacity Engine (SAFE_TO_SPEND_V1)
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isOwner && (
              <button
                onClick={() => {
                  setReserveInput(String(components.protectedReserve || ''));
                  setShowReserveModal(true);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs font-semibold text-on-surface hover:bg-surface-container transition"
              >
                <Sliders className="h-3.5 w-3.5 text-secondary" />
                <span>Configure Reserve</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full px-4 py-6 space-y-6 flex-1 pb-16">
        {/* Feedback alerts */}
        {reserveSuccess && (
          <div className="p-3 bg-secondary-container/40 border border-secondary/30 rounded-xl text-xs text-on-surface flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-secondary shrink-0" />
            <span>{reserveSuccess}</span>
          </div>
        )}

        {/* Hero Safe-to-Spend Banner */}
        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 sm:p-8 shadow-level2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/40 pb-5">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Current Safe-to-Spend
                </span>
                <span className="text-[10px] font-mono bg-surface-container px-2 py-0.5 rounded text-on-surface-variant">
                  {period.daysRemaining} days remaining
                </span>
              </div>
              <div className="mt-1 flex items-baseline space-x-3">
                <span
                  className={`text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums ${
                    isDeficit
                      ? 'text-error'
                      : isInsufficient
                      ? 'text-on-surface-variant'
                      : 'text-on-surface'
                  }`}
                >
                  {currencySymbol}
                  {Math.abs(safeToSpend).toLocaleString()}
                </span>
                {isDeficit && (
                  <span className="px-2.5 py-1 rounded-full bg-error-container text-on-error-container text-xs font-bold uppercase">
                    Capacity Deficit
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                Discretionary flexible spending capacity after covering all obligations, recurring
                commitments, and protected reserves.
              </p>
            </div>

            {/* Badges Stack */}
            <div className="flex flex-col sm:items-end space-y-2">
              <div className="flex items-center space-x-2">
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider ${
                    isDeficit
                      ? 'bg-error-container text-on-error-container'
                      : status === 'HEALTHY'
                      ? 'bg-secondary-container/50 text-on-secondary-container'
                      : status === 'MODERATE'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {status}
                </span>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    confidence === 'HIGH'
                      ? 'bg-secondary-container/30 text-on-secondary-container'
                      : confidence === 'MEDIUM'
                      ? 'bg-surface-container text-on-surface-variant'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {confidence} Confidence
                </span>
              </div>

              {comparison && (
                <div className="flex items-center space-x-1.5 text-xs text-on-surface-variant">
                  {comparison.trend === 'INCREASED' ? (
                    <TrendingUp className="h-3.5 w-3.5 text-secondary" />
                  ) : comparison.trend === 'DECREASED' ? (
                    <TrendingDown className="h-3.5 w-3.5 text-error" />
                  ) : null}
                  <span>
                    {comparison.changeAmount >= 0 ? '+' : ''}
                    {currencySymbol}
                    {comparison.changeAmount.toLocaleString()} ({comparison.changePercentage}%) vs last
                    month
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Daily Burn Rate & Pacing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1">
              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>Daily Spending Allowance</span>
                <Clock className="h-4 w-4" />
              </div>
              <p className="text-xl font-bold text-on-surface tabular-nums">
                {currencySymbol}
                {dailySafeToSpend.toLocaleString()}
                <span className="text-xs font-normal text-on-surface-variant"> / day</span>
              </p>
              <span className="text-[11px] text-on-surface-variant">
                Paced across remaining {period.daysRemaining} days of cycle
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1">
              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>Committed Fixed Load</span>
                <Receipt className="h-4 w-4" />
              </div>
              <p className="text-xl font-bold text-error tabular-nums">
                {currencySymbol}
                {(
                  components.upcomingObligations + components.recurringCommitments
                ).toLocaleString()}
              </p>
              <span className="text-[11px] text-on-surface-variant">
                {components.obligationsCount} bill(s) + {components.commitmentsCount} recurring commitment(s)
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1">
              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>Protected Emergency Reserve</span>
                <ShieldCheck className="h-4 w-4 text-secondary" />
              </div>
              <p className="text-xl font-bold text-secondary tabular-nums">
                {currencySymbol}
                {components.protectedReserve.toLocaleString()}
              </p>
              <span className="text-[11px] text-on-surface-variant">
                {components.isReserveConfigured ? 'Quarantined liquidity floor' : 'Not configured (₹0.00)'}
              </span>
            </div>
          </div>
        </div>

        {/* Mathematical Equation & Explainability Card */}
        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-level1 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-on-surface">
              Why is Safe-to-Spend at {currencySymbol}
              {safeToSpend.toLocaleString()}?
            </h3>
            <p className="text-xs text-on-surface-variant">
              Every component is verified against PostgreSQL records using integer minor units.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1">
              <span className="text-on-surface-variant font-medium uppercase text-[10px]">
                1. Available Capacity
              </span>
              <p className="text-base font-bold text-on-surface tabular-nums">
                +{currencySymbol}
                {components.availableCapacity.toLocaleString()}
              </p>
              <span className="text-[10px] text-on-surface-variant block">
                {components.capacitySource === 'BUDGET_POOL'
                  ? 'Monthly family budget'
                  : 'Unconfigured'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1">
              <span className="text-on-surface-variant font-medium uppercase text-[10px]">
                2. Posted Spent
              </span>
              <p className="text-base font-bold text-on-surface tabular-nums">
                -{currencySymbol}
                {components.postedExpensesInPeriod.toLocaleString()}
              </p>
              <span className="text-[10px] text-on-surface-variant block">
                {components.postedExpensesCount} expenses logged
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1">
              <span className="text-on-surface-variant font-medium uppercase text-[10px]">
                3. Upcoming Bills
              </span>
              <p className="text-base font-bold text-error tabular-nums">
                -{currencySymbol}
                {components.upcomingObligations.toLocaleString()}
              </p>
              <span className="text-[10px] text-on-surface-variant block">
                {components.obligationsCount} unpaid/overdue bills
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1">
              <span className="text-on-surface-variant font-medium uppercase text-[10px]">
                4. Future Recurring
              </span>
              <p className="text-base font-bold text-error tabular-nums">
                -{currencySymbol}
                {components.recurringCommitments.toLocaleString()}
              </p>
              <span className="text-[10px] text-on-surface-variant block">
                {components.commitmentsCount} scheduled runs
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1">
              <span className="text-on-surface-variant font-medium uppercase text-[10px]">
                5. Protected Reserve
              </span>
              <p className="text-base font-bold text-secondary tabular-nums">
                -{currencySymbol}
                {components.protectedReserve.toLocaleString()}
              </p>
              <span className="text-[10px] text-on-surface-variant block">
                {components.isReserveConfigured ? 'Quarantined' : '₹0.00'}
              </span>
            </div>
          </div>
        </div>

        {/* Warnings Feed */}
        {warnings && warnings.length > 0 && (
          <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-level1 space-y-4">
            <h3 className="text-sm font-semibold text-on-surface flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>Cashflow Attention Signals</span>
            </h3>

            <div className="space-y-3">
              {warnings.map((w: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                    w.severity === 'CRITICAL'
                      ? 'bg-error-container/20 border-error/30'
                      : w.severity === 'HIGH'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-surface-container-low border-outline-variant/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-on-surface">{w.message}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                      {w.severity}
                    </span>
                  </div>
                  {w.recommendation && (
                    <p className="text-on-surface-variant text-[11px]">{w.recommendation}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drilldown Section: Upcoming Bills & Recurring Commitments */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Upcoming Bills */}
          <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-level1 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/40">
              <div>
                <h3 className="text-sm font-semibold text-on-surface">Upcoming Bills</h3>
                <p className="text-xs text-on-surface-variant">
                  Unpaid household bills due in or before this cycle
                </p>
              </div>
              <span className="text-xs font-semibold tabular-nums text-error">
                {currencySymbol}
                {components.upcomingObligations.toLocaleString()}
              </span>
            </div>

            {obligations && obligations.length > 0 ? (
              <div className="divide-y divide-outline-variant/30">
                {obligations.map((b: any) => (
                  <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-on-surface">{b.title}</span>
                        {b.isOverdue && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-error-container text-error uppercase">
                            Overdue
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-on-surface-variant">
                        Due: {new Date(b.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="font-semibold text-on-surface tabular-nums">
                      {currencySymbol}
                      {b.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-on-surface-variant text-xs space-y-1">
                <CheckCircle2 className="h-6 w-6 text-secondary mx-auto opacity-70" />
                <p className="font-medium text-on-surface">No upcoming bills due</p>
                <p className="text-[11px]">All recorded bills are either settled or outside this period.</p>
              </div>
            )}
          </div>

          {/* Future Recurring Commitments */}
          <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-level1 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/40">
              <div>
                <h3 className="text-sm font-semibold text-on-surface">Recurring Commitments</h3>
                <p className="text-xs text-on-surface-variant">
                  Scheduled future occurrences within this cycle
                </p>
              </div>
              <span className="text-xs font-semibold tabular-nums text-error">
                {currencySymbol}
                {components.recurringCommitments.toLocaleString()}
              </span>
            </div>

            {commitments && commitments.length > 0 ? (
              <div className="divide-y divide-outline-variant/30">
                {commitments.map((r: any) => (
                  <div key={r.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-medium text-on-surface">{r.description}</span>
                      <div className="flex items-center space-x-2 text-[11px] text-on-surface-variant mt-0.5">
                        <span className="capitalize">{r.interval.toLowerCase()}</span>
                        <span>•</span>
                        <span>Next: {new Date(r.nextRunAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className="font-semibold text-on-surface tabular-nums">
                      {currencySymbol}
                      {r.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-on-surface-variant text-xs space-y-1">
                <CheckCircle2 className="h-6 w-6 text-secondary mx-auto opacity-70" />
                <p className="font-medium text-on-surface">No future recurring commitments</p>
                <p className="text-[11px]">No active recurring services scheduled before cycle end.</p>
              </div>
            )}
          </div>
        </div>

        {/* Documented Assumptions & Methodological Transparency */}
        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-level1 space-y-3">
          <h3 className="text-sm font-semibold text-on-surface flex items-center space-x-1.5">
            <Info className="h-4 w-4 text-on-surface-variant" />
            <span>Calculation Transparency & Assumptions</span>
          </h3>

          <ul className="space-y-1.5 text-xs text-on-surface-variant list-disc list-inside">
            {assumptions.map((a: string, idx: number) => (
              <li key={idx}>{a}</li>
            ))}
          </ul>
        </div>
      </main>

      {/* Modal: Configure Protected Reserve (Owner Only) */}
      {showReserveModal && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant/60 bg-surface p-6 shadow-level3 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/40">
              <h3 className="text-base font-semibold text-on-surface">
                Configure Protected Reserve
              </h3>
              <button
                onClick={() => setShowReserveModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface"
              >
                ✕
              </button>
            </div>

            {reserveError && (
              <div className="p-3 bg-error-container/30 border border-error/20 rounded-xl text-xs text-error">
                {reserveError}
              </div>
            )}

            <form onSubmit={handleReserveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-on-surface mb-1">
                  Emergency Reserve Floor ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={reserveInput}
                  onChange={(e) => setReserveInput(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:outline-none"
                />
                <p className="text-[11px] text-on-surface-variant mt-1">
                  Funds quarantined from discretionary Safe-to-Spend as a household safety cushion.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReserveModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface-container text-on-surface text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateReserveMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-on-surface-variant transition disabled:opacity-40"
                >
                  {updateReserveMutation.isPending ? 'Saving...' : 'Save Reserve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
