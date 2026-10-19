import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import request from "supertest";
import sharp from "sharp";
import { openDatabase, hashPassword, saveProduct } from "../server/db.js";
import { buildApp } from "../server/app.js";
import { remoteQueries } from "../server/persistence.js";
import { migrateDatabase } from "../server/turso-migration.js";
import { validateServerEnvironment } from "../api/index.js";
import {
  CloudStorageError,
  type CloudAdapter,
} from "../server/cloud-storage.js";

const headers = { "X-Shop-Request": "1", "X-Forwarded-Proto": "https" };
async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "iapa-remote-"));
  const source = openDatabase(path.join(root, "source"));
  const client = createClient({
    url: `file:${path.join(root, "remote.sqlite").replaceAll("\\", "/")}`,
  });
  const password = randomBytes(24).toString("hex");
  source
    .prepare("INSERT INTO admin VALUES(1,?,?)")
    .run("owner", hashPassword(password));
  source.prepare("INSERT INTO categories VALUES(1,'Bó hoa','type')").run();
  const id = randomUUID();
  source
    .prepare("INSERT INTO media VALUES(?,?,?,?)")
    .run(id, `${id}.webp`, "testapp", "file-original");
  saveProduct(source, {
    code: "IP-TEST",
    name: "Hoa thử",
    slug: "hoa-thu",
    description: "",
    categoryIds: [1],
    images: [id],
    featured: false,
    visible: true,
    available: true,
    sourceUrl: "",
    draftNote: "",
  });
  source
    .prepare("INSERT INTO sessions VALUES('old','{}',?)")
    .run(Date.now() + 100000);
  await migrateDatabase(source, client);
  const env = { ...process.env };
  process.env.SESSION_SECRET = randomBytes(48).toString("hex");
  process.env.MEDIA_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  process.env.UPLOADTHING_TOKEN = Buffer.from(
    JSON.stringify({
      appId: "testapp",
      apiKey: "sk_fake_test",
      regions: ["sea1"],
    }),
  ).toString("base64");
  const image = await sharp({
    create: { width: 40, height: 50, channels: 3, background: "pink" },
  })
    .webp()
    .toBuffer();
  let downloads = 0,
    uploads = 0;
  const adapter: CloudAdapter = {
    async verify() {},
    async upload() {
      uploads++;
      return "file-new";
    },
    async download() {
      downloads++;
      return image;
    },
  };
  const directory = path.join(root, "must-not-exist");
  const factory = () =>
    buildApp(remoteQueries(client), directory, adapter, true);
  const app = factory();
  async function login() {
    const response = await request(app)
      .post("/api/auth/login")
      .set(headers)
      .send({ username: "owner", password })
      .expect(200);
    return response.headers["set-cookie"][0].split(";")[0] as string;
  }
  return {
    root,
    source,
    client,
    password,
    id,
    app,
    factory,
    adapter,
    directory,
    image,
    login,
    stats: () => ({ downloads, uploads }),
    close() {
      source.close();
      client.close();
      for (const k of [
        "SESSION_SECRET",
        "MEDIA_ENCRYPTION_KEY",
        "UPLOADTHING_TOKEN",
      ])
        if (env[k] === undefined) delete process.env[k];
        else process.env[k] = env[k];
    },
  };
}
test("migration Turso giữ dữ liệu, chạy lại an toàn, không chép phiên và từ chối ghi đè", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (await f.client.execute("SELECT * FROM sessions")).rows.length,
      0,
    );
    assert.equal((await migrateDatabase(f.source, f.client)).products, 1);
    await f.client.execute(
      "UPDATE categories SET name='Đã sửa trên cloud' WHERE id=1",
    );
    await assert.rejects(migrateDatabase(f.source, f.client), /không ghi đè/);
    assert.equal(
      (await f.client.execute("SELECT name FROM categories WHERE id=1")).rows[0]
        .name,
      "Đã sửa trên cloud",
    );
  } finally {
    f.close();
  }
});
test("serverless: cookie Secure, phiên dùng chung qua hai instance, logout thu hồi phiên, không ghi local", async () => {
  const f = await fixture();
  try {
    const login = await request(f.app)
      .post("/api/auth/login")
      .set(headers)
      .send({ username: "owner", password: f.password })
      .expect(200);
    const raw = login.headers["set-cookie"][0];
    assert.match(raw, /Secure/);
    assert.match(raw, /HttpOnly/);
    assert.match(raw, /SameSite=Strict/);
    const cookie = raw.split(";")[0];
    const second = f.factory();
    assert.equal(
      (
        await request(second)
          .get("/api/auth/me")
          .set("Cookie", cookie)
          .expect(200)
      ).body.username,
      "owner",
    );
    await request(second)
      .post("/api/auth/logout")
      .set(headers)
      .set("Cookie", cookie)
      .expect(200);
    await request(f.app)
      .get("/api/admin/products")
      .set("Cookie", cookie)
      .expect(401);
    assert.equal(existsSync(f.directory), false);
  } finally {
    f.close();
  }
});
test("serverless: CRUD Turso, upload cloud, lỗi trùng, chặn ảnh ẩn và CSRF", async () => {
  const f = await fixture();
  try {
    await request(f.app)
      .post("/api/admin/media")
      .set(headers)
      .attach("image", f.image, {
        filename: "hoa.webp",
        contentType: "image/webp",
      })
      .expect(401);
    const cookie = await f.login();
    const unavailable = buildApp(
      remoteQueries(f.client),
      f.directory,
      {
        ...f.adapter,
        async download() {
          throw new CloudStorageError("Không đọc được ảnh.");
        },
      },
      true,
    );
    await request(unavailable).get(`/media/${f.id}`).expect(502);
    await request(f.app)
      .post("/api/admin/media")
      .set(headers)
      .set("Cookie", cookie)
      .attach("image", Buffer.from("fake"), {
        filename: "hoa.webp",
        contentType: "image/webp",
      })
      .expect(400);
    const upload = await request(f.app)
      .post("/api/admin/media")
      .set(headers)
      .set("Cookie", cookie)
      .attach("image", f.image, {
        filename: "hoa.webp",
        contentType: "image/webp",
      })
      .expect(201);
    assert.equal(upload.body.storage, "uploadthing");
    assert.equal(f.stats().uploads, 1);
    assert.equal(existsSync(f.directory), false);
    const product = {
      code: "NEW",
      name: "Hoa mới",
      slug: "hoa-moi",
      description: "Đẹp",
      categoryIds: [1],
      images: [upload.body.id],
      featured: true,
      visible: true,
      available: true,
      draftNote: "",
    };
    const created = await request(f.app)
      .post("/api/admin/products")
      .set(headers)
      .set("Cookie", cookie)
      .send(product)
      .expect(201);
    await request(f.app)
      .post("/api/admin/products")
      .set(headers)
      .set("Cookie", cookie)
      .send(product)
      .expect(409);
    await request(f.app).get("/api/products/hoa-moi").expect(200);
    await request(f.app).get(`/media/${upload.body.id}`).expect(200);
    const before = f.stats().downloads;
    await request(f.app)
      .put(`/api/admin/products/${created.body.id}`)
      .set(headers)
      .set("Cookie", cookie)
      .send({ ...product, visible: false })
      .expect(200);
    await request(f.app).get("/api/products/hoa-moi").expect(404);
    await request(f.app).get(`/media/${upload.body.id}`).expect(404);
    assert.equal(f.stats().downloads, before);
    await request(f.app)
      .post("/api/admin/categories")
      .set(headers)
      .set("Origin", "https://other.test")
      .set("Cookie", cookie)
      .send({ name: "Test", kind: "type" })
      .expect(403);
    await request(f.app)
      .delete(`/api/admin/products/${created.body.id}`)
      .set(headers)
      .set("Cookie", cookie)
      .expect(200);
  } finally {
    f.close();
  }
});
test("serverless: giới hạn đăng nhập dùng chung trên nhiều instance", async () => {
  const f = await fixture();
  try {
    const second = f.factory();
    for (let i = 0; i < 10; i++)
      await request(i % 2 ? f.app : second)
        .post("/api/auth/login")
        .set(headers)
        .send({ username: "owner", password: "wrong" })
        .expect(401);
    await request(f.factory())
      .post("/api/auth/login")
      .set(headers)
      .send({ username: "owner", password: f.password })
      .expect(429);
  } finally {
    f.close();
  }
});
test("serverless: thiếu ENV hoặc khóa ảnh không hợp lệ bị chặn trước khi kết nối", async () => {
  const f = await fixture();
  try {
    assert.throws(() => validateServerEnvironment({}), /TURSO_DATABASE_URL/);
    assert.throws(
      () =>
        validateServerEnvironment({
          ...process.env,
          TURSO_DATABASE_URL: "libsql://test",
          TURSO_AUTH_TOKEN: "fake",
          MEDIA_ENCRYPTION_KEY: "invalid",
        }),
      /MEDIA_ENCRYPTION_KEY/,
    );
  } finally {
    f.close();
  }
});
