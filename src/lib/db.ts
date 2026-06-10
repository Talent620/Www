import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client. Next.js dev mode re-evaluates modules on every
 * request, so we cache the client on the global object to avoid exhausting the
 * connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/** True when a database connection string is configured. */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
