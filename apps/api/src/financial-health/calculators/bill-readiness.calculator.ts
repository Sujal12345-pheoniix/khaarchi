import { BillStatus, HealthStatus, DataSufficiency, toCents, toMajor } from '@homeexpense/shared';
import { DimensionCalculationOutput } from '../types/financial-health.types.js';

export interface BillItemInput {
  id: string;
  title: string;
  amount: number;
  dueDate: Date | string;
  status: BillStatus;
}

export interface BillReadinessInput {
  bills: BillItemInput[];
  referenceDate?: Date;
}

export function calculateBillReadiness(input: BillReadinessInput): DimensionCalculationOutput {
  const { bills, referenceDate = new Date() } = input;
  const refTime = referenceDate.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  // 1. If no bills recorded
  if (!bills || bills.length === 0) {
    return {
      key: 'BILL_READINESS',
      label: 'Bill Readiness',
      score: 100,
      status: HealthStatus.EXCELLENT,
      sufficiency: DataSufficiency.FULL,
      explanation: 'No unpaid or overdue household bills on record.',
      metrics: {
        totalBillsCount: 0,
        overdueCount: 0,
        overdueAmount: 0,
        upcomingDue7DaysCount: 0,
        upcomingDue7DaysAmount: 0,
        paidCount: 0,
      },
    };
  }

  let overdueCount = 0;
  let overdueCents = 0;
  let upcomingDue7DaysCount = 0;
  let upcomingDue7DaysCents = 0;
  let paidCount = 0;
  let futureUnpaidCount = 0;

  for (const bill of bills) {
    const dueTime = new Date(bill.dueDate).getTime();
    const cents = toCents(bill.amount);

    if (bill.status === BillStatus.PAID) {
      paidCount++;
      continue;
    }

    const isOverdue = bill.status === BillStatus.OVERDUE || (bill.status === BillStatus.UNPAID && dueTime < refTime);
    if (isOverdue) {
      overdueCount++;
      overdueCents += cents;
    } else if (bill.status === BillStatus.UNPAID) {
      const timeDiff = dueTime - refTime;
      if (timeDiff <= sevenDaysMs) {
        upcomingDue7DaysCount++;
        upcomingDue7DaysCents += cents;
      } else {
        futureUnpaidCount++;
      }
    }
  }

  // 2. Score calculation
  // Base 100 points
  // Severe penalty for overdue obligations: -35 pts per overdue bill (2 bills = 30 pts, 3+ = 0)
  // Moderate penalty for unpaid bills due in <= 7 days: -8 pts per bill
  let rawScore = 100;
  rawScore -= overdueCount * 35;
  rawScore -= upcomingDue7DaysCount * 8;

  const finalScore = Math.max(0, Math.min(100, rawScore));

  // 3. Status mapping
  let status: HealthStatus = HealthStatus.HEALTHY;
  if (finalScore >= 90) status = HealthStatus.EXCELLENT;
  else if (finalScore >= 75) status = HealthStatus.HEALTHY;
  else if (finalScore >= 60) status = HealthStatus.WATCH;
  else if (finalScore >= 40) status = HealthStatus.AT_RISK;
  else status = HealthStatus.CRITICAL;

  // 4. Explanation
  const overdueAmount = toMajor(overdueCents);
  const upcomingAmount = toMajor(upcomingDue7DaysCents);

  let explanation: string;
  if (overdueCount > 0) {
    explanation = `${overdueCount} overdue bill${overdueCount > 1 ? 's' : ''} totaling ₹${overdueAmount.toLocaleString('en-IN')} require immediate payment.`;
  } else if (upcomingDue7DaysCount > 0) {
    explanation = `${upcomingDue7DaysCount} bill${upcomingDue7DaysCount > 1 ? 's' : ''} totaling ₹${upcomingAmount.toLocaleString('en-IN')} due within the next 7 days.`;
  } else if (paidCount > 0) {
    explanation = `All ${paidCount} scheduled bill${paidCount > 1 ? 's' : ''} are paid and up to date.`;
  } else {
    explanation = `All upcoming obligations are scheduled beyond the 7-day window.`;
  }

  return {
    key: 'BILL_READINESS',
    label: 'Bill Readiness',
    score: finalScore,
    status,
    sufficiency: DataSufficiency.FULL,
    explanation,
    metrics: {
      totalBillsCount: bills.length,
      overdueCount,
      overdueAmount,
      upcomingDue7DaysCount,
      upcomingDue7DaysAmount: upcomingAmount,
      paidCount,
      futureUnpaidCount,
    },
  };
}
