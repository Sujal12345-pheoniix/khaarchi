import { ApiProperty } from '@nestjs/swagger';
import {
  HomeType,
  HealthStatus,
  InsightSeverity,
  DataSufficiency,
} from '@homeexpense/shared';

export class DimensionMetricDto {
  @ApiProperty({ example: 'BUDGET_DISCIPLINE' })
  key!: string;

  @ApiProperty({ example: 'Budget Discipline' })
  label!: string;

  @ApiProperty({ example: 76, nullable: true })
  score!: number | null;

  @ApiProperty({ enum: HealthStatus, example: HealthStatus.HEALTHY })
  status!: HealthStatus;

  @ApiProperty({ enum: DataSufficiency, example: DataSufficiency.FULL })
  sufficiency!: DataSufficiency;

  @ApiProperty({ example: 0.25 })
  weight!: number;

  @ApiProperty({ example: 19.0 })
  weightedContribution!: number;

  @ApiProperty({ example: '84% of monthly budget used (₹42,000 of ₹50,000).' })
  explanation!: string;

  @ApiProperty({ example: { totalBudget: 50000, totalSpent: 42000 } })
  metrics!: Record<string, any>;
}

export class TrendComparisonDto {
  @ApiProperty({ example: 83, nullable: true })
  current!: number | null;

  @ApiProperty({ example: 78, nullable: true })
  previous!: number | null;

  @ApiProperty({ example: 5, nullable: true })
  change!: number | null;

  @ApiProperty({ enum: ['UP', 'DOWN', 'UNCHANGED', 'NOT_AVAILABLE'], example: 'UP' })
  direction!: 'UP' | 'DOWN' | 'UNCHANGED' | 'NOT_AVAILABLE';

  @ApiProperty({
    example: [
      { dimension: 'BUDGET_DISCIPLINE', delta: 3, label: '+3 Budget discipline improved' },
    ],
  })
  componentDeltas!: { dimension: string; delta: number; label: string }[];
}

export class HealthInsightDto {
  @ApiProperty({ example: 'BUDGET_WARNING' })
  type!: string;

  @ApiProperty({ enum: InsightSeverity, example: InsightSeverity.WARNING })
  severity!: InsightSeverity;

  @ApiProperty({ example: 'Budget Approaching Limit' })
  title!: string;

  @ApiProperty({ example: 'Household has utilized 84% of its ₹50,000 monthly envelope.' })
  description!: string;

  @ApiProperty({ example: 'BUDGET' })
  affectedDomain!: string;

  @ApiProperty({ example: 84.0, required: false })
  metricValue?: number;

  @ApiProperty({ example: 85.0, required: false })
  thresholdValue?: number;
}

export class FinancialHealthResponseDto {
  @ApiProperty({ example: 83, nullable: true })
  score!: number | null;

  @ApiProperty({ enum: HealthStatus, example: HealthStatus.HEALTHY })
  status!: HealthStatus;

  @ApiProperty({ example: 'FINANCIAL_HEALTH_V1' })
  scoringVersion!: string;

  @ApiProperty({ enum: HomeType, example: HomeType.FAMILY })
  profile!: HomeType;

  @ApiProperty({ enum: ['HIGH', 'MEDIUM', 'LOW'], example: 'HIGH' })
  confidence!: 'HIGH' | 'MEDIUM' | 'LOW';

  @ApiProperty({ enum: DataSufficiency, example: DataSufficiency.FULL })
  dataSufficiency!: DataSufficiency;

  @ApiProperty({
    example: { start: '2026-10-01T00:00:00.000Z', end: '2026-10-31T23:59:59.999Z' },
  })
  period!: { start: string; end: string };

  @ApiProperty({ type: TrendComparisonDto })
  trend!: TrendComparisonDto;

  @ApiProperty({ type: [DimensionMetricDto] })
  breakdown!: DimensionMetricDto[];

  @ApiProperty({
    example: [{ title: 'Zero Overdue Bills', description: 'All bills paid on time.' }],
  })
  strengths!: { title: string; description: string }[];

  @ApiProperty({
    example: [
      {
        title: 'Budget Warning',
        description: '84% of budget used.',
        severity: InsightSeverity.WARNING,
      },
    ],
  })
  risks!: { title: string; description: string; severity: InsightSeverity }[];

  @ApiProperty({ type: [HealthInsightDto] })
  insights!: HealthInsightDto[];
}
