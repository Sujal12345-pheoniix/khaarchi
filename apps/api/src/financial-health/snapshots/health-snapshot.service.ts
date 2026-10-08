import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FinancialHealthEvaluationResult } from '../types/financial-health.types.js';
import { Prisma } from '@homeexpense/database';

@Injectable()
export class HealthSnapshotService {
  private readonly logger = new Logger(HealthSnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the most recent prior comparable snapshot for the home.
   */
  async getLatestSnapshot(homeId: string) {
    return this.prisma.financialHealthSnapshot.findFirst({
      where: { homeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Persists an analytical snapshot and its insights.
   * Runs non-destructively; snapshot errors never block the API response.
   */
  async recordSnapshot(
    homeId: string,
    evaluation: FinancialHealthEvaluationResult
  ): Promise<void> {
    try {
      const dimensionScoresJson: Record<string, any> = {};
      const metricsJson: Record<string, any> = {};

      for (const dim of evaluation.breakdown) {
        dimensionScoresJson[dim.key] = {
          score: dim.score,
          status: dim.status,
          weight: dim.weight,
          weightedContribution: dim.weightedContribution,
          sufficiency: dim.sufficiency,
        };
        metricsJson[dim.key] = dim.metrics;
      }

      const snapshot = await this.prisma.financialHealthSnapshot.create({
        data: {
          homeId,
          periodStart: new Date(evaluation.period.start),
          periodEnd: new Date(evaluation.period.end),
          score: evaluation.score,
          status: evaluation.status,
          scoringVersion: evaluation.scoringVersion,
          profile: evaluation.profile,
          dataSufficiency: evaluation.dataSufficiency,
          dimensionScores: dimensionScoresJson as Prisma.InputJsonValue,
          metrics: metricsJson as Prisma.InputJsonValue,
        },
      });

      // Persist active insights
      if (evaluation.insights && evaluation.insights.length > 0) {
        await this.prisma.financialHealthInsight.createMany({
          data: evaluation.insights.map((ins) => ({
            homeId,
            type: ins.type,
            severity: ins.severity,
            title: ins.title,
            description: ins.description,
            affectedDomain: ins.affectedDomain,
            metricValue: ins.metricValue != null ? new Prisma.Decimal(ins.metricValue) : null,
            thresholdValue: ins.thresholdValue != null ? new Prisma.Decimal(ins.thresholdValue) : null,
            scoringVersion: evaluation.scoringVersion,
            status: 'ACTIVE',
          })),
        });
      }

      this.logger.log(`Financial health snapshot recorded for Home ${homeId}: Snapshot ID ${snapshot.id}`);
    } catch (err: any) {
      // Invariant: Analytical snapshot failure must never crash core financial evaluation
      this.logger.error(`Failed to record analytical health snapshot for Home ${homeId}: ${err.message}`, err.stack);
    }
  }

  /**
   * Retrieves snapshot history for trend charting.
   */
  async getSnapshotHistory(homeId: string, limit = 12) {
    const snapshots = await this.prisma.financialHealthSnapshot.findMany({
      where: { homeId },
      orderBy: { periodStart: 'desc' },
      take: limit,
    });

    return snapshots.reverse().map((s) => ({
      id: s.id,
      score: s.score,
      status: s.status,
      periodStart: s.periodStart.toISOString(),
      periodEnd: s.periodEnd.toISOString(),
      dataSufficiency: s.dataSufficiency,
      createdAt: s.createdAt.toISOString(),
    }));
  }
}
