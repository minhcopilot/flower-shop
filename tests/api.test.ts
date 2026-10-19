import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import request from "supertest";
import sharp from "sharp";
import { createApp } from "../server/app.js";
import { hashPassword, checkPassword } from "../server/db.js";
import { backupData, restoreData } from "../server/cli.js";
import type { ProductInput } from "../shared/schema.js";

const root = mkdtempSync(path.join(tmpdir(), "iapa-api-"));
const dir = path.join(root, "data");
let instance = createApp(dir);
let agent = request.agent(instance.app);
const password = randomBytes(24).toString("base64url");
instance.db
  .prepare("INSERT INTO admin VALUES(1,?,?)")
  .run("owner", hashPassword(password));
let imageId = "";
const uploadedIds: string[] = [];
let categoryId = 0;
let productId = 0;
const input = (): ProductInput => ({
  code: "IP-TEST",
  name: "Bó hoa kiểm thử",
  slug: "bo-hoa-kiem-thu",
  description: "Hoa hồng dịu dàng",
  categoryIds: [categoryId],
  images: [imageId],
  featured: true,
  visible: true,
  available: true,
  sourceUrl: "https://www.facebook.com/thihang002224",
  draftNote: "",
});
const jsonHeader = { "X-Shop-Request": "1" };
after(() => {
  instance.db.close();
});

test("chặn toàn bộ API quản trị và upload khi chưa đăng nhập", async () => {
  await request(instance.app).get("/api/admin/products").expect(401);
  await request(instance.app)
    .post("/api/admin/media")
    .set(jsonHeader)
    .expect(401);
  await request(instance.app)
    .post("/api/admin/products")
    .set(jsonHeader)
    .send({})
    .expect(401);
  await request(instance.app)
    .post("/api/admin/categories")
    .set(jsonHeader)
    .send({})
    .expect(401);
});
test("đăng nhập sai, CSRF, đăng nhập đúng và cookie HttpOnly", async () => {
  await request(instance.app)
    .post("/api/auth/login")
    .send({ username: "owner", password })
    .expect(403);
  await request(instance.app)
    .post("/api/auth/login")
    .set(jsonHeader)
    .set("Origin", "https://evil.example")
    .send({ username: "owner", password })
    .expect(403);
  await agent
    .post("/api/auth/login")
    .set(jsonHeader)
    .send({ username: "owner", password: "wrong" })
    .expect(401);
  const r = await agent
    .post("/api/auth/login")
    .set(jsonHeader)
    .send({ username: "owner", password })
    .expect(200);
  assert.match(String(r.headers["set-cookie"]), /HttpOnly/);
  assert.match(String(r.headers["set-cookie"]), /SameSite=Strict/);
  assert.equal((await agent.get("/api/auth/me")).body.username, "owner");
  const stored = instance.db.prepare("SELECT password FROM admin").get() as {
    password: string;
  };
  assert.notEqual(stored.password, password);
  assert.ok(checkPassword(password, stored.password));
});
test("danh mục CRUD và xác thực dữ liệu", async () => {
  const r = await agent
    .post("/api/admin/categories")
    .set(jsonHeader)
    .send({ name: "Bó hoa", kind: "type" })
    .expect(201);
  categoryId = r.body.id;
  await agent
    .put(`/api/admin/categories/${categoryId}`)
    .set(jsonHeader)
    .send({ name: "Hoa bó", kind: "type" })
    .expect(200);
  await agent
    .post("/api/admin/categories")
    .set(jsonHeader)
    .send({ name: "", kind: "type" })
    .expect(400);
  await agent
    .put("/api/admin/categories/abc")
    .set(jsonHeader)
    .send({ name: "Lỗi", kind: "type" })
    .expect(400);
  assert.equal(
    (await request(instance.app).get("/api/categories")).body[0].name,
    "Hoa bó",
  );
});
test("upload từ chối tệp giả, SVG, ảnh quá 10 MB và nhận JPEG/PNG/WebP", async () => {
  await agent
    .post("/api/admin/media")
    .set(jsonHeader)
    .attach("image", Buffer.from("<svg/>"), {
      filename: "a.svg",
      contentType: "image/svg+xml",
    })
    .expect(400);
  await agent
    .post("/api/admin/media")
    .set(jsonHeader)
    .attach("image", Buffer.from("not an image"), {
      filename: "a.jpg",
      contentType: "image/jpeg",
    })
    .expect(400);
  await agent
    .post("/api/admin/media")
    .set(jsonHeader)
    .attach("image", Buffer.alloc(10 * 1024 * 1024 + 1), {
      filename: "large.jpg",
      contentType: "image/jpeg",
    })
    .expect(400);
  for (const format of ["jpeg", "png", "webp"] as const) {
    const bytes = await sharp({
      create: { width: 40, height: 30, channels: 3, background: "#e6aabb" },
    })
      .toFormat(format)
      .toBuffer();
    const r = await agent
      .post("/api/admin/media")
      .set(jsonHeader)
      .attach("image", bytes, {
        filename: `../../test.${format}`,
        contentType: `image/${format}`,
      })
      .expect(201);
    imageId = r.body.id;
    uploadedIds.push(imageId);
    const meta = await sharp(
      path.join(dir, "uploads", `${imageId}.webp`),
    ).metadata();
    assert.equal(meta.format, "webp");
  }
  await request(instance.app).get(`/media/${imageId}`).expect(404);
  await agent.get(`/media/${imageId}`).expect(200);
});
test("tạo → công khai → sửa → đổi ảnh đại diện; không lộ nguồn/giá/nháp", async () => {
  const r = await agent
    .post("/api/admin/products")
    .set(jsonHeader)
    .send(input())
    .expect(201);
  productId = r.body.id;
  const publicProduct = (
    await request(instance.app).get("/api/products/bo-hoa-kiem-thu").expect(200)
  ).body;
  assert.equal(publicProduct.code, "IP-TEST");
  assert.equal(publicProduct.sourceUrl, undefined);
  assert.equal(publicProduct.draftNote, undefined);
  assert.equal(publicProduct.price, undefined);
  await request(instance.app).get(`/media/${imageId}`).expect(200);
  await agent
    .put(`/api/admin/products/${productId}`)
    .set(jsonHeader)
    .send({
      ...input(),
      name: "Bó hoa đã sửa",
      available: false,
      images: [uploadedIds[0], imageId],
    })
    .expect(200);
  assert.deepEqual(
    (await request(instance.app).get("/api/products/bo-hoa-kiem-thu")).body
      .images,
    [uploadedIds[0], imageId],
  );
  await agent
    .put(`/api/admin/products/${productId}`)
    .set(jsonHeader)
    .send({ ...input(), images: [imageId, uploadedIds[0]] })
    .expect(200);
  assert.equal(
    (await request(instance.app).get("/api/products/bo-hoa-kiem-thu")).body
      .images[0],
    imageId,
  );
  await agent
    .put(`/api/admin/products/${productId}`)
    .set(jsonHeader)
    .send({ ...input(), available: false })
    .expect(200);
  assert.equal(
    (await request(instance.app).get("/api/products/bo-hoa-kiem-thu")).body
      .available,
    false,
  );
  await agent
    .delete(`/api/admin/categories/${categoryId}`)
    .set(jsonHeader)
    .expect(409);
  await agent
    .post("/api/admin/products")
    .set(jsonHeader)
    .send(input())
    .expect(409);
  await agent
    .put("/api/admin/products/abc")
    .set(jsonHeader)
    .send(input())
    .expect(400);
  await agent
    .post("/api/admin/products")
    .set(jsonHeader)
    .send({
      ...input(),
      code: "IP-OTHER",
      slug: "other",
      images: [],
      draftNote: "Ảnh template",
    })
    .expect(400);
  await agent
    .post("/api/admin/products")
    .set(jsonHeader)
    .send({ ...input(), code: "IP-OTHER", slug: "other", categoryIds: [999] })
    .expect(400);
});
test("mẫu ẩn bị chặn ở danh sách, URL trực tiếp và ảnh", async () => {
  await agent
    .put(`/api/admin/products/${productId}`)
    .set(jsonHeader)
    .send({ ...input(), visible: false })
    .expect(200);
  assert.equal(
    (await request(instance.app).get("/api/products")).body.length,
    0,
  );
  await request(instance.app).get("/api/products/bo-hoa-kiem-thu").expect(404);
  await request(instance.app).get(`/media/${imageId}`).expect(404);
  assert.equal((await agent.get("/api/admin/products")).body.length, 1);
});
test("dữ liệu, ảnh và phiên đăng nhập còn sau khi mở lại database", async () => {
  // Capture the current session from a fresh login to verify persisted sessions independently of the client jar.
  const login = await agent
    .post("/api/auth/login")
    .set(jsonHeader)
    .send({ username: "owner", password })
    .expect(200);
  const cookie = login.headers["set-cookie"][0].split(";")[0];
  instance.db.close();
  instance = createApp(dir);
  agent = request.agent(instance.app);
  assert.equal(
    (await request(instance.app).get("/api/auth/me").set("Cookie", cookie)).body
      .username,
    "owner",
  );
  await agent
    .post("/api/auth/login")
    .set(jsonHeader)
    .send({ username: "owner", password })
    .expect(200);
  assert.equal(
    (await agent.get("/api/admin/products")).body[0].code,
    "IP-TEST",
  );
  assert.ok(existsSync(path.join(dir, "uploads", `${imageId}.webp`)));
  await agent.post("/api/auth/logout").set(jsonHeader).expect(200);
  await agent.get("/api/admin/products").expect(401);
});
test("sao lưu/khôi phục giữ dữ liệu và ảnh, thu hồi phiên, phát hiện tệp bị đổi", async () => {
  instance.db.close();
  const backup = backupData(dir, path.join(root, "backups"));
  assert.ok(existsSync(path.join(backup, "manifest.json")));
  const restored = path.join(root, "restored");
  restoreData(restored, backup);
  const restoredApp = createApp(restored);
  try {
    assert.equal(
      (
        restoredApp.db.prepare("SELECT count(*) AS n FROM products").get() as {
          n: number;
        }
      ).n,
      1,
    );
    assert.equal(
      (
        restoredApp.db.prepare("SELECT count(*) AS n FROM sessions").get() as {
          n: number;
        }
      ).n,
      0,
    );
    assert.ok(
      readFileSync(path.join(restored, "uploads", `${imageId}.webp`)).length >
        0,
    );
  } finally {
    restoredApp.db.close();
  }
  writeFileSync(path.join(backup, "uploads", `${imageId}.webp`), "broken");
  assert.throws(
    () => restoreData(path.join(root, "refused"), backup),
    /thay đổi/,
  );
  instance = createApp(dir);
});
test("giới hạn số lần đăng nhập sai", async () => {
  let limited = false;
  for (let i = 0; i < 11; i++) {
    const r = await request(instance.app)
      .post("/api/auth/login")
      .set(jsonHeader)
      .send({ username: "owner", password: "wrong" });
    if (r.status === 429) {
      limited = true;
      break;
    }
  }
  assert.ok(limited);
});
