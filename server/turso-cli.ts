import { createClient } from "@libsql/client";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { openDatabase, products } from "./db.js";
import { migrateDatabase, migrationTables } from "./turso-migration.js";
import { assertStopped } from "./lock.js";
import {
  createUploadThingAdapter,
  loadCloudConfig,
  tokenAppId,
} from "./cloud-storage.js";

const dir = path.resolve(process.env.DATA_DIR || "data");
const localConfig = existsSync(path.join(dir, "turso.json"))
  ? JSON.parse(readFileSync(path.join(dir, "turso.json"), "utf8"))
  : {};
const config = {
  url: process.env.TURSO_DATABASE_URL || localConfig.url,
  authToken: process.env.TURSO_AUTH_TOKEN || localConfig.authToken,
};
if (!config.url || !config.authToken)
  throw new Error("Thiếu thông tin kết nối Turso.");
const remote = createClient(config);
try {
  if (process.argv[2] === "migrate") {
    assertStopped(dir);
    const db = openDatabase(dir);
    try {
      mkdirSync("backups", { recursive: true });
      const snapshot = path.resolve(
        "backups",
        `before-turso-${Date.now()}.sqlite`,
      );
      await db.backup(snapshot);
      const ids = new Set(products(db).flatMap((p) => p.images));
      const cloud = loadCloudConfig(dir);
      const adapter = createUploadThingAdapter(dir);
      for (const m of db.prepare("SELECT * FROM media").all() as {
        id: string;
        filename: string;
        fileKey: string | null;
      }[]) {
        if (ids.has(m.id) && !m.fileKey) {
          if (!cloud) throw new Error("Chưa kết nối UploadThing.");
          const bytes = readFileSync(path.join(dir, "uploads", m.filename));
          const key = await adapter.upload(bytes, m.id, cloud);
          db.prepare("UPDATE media SET appId=?,fileKey=? WHERE id=?").run(
            tokenAppId(cloud.token),
            key,
            m.id,
          );
        }
      }
      console.log("Đã chuyển Turso:", await migrateDatabase(db, remote));
      console.log("Database nguồn được sao lưu:", snapshot);
    } finally {
      db.close();
    }
  } else if (process.argv[2] === "env") {
    const token = loadCloudConfig(dir)?.token;
    if (!token) throw new Error("Thiếu token UploadThing.");
    const env = {
      TURSO_DATABASE_URL: config.url,
      TURSO_AUTH_TOKEN: config.authToken,
      UPLOADTHING_TOKEN: token,
      SESSION_SECRET: readFileSync(
        path.join(dir, "session-secret"),
        "utf8",
      ).trim(),
      MEDIA_ENCRYPTION_KEY: readFileSync(
        path.join(dir, "media-encryption-key"),
        "utf8",
      ).trim(),
    };
    writeFileSync(
      path.join(dir, "vercel.env"),
      Object.entries(env)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") + "\n",
      { mode: 0o600 },
    );
    console.log(
      "Đã ghi data/vercel.env (riêng tư, ngoài Git). Import vào Vercel, không thêm VITE_ vào tên biến.",
    );
  } else if (process.argv[2] === "backup") {
    const result: Record<string, unknown> = {};
    const snapshot = await remote.transaction("read");
    try {
      for (const table of migrationTables)
        result[table] = (
          await snapshot.execute(`SELECT * FROM ${table} ORDER BY id`)
        ).rows;
      await snapshot.commit();
    } finally {
      snapshot.close();
    }
    mkdirSync("backups", { recursive: true });
    const file = path.resolve("backups", `turso-${Date.now()}.json`);
    writeFileSync(file, JSON.stringify({ version: 1, tables: result }), {
      mode: 0o600,
    });
    console.log("Đã xuất dữ liệu Turso (không gồm phiên đăng nhập):", file);
  } else throw new Error("Dùng migrate, env hoặc backup.");
} catch {
  console.error(
    "Thao tác Turso chưa hoàn tất. Kiểm tra kết nối/token, ảnh cloud và database đích; không ghi đè dữ liệu đích đã tồn tại.",
  );
  process.exitCode = 1;
} finally {
  remote.close();
}
