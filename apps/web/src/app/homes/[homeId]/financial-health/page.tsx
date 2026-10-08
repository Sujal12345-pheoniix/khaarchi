'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Lock,
  ArrowRight,
  Plus,
  ArrowRightLeft,
  UserPlus,
  RefreshCw,
  Info,
  Layers,
  HelpCircle,
} from 'lucide-react';

export default function FinancialHealthPage() {
  const params = useParams();
  const homeId = params.homeId as string;
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();

  // Redirect if unauthenticated
  React.useEffect(() => {
    if (!authLoading && !token) {
      router.push('/login');
    }
  }, [authLoading, token, router]);

  // Query Home details
  const {
    data: homeDetails,
    isLoading: homeLoading,
    error: homeError,
  } = useQuery({
    queryKey: ['home', homeId],
    queryFn: () => apiClient<any>(`/homes/${homeId}`),
    enabled: !!token && !!homeId,
  });

  // Query Financial Health evaluation
  const {
    data: healthData,
    isLoading: healthLoading,
    error: healthError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['financial-health', homeId],
    queryFn: () => apiClient<any>(`/homes/${homeId}/financial-health`),
    enabled: !!token && !!homeId,
  });

  // Query Snapshot History for trend timeline
  const { data: historyData } = useQuery({
    queryKey: ['financial-health-history', homeId],
    queryFn: () => apiClient<any[]>(`/homes/${homeId}/financial-health/history`),
    enabled: !!token && !!homeId,
  });

  const currencySymbol = homeDetails?.currency === 'INR' ? '₹' : homeDetails?.currency || '₹';
  const isBachelor = homeDetails?.type === 'BACHELOR';

  // 1. Loading State
  if (authLoading || homeLoading || healthLoading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center">
            <Activity className="h-6 w-6 text-secondary animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-on-surface">Evaluating Household Health</h2>
            <p className="text-xs text-on-surface-variant mt-1">
              Executing deterministic verification across expenses, ledger balances, and scheduled obligations...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Error / Unauthorized State
  if (homeError || healthError) {
    const errorMsg =
      (healthError as Error)?.message ||
      (homeError as Error)?.message ||
      'Failed to load household financial health evaluation.';
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-outline-variant/80 bg-surface-container-lowest p-6 shadow-level1 space-y-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-error-container text-error flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">Access Denied or Evaluation Error</h2>
            <p className="text-xs text-on-surface-variant mt-1.5">{errorMsg}</p>
          </div>
          <div className="pt-2 flex items-center justify-center space-x-3">
            <Link
              href={`/homes/${homeId}`}
              className="px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs font-semibold text-on-surface hover:bg-surface-container transition"
            >
              Return to Household
            </Link>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-on-surface-variant transition"
            >
              Retry Analysis
            </button>
          </div>
        </div>
      </div>
    );
  }

  const {
    score,
    status,
    scoringVersion,
    profile,
    confidence,
    dataSufficiency,
    period,
    trend,
    breakdown = [],
    strengths = [],
    risks = [],
    insights = [],
  } = healthData;

  const isBuilding = status === 'BUILDING_PROFILE' || score === null;

  // Status badge styling
  const getStatusBadge = () => {
    switch (status) {
      case 'EXCELLENT':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase bg-secondary-container/60 text-on-secondary-container border border-secondary/20">
            Excellent Financial Health
          </span>
        );
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase bg-secondary-container/40 text-secondary border border-secondary/20">
            Healthy Household
          </span>
        );
      case 'WATCH':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300">
            Needs Attention (Watch)
          </span>
        );
      case 'AT_RISK':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase bg-orange-100 text-orange-900 border border-orange-300">
            At Risk
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase bg-error-container text-on-error-container border border-error/30">
            Critical Action Needed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase bg-surface-container text-on-surface-variant border border-outline-variant">
            Building Profile
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col text-on-surface">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-outline-variant/60 bg-surface/90 backdrop-blur-md px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href={`/homes/${homeId}`}
              className="p-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition"
              title="Return to Household Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm font-bold text-on-surface">
                  {homeDetails?.name || 'Household'} — Financial Health
                </h1>
                <span className="text-[10px] font-mono uppercase bg-surface-container px-2 py-0.5 rounded text-on-surface-variant">
                  {profile} Profile
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Deterministic Domain Engine • Version {scoringVersion}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs font-medium text-on-surface hover:bg-surface-container transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Analysis</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto w-full px-3.5 sm:px-4 py-6 space-y-6 flex-1 pb-16">
        {/* Onboarding State for Building Profile */}
        {isBuilding && (
          <div className="rounded-2xl border border-secondary/30 bg-secondary-container/20 p-5 space-y-3">
            <div className="flex items-center space-x-2.5 text-secondary">
              <ShieldCheck className="h-5 w-5" />
              <h3 className="text-sm font-bold">Your Financial Health Profile is Building</h3>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Khaarchi never assigns arbitrary scores. To compute an authoritative financial health assessment,
              the engine requires at least one active spending cycle, budget envelope, or bill schedule.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <Link
                href={`/homes/${homeId}`}
                className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 flex items-center space-x-2.5 hover:border-secondary transition text-xs font-semibold"
              >
                <Plus className="h-4 w-4 text-primary" />
                <span>Log First Expense</span>
              </Link>
              <Link
                href={`/homes/${homeId}`}
                className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 flex items-center space-x-2.5 hover:border-secondary transition text-xs font-semibold"
              >
                <ArrowRightLeft className="h-4 w-4 text-secondary" />
                <span>Record a Settlement</span>
              </Link>
              <Link
                href={`/homes/${homeId}`}
                className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 flex items-center space-x-2.5 hover:border-secondary transition text-xs font-semibold"
              >
                <UserPlus className="h-4 w-4 text-on-surface-variant" />
                <span>Invite Roommates</span>
              </Link>
            </div>
          </div>
        )}

        {/* Section 1 & 2: Score Hero Card */}
        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-level1 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-outline-variant/40">
            {/* Left: Big Score & Status */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">{getStatusBadge()}</div>
              <div className="flex items-baseline space-x-4">
                <span className="text-6xl sm:text-7xl font-extrabold tracking-tight tabular-nums text-on-surface">
                  {score !== null ? score : '—'}
                </span>
                <span className="text-xl font-medium text-on-surface-variant">/ 100</span>
              </div>
              <p className="text-xs text-on-surface-variant max-w-md leading-relaxed">
                {isBachelor
                  ? 'Bachelor Flat profile: Score prioritized around zero debt float, debt minimization, settlement velocity, and stable run-rates.'
                  : 'Family Household profile: Score weighted around category budget adherence, utility readiness, spend stability, and pooled contributions.'}
              </p>
            </div>

            {/* Right: Trend & Movement Explanations */}
            <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/40 space-y-3 md:w-80">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface">Historical Movement</span>
                <span className="text-[10px] text-on-surface-variant">vs previous cycle</span>
              </div>

              {trend && trend.change !== null ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`flex items-center space-x-1 text-sm font-bold px-2 py-0.5 rounded ${
                        trend.direction === 'UP'
                          ? 'bg-secondary-container/50 text-secondary'
                          : trend.direction === 'DOWN'
                          ? 'bg-error-container text-error'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {trend.direction === 'UP' && <TrendingUp className="h-4 w-4" />}
                      {trend.direction === 'DOWN' && <TrendingDown className="h-4 w-4" />}
                      {trend.direction === 'UNCHANGED' && <Minus className="h-4 w-4" />}
                      <span>
                        {trend.change > 0 ? `+${trend.change}` : trend.change} points
                      </span>
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      (Previous: {trend.previous})
                    </span>
                  </div>

                  {/* Component Movement Breakdown */}
                  {trend.componentDeltas && trend.componentDeltas.length > 0 && (
                    <div className="pt-2 border-t border-outline-variant/30 space-y-1 text-xs">
                      {trend.componentDeltas.slice(0, 3).map((delta: any, idx: number) => (
                        <div key={idx} className="flex items-center space-x-1.5 text-on-surface-variant">
                          <span
                            className={`font-semibold font-mono ${
                              delta.delta > 0 ? 'text-secondary' : 'text-error'
                            }`}
                          >
                            {delta.delta > 0 ? `+${delta.delta}` : delta.delta}
                          </span>
                          <span className="truncate">{delta.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant">
                  Initial evaluation period. Trend trajectory will be established after your next monthly cycle.
                </p>
              )}

              {/* Data Sufficiency & Confidence Badge */}
              <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between text-[11px] text-on-surface-variant">
                <span>Confidence: <strong className="text-on-surface">{confidence}</strong></span>
                <span>Data: <strong className="text-on-surface">{dataSufficiency}</strong></span>
              </div>
            </div>
          </div>

          {/* Section 5: Dimension Breakdown Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-on-surface">Dimension Breakdown</h3>
                <p className="text-xs text-on-surface-variant">
                  Deterministic mathematical contribution of each pillar to the household score.
                </p>
              </div>
              <span className="text-xs font-mono text-on-surface-variant">
                6 Pillars Evaluated
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {breakdown.map((dim: any) => {
                const hasScore = dim.score !== null;
                const scoreColor =
                  dim.score >= 80
                    ? 'text-secondary'
                    : dim.score >= 60
                    ? 'text-amber-600'
                    : 'text-error';

                const progressBg =
                  dim.score >= 80
                    ? 'bg-secondary'
                    : dim.score >= 60
                    ? 'bg-amber-500'
                    : 'bg-error';

                return (
                  <div
                    key={dim.key}
                    className="p-4 rounded-xl border border-outline-variant/50 bg-surface-container-low/50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-on-surface">{dim.label}</span>
                        <span className="text-[10px] font-mono uppercase bg-surface-container px-1.5 py-0.5 rounded text-on-surface-variant">
                          Weight: {(dim.weight * 100).toFixed(0)}%
                        </span>
                      </div>

                      <div className="text-right">
                        <span className={`text-base font-bold tabular-nums ${hasScore ? scoreColor : 'text-on-surface-variant'}`}>
                          {hasScore ? dim.score : 'N/A'}
                        </span>
                        {hasScore && (
                          <span className="text-[11px] text-on-surface-variant block">
                            +{dim.weightedContribution.toFixed(1)} pts
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Track */}
                    <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          hasScore ? progressBg : 'bg-transparent'
                        }`}
                        style={{ width: `${hasScore ? Math.min(100, dim.score) : 0}%` }}
                      />
                    </div>

                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {dim.explanation}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 6 & 7: Strengths & Risk Signals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Risks / Signals needing attention */}
          <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-level1 space-y-4">
            <div className="flex items-center space-x-2 text-error">
              <AlertTriangle className="h-4 w-4" />
              <h3 className="text-sm font-bold uppercase tracking-wide">
                Items Needing Attention ({risks.length})
              </h3>
            </div>

            {risks.length > 0 ? (
              <div className="space-y-3">
                {risks.map((risk: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-error/20 bg-error-container/30 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-on-surface">{risk.title}</span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-error-container text-on-error-container">
                        {risk.severity}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant">{risk.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-surface-container-low text-center text-xs text-on-surface-variant">
                No active financial risks or budget warnings detected.
              </div>
            )}
          </div>

          {/* Strengths / Healthy behaviors */}
          <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-level1 space-y-4">
            <div className="flex items-center space-x-2 text-secondary">
              <CheckCircle2 className="h-4 w-4" />
              <h3 className="text-sm font-bold uppercase tracking-wide">
                Household Strengths ({strengths.length})
              </h3>
            </div>

            {strengths.length > 0 ? (
              <div className="space-y-3">
                {strengths.map((str: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-secondary/20 bg-secondary-container/20 space-y-1"
                  >
                    <span className="text-xs font-bold text-on-surface">{str.title}</span>
                    <p className="text-xs text-on-surface-variant">{str.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-surface-container-low text-center text-xs text-on-surface-variant">
                Continue logging regular expenses to establish historical strength benchmarks.
              </div>
            )}
          </div>
        </div>

        {/* Section 10: Recommended Actions (Real CTAs) */}
        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-level1 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-on-surface">Recommended Actions</h3>
            <p className="text-xs text-on-surface-variant">
              Every step directly updates the authoritative PostgreSQL ledger to improve your score.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href={`/homes/${homeId}`}
              className="p-4 rounded-xl border border-outline-variant/60 bg-surface-container-low hover:border-secondary transition flex flex-col justify-between space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface">Record Expense</span>
                <Plus className="h-4 w-4 text-primary" />
              </div>
              <p className="text-[11px] text-on-surface-variant leading-snug">
                Log fresh transactions to keep category envelope tracking current.
              </p>
            </Link>

            <Link
              href={`/homes/${homeId}`}
              className="p-4 rounded-xl border border-outline-variant/60 bg-surface-container-low hover:border-secondary transition flex flex-col justify-between space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface">Settle Up Debts</span>
                <ArrowRightLeft className="h-4 w-4 text-secondary" />
              </div>
              <p className="text-[11px] text-on-surface-variant leading-snug">
                Clear outstanding member debts to optimize the Debt Health pillar.
              </p>
            </Link>

            <Link
              href={`/homes/${homeId}`}
              className="p-4 rounded-xl border border-outline-variant/60 bg-surface-container-low hover:border-secondary transition flex flex-col justify-between space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface">Invite Members</span>
                <UserPlus className="h-4 w-4 text-on-surface-variant" />
              </div>
              <p className="text-[11px] text-on-surface-variant leading-snug">
                Add roommates or family members to achieve accurate shared distribution.
              </p>
            </Link>
          </div>
        </div>

        {/* Section 8 & 9: Mathematical Transparency & Non-Advice Disclaimer */}
        <div className="p-4 rounded-xl bg-surface-container text-on-surface-variant text-[11px] space-y-1.5 leading-relaxed">
          <p className="font-semibold text-on-surface">Mathematical Transparency & Disclaimers</p>
          <p>
            Khaarchi Financial Health is calculated entirely server-side using deterministic linear weighted scoring
            across double-entry PostgreSQL ledger entries, category budgets, scheduled bills, and historical spending.
            The score is an internal household operational indicator and does not represent a regulated credit score,
            lending appraisal, or financial investment advice.
          </p>
        </div>
      </main>
    </div>
  );
}
