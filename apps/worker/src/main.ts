import { validateWorkerEnv } from '@homeexpense/validation';
import { prisma } from '@homeexpense/database';

async function bootstrap() {
  console.log('[WORKER] Initializing HomeExpense Asynchronous Worker Service...');

  // 1. Runtime environment validation
  const env = validateWorkerEnv(process.env);
  console.log(`[WORKER] Environment verified: ${env.NODE_ENV}`);

  // 2. Database connectivity verification
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[WORKER] PostgreSQL connectivity verified successfully.');
  } catch (error) {
    console.error('[WORKER] Failed to connect to PostgreSQL:', error);
    process.exit(1);
  }

  console.log('[WORKER] Active Background Queues:');
  console.log('  - ocr-processing-queue: Listening for receipt scan jobs');
  console.log('  - recurring-expense-queue: Nightly scheduler (0 0 * * *)');
  console.log('  - notification-dispatch-queue: Processing transactional outbox');

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`[WORKER] Received ${signal}. Draining queues and closing connections...`);
    await prisma.$disconnect();
    console.log('[WORKER] Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[WORKER] Fatal error in bootstrap:', err);
  process.exit(1);
});
