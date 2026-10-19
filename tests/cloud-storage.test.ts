import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import Database from "better-sqlite3";
import sharp from "sharp";
import request from "supertest";
import { createApp } from "../server/app.js";
import { hashPassword, saveProduct, products } from "../server/db.js";
import {
  CloudStorageError,
  type CloudAdapter,
  type CloudConfig,
  tokenAppId,
  encryptMedia,
  decryptMedia,
} from "../server/cloud-storage.js";
import { backupData, restoreData } from "../server/cli.js";

const config: CloudConfig = {
  token: Buffer.from(
    JSON.stringify({
      appId: "shop-test",
      apiKey: "sk_test_only_fake",
      regions: ["sea1"],
    }),
  ).toString("base64"),
};
const headers = { "X-Shop-Request": "1" };
test("mã hóa ảnh cloud: đọc lại đúng ảnh, từ chối sai khóa hoặc dữ liệu bị sửa", () => {
  const key = randomBytes(32),
    bytes = Buffer.from("private-flower-image");
  const encrypted = encryptMedia(bytes, key);
  assert.ok(!encrypted.includes(bytes));
  assert.deepEqual(decryptMedia(encrypted, key), bytes);
  assert.throws(() => decryptMedia(encrypted, randomBytes(32)));
  encrypted[20] ^= 1;
  assert.throws(() => decryptMedia(encrypted, key));
});
async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "iapa-cloud-"));
  const dir = path.join(root, "data");
  const image = await sharp({
    create: { width: 50, height: 60, channels: 3, background: "#eec3d2" },
  })
    .webp()
    .toBuffer();
  let uploads = 0,
    downloads = 0,
    uploadFails = false,
    downloadFails = false,
    verifyFails = false;
  const adapter: CloudAdapter = {
    async verify(c) {
      if (verifyFails)
        throw new CloudStorageError("Không kết nối được UploadThing.");
      assert.equal(c.token, config.token);
    },
    async upload(bytes, id, c) {
      assert.equal(tokenAppId(c.token), tokenAppId(config.token));
      assert.equal((await sharp(bytes).metadata()).format, "webp");
      if (uploadFails)
        throw new CloudStorageError("Không tải được ảnh lên UploadThing.");
      uploads++;
      return `hoa-tuoi-ia-pa/${id}`;
    },
    async download() {
      downloads++;
      if (downloadFails) throw new CloudStorageError("Không đọc được ảnh.");
      return image;
    },
  };
  const instance = createApp(dir, adapter);
  writeFileSync(
    path.join(dir, "media-encryption-key"),
    randomBytes(32).toString("hex"),
  );
  const agent = request.agent(instance.app);
  const password = randomBytes(20).toString("hex");
  instance.db
    .prepare("INSERT INTO admin VALUES(1,?,?)")
    .run("owner", hashPassword(password));
  await agent
    .post("/api/auth/login")
    .set(headers)
    .send({ username: "owner", password })
    .expect(200);
  const id = randomUUID();
  writeFileSync(path.join(dir, "uploads", `${id}.webp`), image);
  instance.db
    .prepare("INSERT INTO media(id,filename) VALUES(?,?)")
    .run(id, `${id}.webp`);
  const product = {
    code: "IP-CLOUD",
    name: "Mẫu hoa cũ",
    slug: "mau-hoa-cu",
    description: "Giữ nguyên nội dung",
    categoryIds: [],
    images: [id],
    featured: true,
    visible: true,
    available: true,
    sourceUrl: "https://www.facebook.com/thihang002224",
    draftNote: "",
  };
  const productId = saveProduct(instance.db, product);
  return {
    ...instance,
    agent,
    root,
    dir,
    id,
    image,
    product,
    productId,
    counts: () => ({ uploads, downloads }),
    failUpload: (v: boolean) => {
      uploadFails = v;
    },
    failDownload: (v: boolean) => {
      downloadFails = v;
    },
    failVerify: (v: boolean) => {
      verifyFails = v;
    },
  };
}

test("migration schema giữ ảnh cũ và có thể chạy lại", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "iapa-old-schema-"));
  const old = new Database(path.join(dir, "shop.sqlite"));
  const id = randomUUID();
  old.exec(
    "CREATE TABLE media (id TEXT PRIMARY KEY,filename TEXT NOT NULL UNIQUE)",
  );
  old.prepare("INSERT INTO media VALUES(?,?)").run(id, `${id}.webp`);
  old.close();
  for (let i = 0; i < 2; i++) {
    const { db } = createApp(dir);
    try {
      const row = db.prepare("SELECT * FROM media WHERE id=?").get(id) as {
        id: string;
        filename: string;
        appId: string | null;
        fileKey: string | null;
      };
      assert.equal(row.filename, `${id}.webp`);
      assert.equal(row.fileKey, null);
    } finally {
      db.close();
    }
  }
});
test("cấu hình cloud bắt buộc đăng nhập, không lộ khóa và chỉ lưu sau khi kết nối đạt", async () => {
  const f = await fixture();
  try {
    await request(f.app).get("/api/admin/storage").expect(401);
    await request(f.app)
      .put("/api/admin/storage")
      .set(headers)
      .send(config)
      .expect(401);
    await request(f.app)
      .post("/api/admin/storage/migrate")
      .set(headers)
      .send({ id: f.id })
      .expect(401);
    const before = await f.agent.get("/api/admin/storage").expect(200);
    assert.equal(before.body.configured, false);
    assert.equal(before.body.localImages, 1);
    await f.agent
      .post("/api/admin/storage/migrate")
      .set(headers)
      .send({ id: f.id })
      .expect(409);
    await f.agent
      .put("/api/admin/storage")
      .set(headers)
      .send({ ...config, token: "not-a-valid-token" })
      .expect(400);
    f.failVerify(true);
    await f.agent
      .put("/api/admin/storage")
      .set(headers)
      .send(config)
      .expect(502);
    assert.equal(existsSync(path.join(f.dir, "uploadthing.json")), false);
    f.failVerify(false);
    const saved = await f.agent
      .put("/api/admin/storage")
      .set(headers)
      .send(config)
      .expect(200);
    assert.equal(saved.body.configured, true);
    assert.equal(saved.body.appId, tokenAppId(config.token));
    const read = await f.agent.get("/api/admin/storage").expect(200);
    assert.equal(read.body.apiKey, undefined);
    assert.equal(read.body.apiSecret, undefined);
    assert.ok(!JSON.stringify(read.body).includes(config.token));
  } finally {
    f.db.close();
  }
});
test("chuyển ảnh giữ UUID, mẫu và thứ tự; có thể thử lại; mẫu ẩn vẫn chặn trước khi gọi cloud", async () => {
  const f = await fixture();
  try {
    await f.agent
      .put("/api/admin/storage")
      .set(headers)
      .send(config)
      .expect(200);
    f.failUpload(true);
    await f.agent
      .post("/api/admin/storage/migrate")
      .set(headers)
      .send({ id: f.id })
      .expect(502);
    assert.equal((await f.agent.get("/api/admin/storage")).body.localImages, 1);
    assert.equal(products(f.db)[0].images[0], f.id);
    f.failUpload(false);
    await f.agent
      .post("/api/admin/storage/migrate")
      .set(headers)
      .send({ id: f.id })
      .expect(200);
    await f.agent
      .post("/api/admin/storage/migrate")
      .set(headers)
      .send({ id: f.id })
      .expect(200);
    assert.equal(f.counts().uploads, 1);
    assert.deepEqual(products(f.db)[0].images, [f.id]);
    assert.equal(products(f.db)[0].sourceUrl, f.product.sourceUrl);
    assert.equal((await f.agent.get("/api/admin/storage")).body.cloudImages, 1);
    const shown = await request(f.app).get(`/media/${f.id}`).expect(200);
    assert.match(shown.headers["content-type"], /image\/webp/);
    assert.equal(shown.headers.location, undefined);
    assert.equal(f.counts().downloads, 1);
    await f.agent
      .put(`/api/admin/products/${f.productId}`)
      .set(headers)
      .send({ ...f.product, visible: false })
      .expect(200);
    await request(f.app).get(`/media/${f.id}`).expect(404);
    assert.equal(f.counts().downloads, 1);
    await request(f.app).get("/api/products/mau-hoa-cu").expect(404);
    await f.agent.get(`/media/${f.id}`).expect(200);
    assert.equal(f.counts().downloads, 2);
    f.failDownload(true);
    await f.agent.get(`/media/${f.id}`).expect(200);
    await f.agent
      .put("/api/admin/storage")
      .set(headers)
      .send({
        ...config,
        token: Buffer.from(
          JSON.stringify({
            appId: "another-cloud",
            apiKey: "sk_test_fake_other",
            regions: ["sea1"],
          }),
        ).toString("base64"),
      })
      .expect(409);
  } finally {
    f.db.close();
  }
});
test("upload mới lên cloud khi đã kết nối; lỗi upload không báo thành công hoặc tạo ảnh local", async () => {
  const f = await fixture();
  try {
    await f.agent
      .put("/api/admin/storage")
      .set(headers)
      .send(config)
      .expect(200);
    const originalCount = readdirSync(path.join(f.dir, "uploads")).length;
    f.failUpload(true);
    await f.agent
      .post("/api/admin/media")
      .set(headers)
      .attach("image", f.image, {
        filename: "hoa.webp",
        contentType: "image/webp",
      })
      .expect(502);
    assert.equal(
      readdirSync(path.join(f.dir, "uploads")).length,
      originalCount,
    );
    f.failUpload(false);
    const upload = await f.agent
      .post("/api/admin/media")
      .set(headers)
      .attach("image", f.image, {
        filename: "hoa.webp",
        contentType: "image/webp",
      })
      .expect(201);
    assert.equal(upload.body.storage, "uploadthing");
    const row = f.db
      .prepare("SELECT * FROM media WHERE id=?")
      .get(upload.body.id) as { appId: string; fileKey: string };
    assert.equal(row.appId, tokenAppId(config.token));
    assert.equal(row.fileKey, `hoa-tuoi-ia-pa/${upload.body.id}`);
    assert.ok(
      existsSync(path.join(f.dir, "uploads", `${upload.body.id}.webp`)),
    );
    const { sourceUrl: _unused, ...noFacebook } = f.product;
    await f.agent
      .put(`/api/admin/products/${f.productId}`)
      .set(headers)
      .send({ ...noFacebook, images: [upload.body.id] })
      .expect(200);
    assert.equal(products(f.db)[0].sourceUrl, "");
  } finally {
    f.db.close();
  }
});
test("backup cloud có ảnh WebP và khóa đọc ảnh, không chứa token; restore giữ cấu hình riêng của máy", async () => {
  const f = await fixture();
  let closed = false;
  try {
    await f.agent
      .put("/api/admin/storage")
      .set(headers)
      .send(config)
      .expect(200);
    await f.agent
      .post("/api/admin/storage/migrate")
      .set(headers)
      .send({ id: f.id })
      .expect(200);
    f.db.close();
    closed = true;
    const backup = backupData(f.dir, path.join(f.root, "backups"));
    const encryptionKey = readFileSync(
      path.join(f.dir, "media-encryption-key"),
      "utf8",
    );
    assert.equal(
      readFileSync(path.join(backup, "media-encryption-key"), "utf8"),
      encryptionKey,
    );
    assert.equal(existsSync(path.join(backup, "uploadthing.json")), false);
    assert.ok(existsSync(path.join(backup, "uploads", `${f.id}.webp`)));
    restoreData(f.dir, backup);
    assert.equal(
      readFileSync(path.join(f.dir, "media-encryption-key"), "utf8"),
      encryptionKey,
    );
    assert.equal(
      tokenAppId(
        JSON.parse(readFileSync(path.join(f.dir, "uploadthing.json"), "utf8"))
          .token,
      ),
      tokenAppId(config.token),
    );
    const restored = createApp(f.dir);
    try {
      assert.equal(products(restored.db)[0].images[0], f.id);
      assert.ok(existsSync(path.join(f.dir, "uploads", `${f.id}.webp`)));
    } finally {
      restored.db.close();
    }
  } finally {
    if (!closed) f.db.close();
  }
});
