import { HealthStatus, DataSufficiency } from '@homeexpense/shared';

export function mapScoreToHealthStatus(
  score: number | null,
  sufficiency: DataSufficiency
): HealthStatus {
  if (score === null || sufficiency === DataSufficiency.INSUFFICIENT) {
    return HealthStatus.BUILDING_PROFILE;
  }

  if (score >= 90) return HealthStatus.EXCELLENT;
  if (score >= 75) return HealthStatus.HEALTHY;
  if (score >= 60) return HealthStatus.WATCH;
  if (score >= 40) return HealthStatus.AT_RISK;
  return HealthStatus.CRITICAL;
}

export function getHealthStatusLabel(status: HealthStatus): string {
  switch (status) {
    case HealthStatus.EXCELLENT:
      return 'Excellent';
    case HealthStatus.HEALTHY:
      return 'Healthy';
    case HealthStatus.WATCH:
      return 'Needs Attention';
    case HealthStatus.AT_RISK:
      return 'At Risk';
    case HealthStatus.CRITICAL:
      return 'Critical Action Needed';
    case HealthStatus.BUILDING_PROFILE:
      return 'Building Profile';
  }
}
