import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import session from "express-session";
import type { Product, ProductInput, Category } from "../shared/schema.js";

export function openDatabase(directory: string) {
  mkdirSync(path.join(directory, "uploads"), { recursive: true });
  const db = new Database(path.join(directory, "shop.sqlite"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL, password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('type','occasion')), UNIQUE(name,kind));
    CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE, body TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, filename TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, body TEXT NOT NULL, expires INTEGER NOT NULL);`);
  const mediaColumns = new Set(
    (db.pragma("table_info(media)") as { name: string }[]).map((c) => c.name),
  );
  for (const column of ["appId", "fileKey"])
    if (!mediaColumns.has(column))
      db.exec(`ALTER TABLE media ADD COLUMN ${column} TEXT`);
  return db;
}
export type DB = ReturnType<typeof openDatabase>;
export function categories(db: DB) {
  return db.prepare("SELECT * FROM categories ORDER BY id").all() as Category[];
}
export function products(db: DB): Product[] {
  return (
    db
      .prepare("SELECT id,body,updatedAt FROM products ORDER BY id DESC")
      .all() as { id: number; body: string; updatedAt: string }[]
  ).map((r) => ({ ...JSON.parse(r.body), id: r.id, updatedAt: r.updatedAt }));
}
export function saveProduct(db: DB, value: ProductInput, id?: number) {
  const now = new Date().toISOString();
  if (id) {
    db.prepare(
      "UPDATE products SET code=?,slug=?,body=?,updatedAt=? WHERE id=?",
    ).run(value.code, value.slug, JSON.stringify(value), now, id);
    return id;
  }
  return Number(
    db
      .prepare("INSERT INTO products(code,slug,body,updatedAt) VALUES(?,?,?,?)")
      .run(value.code, value.slug, JSON.stringify(value), now).lastInsertRowid,
  );
}
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function checkPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export class SqliteSessionStore extends session.Store {
  constructor(private db: DB) {
    super();
  }
  get(
    sid: string,
    cb: (err?: unknown, value?: session.SessionData | null) => void,
  ) {
    try {
      const row = this.db
        .prepare("SELECT body,expires FROM sessions WHERE sid=?")
        .get(sid) as { body: string; expires: number } | undefined;
      cb(null, row && row.expires > Date.now() ? JSON.parse(row.body) : null);
    } catch (e) {
      cb(e);
    }
  }
  set(sid: string, value: session.SessionData, cb?: (err?: unknown) => void) {
    try {
      this.db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
      this.db
        .prepare("INSERT OR REPLACE INTO sessions VALUES(?,?,?)")
        .run(
          sid,
          JSON.stringify(value),
          value.cookie.expires
            ? new Date(value.cookie.expires).getTime()
            : Date.now() + 28800000,
        );
      cb?.();
    } catch (e) {
      cb?.(e);
    }
  }
  destroy(sid: string, cb?: (err?: unknown) => void) {
    try {
      this.db.prepare("DELETE FROM sessions WHERE sid=?").run(sid);
      cb?.();
    } catch (e) {
      cb?.(e);
    }
  }
  touch(sid: string, value: session.SessionData, cb?: (err?: unknown) => void) {
    this.set(sid, value, cb);
  }
}
