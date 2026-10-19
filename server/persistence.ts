import { createClient, type Client, type InValue } from "@libsql/client";
import session from "express-session";
import { createHash } from "node:crypto";
import type { DB } from "./db.js";
import type { Category, Product, ProductInput } from "../shared/schema.js";

export interface QueryDatabase {
  prepare(sql: string): {
    get(...args: InValue[]): Promise<unknown>;
    all(...args: InValue[]): Promise<unknown[]>;
    run(
      ...args: InValue[]
    ): Promise<{ changes: number; lastInsertRowid: number | bigint }>;
  };
}
export function localQueries(db: DB): QueryDatabase {
  return {
    prepare(sql) {
      return {
        async get(...args) {
          return db.prepare(sql).get(...args);
        },
        async all(...args) {
          return db.prepare(sql).all(...args);
        },
        async run(...args) {
          return db.prepare(sql).run(...args);
        },
      };
    },
  };
}
export function remoteQueries(client: Client): QueryDatabase {
  return {
    prepare(sql) {
      const execute = (args: InValue[]) => client.execute({ sql, args });
      return {
        async get(...args) {
          return (await execute(args)).rows[0];
        },
        async all(...args) {
          return (await execute(args)).rows;
        },
        async run(...args) {
          const result = await execute(args);
          return {
            changes: result.rowsAffected,
            lastInsertRowid: result.lastInsertRowid ?? 0,
          };
        },
      };
    },
  };
}
export function connectTurso(env = process.env) {
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN)
    throw new Error("Thiếu TURSO_DATABASE_URL hoặc TURSO_AUTH_TOKEN.");
  return createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}
export async function categories(db: QueryDatabase) {
  return (await db
    .prepare("SELECT * FROM categories ORDER BY id")
    .all()) as Category[];
}
export async function products(db: QueryDatabase): Promise<Product[]> {
  const rows = (await db
    .prepare("SELECT id,body,updatedAt FROM products ORDER BY id DESC")
    .all()) as { id: number; body: string; updatedAt: string }[];
  return rows.map((r) => ({
    ...JSON.parse(r.body),
    id: Number(r.id),
    updatedAt: r.updatedAt,
  }));
}
export async function saveProduct(
  db: QueryDatabase,
  value: ProductInput,
  id?: number,
) {
  const now = new Date().toISOString();
  if (id) {
    await db
      .prepare(
        "UPDATE products SET code=?,slug=?,body=?,updatedAt=? WHERE id=?",
      )
      .run(value.code, value.slug, JSON.stringify(value), now, id);
    return id;
  }
  return Number(
    (
      await db
        .prepare(
          "INSERT INTO products(code,slug,body,updatedAt) VALUES(?,?,?,?)",
        )
        .run(value.code, value.slug, JSON.stringify(value), now)
    ).lastInsertRowid,
  );
}
export class DatabaseSessionStore extends session.Store {
  constructor(private db: QueryDatabase) {
    super();
  }
  get(
    sid: string,
    cb: (err?: unknown, value?: session.SessionData | null) => void,
  ) {
    this.db
      .prepare("SELECT body,expires FROM sessions WHERE sid=?")
      .get(sid)
      .then((value) => {
        const row = value as { body: string; expires: number } | undefined;
        cb(null, row && row.expires > Date.now() ? JSON.parse(row.body) : null);
      })
      .catch(cb);
  }
  set(sid: string, value: session.SessionData, cb?: (err?: unknown) => void) {
    const expires = value.cookie.expires
      ? new Date(value.cookie.expires).getTime()
      : Date.now() + 28800000;
    this.db
      .prepare("INSERT OR REPLACE INTO sessions VALUES(?,?,?)")
      .run(sid, JSON.stringify(value), expires)
      .then(() => cb?.())
      .catch((e) => cb?.(e));
  }
  destroy(sid: string, cb?: (err?: unknown) => void) {
    this.db
      .prepare("DELETE FROM sessions WHERE sid=?")
      .run(sid)
      .then(() => cb?.())
      .catch((e) => cb?.(e));
  }
  touch(sid: string, value: session.SessionData, cb?: (err?: unknown) => void) {
    this.set(sid, value, cb);
  }
}
// Shared by all serverless instances, so restarting a function cannot reset login limits.
export class DatabaseRateLimitStore {
  windowMs = 15 * 60 * 1000;
  constructor(private db: QueryDatabase) {}
  init(options: { windowMs: number }) {
    this.windowMs = options.windowMs;
  }
  private key(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
  async increment(key: string) {
    const now = Date.now(),
      resetTime = now + this.windowMs;
    const row = (await this.db
      .prepare(
        `INSERT INTO login_attempts(key,hits,expires) VALUES(?,1,?)
      ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN expires<=? THEN 1 ELSE hits+1 END,
      expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING hits,expires`,
      )
      .get(this.key(key), resetTime, now, now)) as {
      hits: number;
      expires: number;
    };
    return {
      totalHits: Number(row.hits),
      resetTime: new Date(Number(row.expires)),
    };
  }
  async decrement(key: string) {
    await this.db
      .prepare("UPDATE login_attempts SET hits=MAX(0,hits-1) WHERE key=?")
      .run(this.key(key));
  }
  async resetKey(key: string) {
    await this.db
      .prepare("DELETE FROM login_attempts WHERE key=?")
      .run(this.key(key));
  }
}
