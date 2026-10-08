'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Sparkles,
  Info,
} from 'lucide-react';

interface FinancialHealthCardProps {
  homeId: string;
  currencySymbol?: string;
}

export function FinancialHealthCard({ homeId, currencySymbol = '₹' }: FinancialHealthCardProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['financial-health', homeId],
    queryFn: () => apiClient<any>(`/homes/${homeId}/financial-health`),
    staleTime: 30000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-level1 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center animate-pulse">
            <Activity className="h-5 w-5 text-on-surface-variant animate-spin" />
          </div>
          <div>
            <div className="h-4 w-32 bg-surface-container rounded animate-pulse" />
            <div className="h-3 w-48 bg-surface-container rounded mt-2 animate-pulse" />
          </div>
        </div>
        <div className="h-8 w-16 bg-surface-container rounded animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return null; // Gracefully degrade on network/unsupported error
  }

  const { score, status, trend, breakdown, risks, dataSufficiency } = data;
  const isBuilding = status === 'BUILDING_PROFILE' || score === null;

  // Status badge colors
  let statusBadge = (
    <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
      Building Profile
    </span>
  );

  if (status === 'EXCELLENT' || status === 'HEALTHY') {
    statusBadge = (
      <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-secondary-container/50 text-on-secondary-container">
        {status}
      </span>
    );
  } else if (status === 'WATCH') {
    statusBadge = (
      <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
        Needs Watch
      </span>
    );
  } else if (status === 'AT_RISK' || status === 'CRITICAL') {
    statusBadge = (
      <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container">
        {status === 'CRITICAL' ? 'Critical' : 'At Risk'}
      </span>
    );
  }

  // Top 4 preview dimensions
  const previewDimensions = (breakdown || []).slice(0, 4);

  return (
    <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-level1 space-y-4 transition hover:border-outline-variant">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface">
            <Activity className="h-4 w-4 text-secondary" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Household Financial Health
              </span>
              <span className="text-[10px] font-mono bg-surface-container px-1.5 py-0.5 rounded text-on-surface-variant">
                V1
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Deterministic domain analysis across 6 household dimensions
            </p>
          </div>
        </div>

        <div>{statusBadge}</div>
      </div>

      {/* Main Score & Trend Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 items-center">
        {/* Left: Score Hero */}
        <div className="flex items-baseline space-x-3">
          {isBuilding ? (
            <div>
              <div className="text-2xl font-bold text-on-surface">Building Profile</div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Add expenses and category envelopes to calculate your score.
              </p>
            </div>
          ) : (
            <>
              <div className="text-4xl font-extrabold text-on-surface tracking-tight tabular-nums">
                {score}
                <span className="text-sm font-normal text-on-surface-variant">/100</span>
              </div>

              {trend && trend.change !== null && (
                <div
                  className={`flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-md ${
                    trend.direction === 'UP'
                      ? 'bg-secondary-container/40 text-secondary'
                      : trend.direction === 'DOWN'
                      ? 'bg-error-container text-error'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {trend.direction === 'UP' && <TrendingUp className="h-3 w-3" />}
                  {trend.direction === 'DOWN' && <TrendingDown className="h-3 w-3" />}
                  {trend.direction === 'UNCHANGED' && <Minus className="h-3 w-3" />}
                  <span>
                    {trend.change > 0 ? `+${trend.change}` : trend.change} vs last cycle
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Center: Quick Dimension Micro Gauges */}
        <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {previewDimensions.map((dim: any) => {
            const hasScore = dim.score !== null;
            return (
              <div
                key={dim.key}
                className="bg-surface-container-low px-3 py-2 rounded-lg border border-outline-variant/30 text-left"
              >
                <div className="text-[10px] font-medium text-on-surface-variant truncate">
                  {dim.label}
                </div>
                <div className="text-sm font-bold text-on-surface tabular-nums mt-0.5">
                  {hasScore ? `${dim.score}` : '—'}
                </div>
                {hasScore && (
                  <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        dim.score >= 80
                          ? 'bg-secondary'
                          : dim.score >= 60
                          ? 'bg-amber-500'
                          : 'bg-error'
                      }`}
                      style={{ width: `${Math.min(100, dim.score)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Signals & Link */}
      <div className="pt-2 border-t border-outline-variant/40 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2 text-xs">
          {risks && risks.length > 0 ? (
            <div className="flex items-center space-x-1.5 text-error font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>
                {risks.length} item{risks.length > 1 ? 's' : ''} need attention
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-secondary font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>All measured dimensions healthy</span>
            </div>
          )}
        </div>

        <Link
          href={`/homes/${homeId}/financial-health`}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-primary hover:text-secondary transition"
        >
          <span>View Full Financial Health Report</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
