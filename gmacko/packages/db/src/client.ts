import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  postgresClient: ReturnType<typeof postgres> | undefined;
  drizzleDb: ReturnType<typeof createDb> | undefined;
};

function createDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL environment variable");
  }

  const sql =
    globalForDb.postgresClient ??
    postgres(process.env.DATABASE_URL, {
      max: process.env.NODE_ENV === "production" ? 10 : 1,
      prepare: false,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.postgresClient = sql;
  }

  return drizzle({
    client: sql,
    schema,
    casing: "snake_case",
  });
}

function getDb() {
  globalForDb.drizzleDb ??= createDb();
  return globalForDb.drizzleDb;
}

type Database = ReturnType<typeof createDb>;

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
  has(_target, prop) {
    return prop in getDb();
  },
  ownKeys() {
    return Reflect.ownKeys(getDb());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Reflect.getOwnPropertyDescriptor(getDb(), prop);
  },
});
