'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Wallet,
  Calendar,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface SafeToSpendCardProps {
  homeId: string;
  currencySymbol?: string;
}

export function SafeToSpendCard({ homeId, currencySymbol = '₹' }: SafeToSpendCardProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['safe-to-spend', homeId],
    queryFn: () => apiClient<any>(`/homes/${homeId}/cashflow/safe-to-spend`),
    staleTime: 30000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-level1 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center animate-pulse">
            <Wallet className="h-5 w-5 text-on-surface-variant animate-pulse" />
          </div>
          <div>
            <div className="h-4 w-32 bg-surface-container rounded animate-pulse" />
            <div className="h-3 w-48 bg-surface-container rounded mt-2 animate-pulse" />
          </div>
        </div>
        <div className="h-8 w-24 bg-surface-container rounded animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return null; // Gracefully degrade on failure
  }

  const {
    safeToSpend,
    dailySafeToSpend,
    status,
    confidence,
    dataSufficiency,
    period,
    components,
    warnings,
  } = data;

  const isInsufficient = status === 'INSUFFICIENT_DATA';
  const isDeficit = status === 'DEFICIT' || safeToSpend < 0;

  // Format Period End
  const endDate = new Date(period.end);
  const formattedEndDate = endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  // Status Badge Rendering
  let statusBadge = (
    <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-secondary-container/50 text-on-secondary-container">
      Healthy Capacity
    </span>
  );

  if (isDeficit) {
    statusBadge = (
      <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container">
        Capacity Deficit
      </span>
    );
  } else if (status === 'TIGHT') {
    statusBadge = (
      <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
        Tight Allowance
      </span>
    );
  } else if (status === 'MODERATE') {
    statusBadge = (
      <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
        Moderate Capacity
      </span>
    );
  } else if (isInsufficient) {
    statusBadge = (
      <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
        Building Picture
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-level1 space-y-4 transition hover:border-outline-variant">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface">
            <Wallet className="h-4 w-4 text-secondary" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Safe-to-Spend
              </span>
              <span className="text-[10px] font-mono bg-surface-container px-1.5 py-0.5 rounded text-on-surface-variant">
                V1 Deterministic
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Authoritative flexible spending capacity after all obligations
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {statusBadge}
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              confidence === 'HIGH'
                ? 'bg-secondary-container/40 text-on-secondary-container'
                : confidence === 'MEDIUM'
                ? 'bg-surface-container text-on-surface-variant'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {confidence} Confidence
          </span>
        </div>
      </div>

      {/* Main KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 items-center">
        {/* Left: Main Amount */}
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
            Available Right Now
          </span>
          <div className="flex items-baseline space-x-2">
            <span
              className={`text-3xl font-extrabold tracking-tight tabular-nums ${
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
              <span className="text-xs font-bold text-error uppercase">Deficit</span>
            )}
          </div>
          <div className="flex items-center space-x-2 text-xs text-on-surface-variant">
            <Calendar className="h-3.5 w-3.5 text-on-surface-variant" />
            <span>
              Until {formattedEndDate} ({period.daysRemaining} days left)
            </span>
          </div>
        </div>

        {/* Center: Daily Allowance / Pacing */}
        <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-on-surface-variant font-medium">Daily Safe Allowance</span>
            <Clock className="h-3.5 w-3.5 text-on-surface-variant" />
          </div>
          <p
            className={`text-lg font-semibold tabular-nums ${
              isDeficit ? 'text-error' : 'text-on-surface'
            }`}
          >
            {currencySymbol}
            {dailySafeToSpend.toLocaleString()}
            <span className="text-xs font-normal text-on-surface-variant"> / day</span>
          </p>
          <span className="text-[10px] text-on-surface-variant">
            Paced across remaining {period.daysRemaining} days
          </span>
        </div>

        {/* Right: Component Mini-Breakdown */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between items-center text-on-surface-variant">
            <span>Capacity Pool:</span>
            <span className="font-semibold text-on-surface tabular-nums">
              {currencySymbol}
              {components.availableCapacity.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center text-on-surface-variant">
            <span>Posted Spent:</span>
            <span className="font-semibold text-on-surface tabular-nums">
              -{currencySymbol}
              {components.postedExpensesInPeriod.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center text-on-surface-variant">
            <span>Upcoming Commitments:</span>
            <span className="font-semibold text-error tabular-nums">
              -{currencySymbol}
              {(
                components.upcomingObligations + components.recurringCommitments
              ).toLocaleString()}
            </span>
          </div>
          {components.protectedReserve > 0 && (
            <div className="flex justify-between items-center text-on-surface-variant">
              <span>Protected Reserve:</span>
              <span className="font-semibold text-secondary tabular-nums">
                -{currencySymbol}
                {components.protectedReserve.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Warning Chip if Critical/High exists */}
      {warnings && warnings.length > 0 && (
        <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/50 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-on-surface font-medium">{warnings[0].message}</span>
          </div>
          <span className="text-[10px] text-on-surface-variant uppercase font-bold shrink-0">
            {warnings[0].severity}
          </span>
        </div>
      )}

      {/* Footer Drilldown Link */}
      <div className="pt-2 border-t border-outline-variant/40 flex items-center justify-between">
        <span className="text-xs text-on-surface-variant">
          {components.obligationsCount} bill(s) • {components.commitmentsCount} recurring commitment(s)
        </span>
        <Link
          href={`/homes/${homeId}/cashflow`}
          className="inline-flex items-center space-x-1 text-xs font-semibold text-secondary hover:text-on-surface transition"
        >
          <span>Full Cashflow Engine</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
