import { ApiProperty } from '@nestjs/swagger';
import {
  HomeType,
  BillStatus,
  RecurringInterval,
  ExpenseCategory,
  DataSufficiency,
} from '@homeexpense/shared';
import {
  CashflowStatus,
  ConfidenceLevel,
  CapacitySource,
  CashflowWarningSeverity,
  CashflowWarningCode,
} from '../types/cashflow.types.js';

export class CashflowPeriodDto {
  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  start!: string;

  @ApiProperty({ example: '2026-10-31T23:59:59.999Z' })
  end!: string;

  @ApiProperty({ example: 16 })
  daysRemaining!: number;

  @ApiProperty({ example: 31 })
  totalDays!: number;
}

export class SafeToSpendComponentsDto {
  @ApiProperty({ example: 50000 })
  availableCapacity!: number;

  @ApiProperty({ example: 5000000 })
  availableCapacityCents!: number;

  @ApiProperty({ example: 'BUDGET_POOL' })
  capacitySource!: CapacitySource;

  @ApiProperty({ example: 0 })
  expectedInflow!: number;

  @ApiProperty({ example: 0 })
  expectedInflowCents!: number;

  @ApiProperty({ example: 12000 })
  postedExpensesInPeriod!: number;

  @ApiProperty({ example: 1200000 })
  postedExpensesInPeriodCents!: number;

  @ApiProperty({ example: 4 })
  postedExpensesCount!: number;

  @ApiProperty({ example: 3000 })
  upcomingObligations!: number;

  @ApiProperty({ example: 300000 })
  upcomingObligationsCents!: number;

  @ApiProperty({ example: 1 })
  obligationsCount!: number;

  @ApiProperty({ example: 1000 })
  recurringCommitments!: number;

  @ApiProperty({ example: 100000 })
  recurringCommitmentsCents!: number;

  @ApiProperty({ example: 1 })
  commitmentsCount!: number;

  @ApiProperty({ example: 5000 })
  protectedReserve!: number;

  @ApiProperty({ example: 500000 })
  protectedReserveCents!: number;

  @ApiProperty({ example: true })
  isReserveConfigured!: boolean;

  @ApiProperty({ example: 0 })
  unsettledNetDebts!: number;

  @ApiProperty({ example: 0 })
  unsettledNetDebtsCents!: number;
}

export class SafeToSpendBillItemDto {
  @ApiProperty({ example: 'b1-uuid' })
  id!: string;

  @ApiProperty({ example: 'Electricity' })
  title!: string;

  @ApiProperty({ example: 3000 })
  amount!: number;

  @ApiProperty({ example: '2026-10-20T00:00:00.000Z' })
  dueDate!: string;

  @ApiProperty({ enum: BillStatus, example: BillStatus.UNPAID })
  status!: BillStatus;

  @ApiProperty({ example: false })
  isOverdue!: boolean;

  @ApiProperty({ example: 'UTILITIES', required: false })
  category?: string;
}

export class SafeToSpendRecurringItemDto {
  @ApiProperty({ example: 'r1-uuid' })
  id!: string;

  @ApiProperty({ example: 'Internet Fibernet' })
  description!: string;

  @ApiProperty({ example: 1000 })
  amount!: number;

  @ApiProperty({ example: '2026-10-22T00:00:00.000Z' })
  nextRunAt!: string;

  @ApiProperty({ enum: RecurringInterval, example: RecurringInterval.MONTHLY })
  interval!: RecurringInterval;

  @ApiProperty({ enum: ExpenseCategory, example: ExpenseCategory.UTILITIES })
  category!: ExpenseCategory;
}

export class CashflowWarningDto {
  @ApiProperty({ example: 'TIGHT_CAPACITY' })
  code!: CashflowWarningCode;

  @ApiProperty({ example: 'LOW' })
  severity!: CashflowWarningSeverity;

  @ApiProperty({ example: 'Safe-to-spend is tight with only ₹1,500 remaining.' })
  message!: string;

  @ApiProperty({ example: 'Slow down discretionary purchases.', required: false })
  recommendation?: string;
}

export class SafeToSpendComparisonDto {
  @ApiProperty({ example: 25000 })
  previousPeriodSafeToSpend!: number;

  @ApiProperty({ example: 4000 })
  changeAmount!: number;

  @ApiProperty({ example: 16 })
  changePercentage!: number;

  @ApiProperty({ example: 'INCREASED' })
  trend!: 'INCREASED' | 'DECREASED' | 'STABLE';
}

export class SafeToSpendResponseDto {
  @ApiProperty({ example: 'home-1111-2222-3333-4444' })
  homeId!: string;

  @ApiProperty({ example: 'INR' })
  currency!: string;

  @ApiProperty({ example: 'SAFE_TO_SPEND_V1' })
  calculationVersion!: string;

  @ApiProperty({ enum: HomeType, example: HomeType.FAMILY })
  homeType!: HomeType;

  @ApiProperty({ type: CashflowPeriodDto })
  period!: CashflowPeriodDto;

  @ApiProperty({ example: 29000, description: 'Authoritative Safe-to-Spend in major currency units' })
  safeToSpend!: number;

  @ApiProperty({ example: 2900000, description: 'Safe-to-Spend in integer minor units (paise/cents)' })
  safeToSpendCents!: number;

  @ApiProperty({ example: 1812.5, description: 'Safe-to-Spend per remaining day in period' })
  dailySafeToSpend!: number;

  @ApiProperty({ example: 'HEALTHY' })
  status!: CashflowStatus;

  @ApiProperty({ example: 'HIGH' })
  confidence!: ConfidenceLevel;

  @ApiProperty({ enum: DataSufficiency, example: DataSufficiency.FULL })
  dataSufficiency!: DataSufficiency;

  @ApiProperty({ type: SafeToSpendComponentsDto })
  components!: SafeToSpendComponentsDto;

  @ApiProperty({ type: [SafeToSpendBillItemDto] })
  obligations!: SafeToSpendBillItemDto[];

  @ApiProperty({ type: [SafeToSpendRecurringItemDto] })
  commitments!: SafeToSpendRecurringItemDto[];

  @ApiProperty({ type: [CashflowWarningDto] })
  warnings!: CashflowWarningDto[];

  @ApiProperty({ type: [String] })
  assumptions!: string[];

  @ApiProperty({ type: SafeToSpendComparisonDto, required: false })
  comparison?: SafeToSpendComparisonDto;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  generatedAt!: string;
}
