import { z } from 'zod';

export const ApiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long for production security'),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

export const WebEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:4000/api/v1'),
});

export const WorkerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
});

export function validateApiEnv(env: Record<string, any>) {
  const result = ApiEnvSchema.safeParse(env);
  if (!result.success) {
    const errorDetails = result.error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`[CRITICAL] API Environment validation failed:\n${errorDetails}`);
  }
  return result.data;
}

export function validateWorkerEnv(env: Record<string, any>) {
  const result = WorkerEnvSchema.safeParse(env);
  if (!result.success) {
    const errorDetails = result.error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`[CRITICAL] Worker Environment validation failed:\n${errorDetails}`);
  }
  return result.data;
}
