import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { createResilientProxy, isPgConnectionError } from "./db";
import { createMockPrisma } from "./mock-db";

test("isPgConnectionError identifies Closed and Prisma socket errors", () => {
  assert.equal(
    isPgConnectionError(new Error("Error in PostgreSQL connection: Error { kind: Closed, cause: None }")),
    true
  );
  assert.equal(isPgConnectionError({ code: "P1017", message: "Server has closed the connection" }), true);
  assert.equal(isPgConnectionError({ code: "P2002", message: "Unique constraint failed" }), false);
});

test("createResilientProxy retries once on transient Closed error and succeeds", async () => {
  let attempts = 0;
  const fakePrimary = {
    $disconnect: async () => {},
    $connect: async () => {},
    movie: {
      findMany: async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("Error in PostgreSQL connection: Error { kind: Closed, cause: None }");
        }
        return [{ id: "ok_1", title: "Recovered Movie" }];
      },
    },
  } as unknown as PrismaClient;

  const proxy = createResilientProxy(fakePrimary, () => createMockPrisma() as unknown as PrismaClient);
  const res = await proxy.movie.findMany();
  assert.equal(attempts, 2);
  assert.equal(res.length, 1);
  assert.equal(res[0].title, "Recovered Movie");
});

test("createResilientProxy falls back to mock-db when Postgres remains unreachable", async () => {
  const g = globalThis as unknown as { pgFallbackUntil?: number };
  g.pgFallbackUntil = undefined;

  const deadPrimary = {
    $disconnect: async () => {},
    $connect: async () => {},
    movie: {
      findMany: async () => {
        throw new Error("Error in PostgreSQL connection: Error { kind: Closed, cause: None }");
      },
    },
  } as unknown as PrismaClient;

  const mock = createMockPrisma() as unknown as PrismaClient;
  const proxy = createResilientProxy(deadPrimary, () => mock);
  const movies = await proxy.movie.findMany();
  assert.ok(movies.length >= 1);
  g.pgFallbackUntil = undefined;
});
