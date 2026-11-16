import { PrismaClient } from "@prisma/client";
import { createMockPrisma } from "./mock-db";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  mockPrisma: ReturnType<typeof createMockPrisma> | undefined;
  pgFallbackUntil: number | undefined;
};

export function getMockDb(): PrismaClient {
  if (!globalForPrisma.mockPrisma) {
    globalForPrisma.mockPrisma = createMockPrisma();
  }
  return globalForPrisma.mockPrisma as unknown as PrismaClient;
}

export function isPgConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const record = err as { code?: string; message?: string; name?: string };
  const code = record.code || "";
  if (["P1001", "P1002", "P1008", "P1017", "P2024"].includes(code)) {
    return true;
  }
  const msg = (record.message || "").toLowerCase();
  return (
    msg.includes("kind: closed") ||
    msg.includes("server has closed the connection") ||
    msg.includes("connection terminated") ||
    msg.includes("can't reach database server") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("socket hang up")
  );
}

const PRISMA_MODELS = new Set([
  "user",
  "refreshToken",
  "movie",
  "room",
  "roomMember",
  "message",
  "review",
  "follow",
  "watchlist",
  "watchlistItem",
  "notification",
]);

export function createResilientProxy(
  primaryClient: PrismaClient,
  fallbackProvider: () => PrismaClient = getMockDb
): PrismaClient {
  return new Proxy(primaryClient, {
    get(target, prop, receiver) {
      const propName = String(prop);
      const original = Reflect.get(target, prop, receiver);

      if (!PRISMA_MODELS.has(propName) || !original || typeof original !== "object") {
        return typeof original === "function" ? original.bind(target) : original;
      }

      return new Proxy(original, {
        get(modelTarget, methodProp, modelReceiver) {
          const methodName = String(methodProp);
          const modelMethod = Reflect.get(modelTarget, methodProp, modelReceiver);
          if (typeof modelMethod !== "function") return modelMethod;

          return async (...args: unknown[]) => {
            if (
              globalForPrisma.pgFallbackUntil &&
              globalForPrisma.pgFallbackUntil > Date.now()
            ) {
              const mock = fallbackProvider() as unknown as Record<string, Record<string, (...a: unknown[]) => Promise<unknown>>>;
              return mock[propName][methodName](...args);
            }

            try {
              return await (modelMethod as (...a: unknown[]) => Promise<unknown>).apply(
                modelTarget,
                args
              );
            } catch (err) {
              if (!isPgConnectionError(err)) throw err;

              // Retry once after reconnecting (handles Neon idle Closed pool sockets)
              try {
                await target.$disconnect().catch(() => null);
                await target.$connect().catch(() => null);
                return await (modelMethod as (...a: unknown[]) => Promise<unknown>).apply(
                  modelTarget,
                  args
                );
              } catch (retryErr) {
                if (!isPgConnectionError(retryErr)) throw retryErr;
                globalForPrisma.pgFallbackUntil = Date.now() + 30_000;
                const mock = fallbackProvider() as unknown as Record<string, Record<string, (...a: unknown[]) => Promise<unknown>>>;
                return mock[propName][methodName](...args);
              }
            }
          };
        },
      });
    },
  });
}

function createDbClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    return getMockDb();
  }

  try {
    const client =
      globalForPrisma.prisma ??
      new PrismaClient({
        log: [],
      });
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = client;
    }
    return createResilientProxy(client, getMockDb);
  } catch {
    return getMockDb();
  }
}

export const db: PrismaClient = createDbClient();
