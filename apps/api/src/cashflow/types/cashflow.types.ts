import {
  HomeType,
  BillStatus,
  RecurringInterval,
  ExpenseCategory,
  DataSufficiency,
} from '@homeexpense/shared';

export const SAFE_TO_SPEND_VERSION = 'SAFE_TO_SPEND_V1';

export type CashflowStatus =
  | 'HEALTHY'
  | 'MODERATE'
  | 'TIGHT'
  | 'DEFICIT'
  | 'INSUFFICIENT_DATA';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type CapacitySource =
  | 'BUDGET_POOL'
  | 'MEMBER_LIMIT'
  | 'ESTIMATED'
  | 'UNAVAILABLE';

export type CashflowWarningSeverity =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'INFO';

export type CashflowWarningCode =
  | 'NEGATIVE_CAPACITY'
  | 'OVERDUE_BILLS'
  | 'HIGH_OBLIGATION_BURDEN'
  | 'BUDGET_EXHAUSTED'
  | 'MISSING_CAPACITY'
  | 'TIGHT_CAPACITY'
  | 'UNSETTLED_DEBT_HIGH'
  | 'NO_BILLS_RECORDED'
  | 'NO_RECURRING_RECORDED';

export interface CashflowWarning {
  code: CashflowWarningCode;
  severity: CashflowWarningSeverity;
  message: string;
  recommendation?: string;
}

export interface SafeToSpendComponents {
  availableCapacity: number;
  availableCapacityCents: number;
  capacitySource: CapacitySource;

  expectedInflow: number;
  expectedInflowCents: number;

  postedExpensesInPeriod: number;
  postedExpensesInPeriodCents: number;
  postedExpensesCount: number;

  upcomingObligations: number;
  upcomingObligationsCents: number;
  obligationsCount: number;

  recurringCommitments: number;
  recurringCommitmentsCents: number;
  commitmentsCount: number;

  protectedReserve: number;
  protectedReserveCents: number;
  isReserveConfigured: boolean;

  unsettledNetDebts: number;
  unsettledNetDebtsCents: number;
}

export interface SafeToSpendBillItem {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  status: BillStatus;
  isOverdue: boolean;
  category?: string;
}

export interface SafeToSpendRecurringItem {
  id: string;
  description: string;
  amount: number;
  nextRunAt: string;
  interval: RecurringInterval;
  category: ExpenseCategory;
}

export interface SafeToSpendComparison {
  previousPeriodSafeToSpend: number;
  changeAmount: number;
  changePercentage: number;
  trend: 'INCREASED' | 'DECREASED' | 'STABLE';
}

export interface SafeToSpendResult {
  homeId: string;
  currency: string;
  calculationVersion: string;
  homeType: HomeType;

  period: {
    start: string;
    end: string;
    daysRemaining: number;
    totalDays: number;
  };

  safeToSpend: number;
  safeToSpendCents: number;
  dailySafeToSpend: number;

  status: CashflowStatus;
  confidence: ConfidenceLevel;
  dataSufficiency: DataSufficiency;

  components: SafeToSpendComponents;

  obligations: SafeToSpendBillItem[];
  commitments: SafeToSpendRecurringItem[];

  warnings: CashflowWarning[];
  assumptions: string[];

  comparison?: SafeToSpendComparison;

  generatedAt: string;
}

export interface SafeToSpendInput {
  homeId: string;
  homeType: HomeType;
  currency: string;
  referenceDate: Date;
  periodStart: Date;
  periodEnd: Date;

  budget: {
    totalBudget: number;
    categories?: Array<{ category: string; allocatedAmount: number }>;
  } | null;

  protectedReserve: number;

  postedExpenses: Array<{
    id: string;
    amount: number;
    category: string;
    date: Date;
  }>;

  bills: Array<{
    id: string;
    title: string;
    amount: number;
    dueDate: Date;
    status: BillStatus;
  }>;

  recurringExpenses: Array<{
    id: string;
    description: string;
    amount: number;
    nextRunAt: Date;
    interval: RecurringInterval;
    category: ExpenseCategory;
    active: boolean;
  }>;

  memberBalances?: Array<{
    memberId: string;
    balance: number;
    status: 'OWED' | 'OWES' | 'SETTLED';
  }>;

  previousPeriodResult?: {
    safeToSpend: number;
  } | null;
}
