import type { Client, InStatement, InValue } from "@libsql/client";
import type { DB } from "./db.js";

export const remoteSchema = [
  "CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL, password TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('type','occasion')), UNIQUE(name,kind))",
  "CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE, body TEXT NOT NULL, updatedAt TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, filename TEXT NOT NULL UNIQUE, appId TEXT, fileKey TEXT)",
  "CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, body TEXT NOT NULL, expires INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires INTEGER NOT NULL)",
];
export const migrationTables = [
  "admin",
  "categories",
  "products",
  "media",
] as const;
export async function migrateDatabase(source: DB, target: Client) {
  const usedIds = new Set(
    (
      source.prepare("SELECT body FROM products").all() as { body: string }[]
    ).flatMap((r) => JSON.parse(r.body).images as string[]),
  );
  const media = source.prepare("SELECT id,appId,fileKey FROM media").all() as {
    id: string;
    appId: string | null;
    fileKey: string | null;
  }[];
  if (
    [...usedIds].some(
      (id) => !media.some((m) => m.id === id && m.appId && m.fileKey),
    )
  )
    throw new Error(
      "Còn ảnh đang dùng chưa lên UploadThing. Hãy chuyển ảnh trước.",
    );
  const admin = source.prepare("SELECT id FROM admin WHERE id=1").get();
  if (!admin)
    throw new Error("Chưa có tài khoản chủ shop trong database nguồn.");
  await target.batch(remoteSchema, "write");
  const tx = await target.transaction("write");
  const counts: Record<string, number> = {};
  try {
    const inserts: InStatement[] = [];
    for (const table of migrationTables) {
      const rows = source
        .prepare(`SELECT * FROM ${table} ORDER BY id`)
        .all() as Record<string, InValue>[];
      const existing = await tx.execute(`SELECT * FROM ${table} ORDER BY id`);
      const normalize = (rs: unknown[]) =>
        JSON.stringify(
          rs.map((r) =>
            Object.entries(r as object).sort(([a], [b]) => a.localeCompare(b)),
          ),
        );
      if (existing.rows.length && normalize(existing.rows) !== normalize(rows))
        throw new Error(
          `Database đích đã có dữ liệu khác trong ${table}; không ghi đè.`,
        );
      if (!existing.rows.length)
        for (const row of rows) {
          const cols = Object.keys(row);
          inserts.push({
            sql: `INSERT INTO ${table} (${cols.join(",")}) VALUES(${cols.map(() => "?").join(",")})`,
            args: Object.values(row),
          });
        }
      counts[table] = rows.length;
    }
    if (inserts.length) await tx.batch(inserts);
    await tx.commit();
    return counts;
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
}
