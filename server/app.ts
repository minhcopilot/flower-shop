import express from "express";
import session from "express-session";
import multer from "multer";
import sharp, { type Metadata } from "sharp";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomUUID, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { categorySchema, productSchema } from "../shared/schema.js";
import {
  createUploadThingAdapter,
  tokenAppId,
  CloudStorageError,
  cloudConfigSchema,
  loadCloudConfig,
  saveCloudConfig,
  type CloudAdapter,
} from "./cloud-storage.js";
import type { StorageStatus } from "../shared/storage.js";
import {
  openDatabase,
  products,
  categories,
  saveProduct,
  checkPassword,
  SqliteSessionStore,
} from "./db.js";

declare module "express-session" {
  interface SessionData {
    admin?: string;
  }
}
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};
export function createApp(
  directory = path.resolve("data"),
  storage: CloudAdapter = createUploadThingAdapter(directory),
) {
  const db = openDatabase(directory);
  const secretPath = path.join(directory, "session-secret");
  if (!existsSync(secretPath))
    writeFileSync(secretPath, randomBytes(48).toString("hex"), { mode: 0o600 });
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'"],
          "img-src": ["'self'", "data:", "blob:"],
          "frame-src": ["https://www.google.com"],
          "upgrade-insecure-requests": null,
        },
      },
      strictTransportSecurity: false,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(
    session({
      name: "iapa.sid",
      secret: readFileSync(secretPath, "utf8"),
      store: new SqliteSessionStore(db),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "strict",
        secure: false,
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.get("X-Shop-Request") !== "1")
        return next(
          new HttpError(403, "Yêu cầu không hợp lệ. Vui lòng tải lại trang."),
        );
      const origin = req.get("origin");
      if (origin && new URL(origin).host !== req.get("host"))
        return next(new HttpError(403, "Nguồn yêu cầu không hợp lệ."));
    }
    next();
  });
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/categories", (_req, res) => res.json(categories(db)));
  app.get("/api/products", (_req, res) =>
    res.json(
      products(db)
        .filter((p) => p.visible)
        .map(({ sourceUrl: _source, draftNote: _draft, ...p }) => p),
    ),
  );
  app.get("/api/products/:slug", (req, res) => {
    const p = products(db).find((p) => p.visible && p.slug === req.params.slug);
    if (!p) fail(404, "Không tìm thấy mẫu hoa.");
    const { sourceUrl: _source, draftNote: _draft, ...publicProduct } = p!;
    res.json(publicProduct);
  });
  app.get("/api/auth/me", (req, res) =>
    res.json({ username: req.session.admin ?? null }),
  );
  app.post(
    "/api/auth/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.",
      },
    }),
    (req, res, next) => {
      const value = z
        .object({ username: z.string().max(80), password: z.string().max(200) })
        .parse(req.body);
      const admin = db
        .prepare("SELECT username,password FROM admin WHERE id=1")
        .get() as { username: string; password: string } | undefined;
      if (!admin)
        fail(
          503,
          "Chưa tạo tài khoản chủ shop. Chạy npm run admin:setup trong terminal.",
        );
      const valid = checkPassword(value.password, admin!.password);
      if (!valid || value.username !== admin!.username)
        fail(401, "Tên đăng nhập hoặc mật khẩu chưa đúng.");
      req.session.regenerate((err) => {
        if (err) return next(err);
        req.session.admin = admin!.username;
        req.session.save((err) => {
          if (err) return next(err);
          res.json({ username: admin!.username });
        });
      });
    },
  );
  app.post("/api/auth/logout", (req, res, next) =>
    req.session.destroy((err) => {
      if (err) return next(err);
      res
        .clearCookie("iapa.sid", { httpOnly: true, sameSite: "strict" })
        .json({ ok: true });
    }),
  );
  app.use("/api/admin", (req, _res, next) =>
    req.session.admin
      ? next()
      : next(new HttpError(401, "Vui lòng đăng nhập để quản trị.")),
  );
  app.get("/api/admin/products", (_req, res) => res.json(products(db)));
  type MediaRow = {
    id: string;
    filename: string;
    appId: string | null;
    fileKey: string | null;
  };
  function storageStatus(): StorageStatus {
    const config = loadCloudConfig(directory);
    const usedIds = new Set(products(db).flatMap((p) => p.images));
    const used = (db.prepare("SELECT * FROM media").all() as MediaRow[]).filter(
      (m) => usedIds.has(m.id),
    );
    return {
      configured: !!config,
      appId: (config ? tokenAppId(config.token) : null) || "",
      cloudImages: used.filter((m) => !!m.fileKey).length,
      localImages: used.filter((m) => !m.fileKey).length,
      pendingIds: used.filter((m) => !m.fileKey).map((m) => m.id),
    };
  }
  app.get("/api/admin/storage", (_req, res) => res.json(storageStatus()));
  app.put("/api/admin/storage", async (req, res) => {
    const config = cloudConfigSchema.parse(req.body);
    const otherCloud = db
      .prepare(
        "SELECT id FROM media WHERE fileKey IS NOT NULL AND appId != ? LIMIT 1",
      )
      .get(tokenAppId(config.token));
    if (otherCloud)
      fail(
        409,
        "Đã có ảnh trong ứng dụng UploadThing cũ. Hãy dùng token của cùng ứng dụng để ảnh tiếp tục truy cập được.",
      );
    await storage.verify(config);
    saveCloudConfig(directory, config);
    res.json(storageStatus());
  });
  app.post("/api/admin/storage/migrate", async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).strict().parse(req.body);
    const config = loadCloudConfig(directory);
    if (!config) fail(409, "Vui lòng kết nối UploadThing trước.");
    const media = db.prepare("SELECT * FROM media WHERE id=?").get(id) as
      MediaRow | undefined;
    if (!media || !products(db).some((p) => p.images.includes(id)))
      fail(404, "Không tìm thấy ảnh đang được sử dụng.");
    if (!media!.fileKey) {
      const bytes = readFileSync(
        path.join(directory, "uploads", media!.filename),
      );
      const fileKey = await storage.upload(bytes, id, config!);
      db.prepare("UPDATE media SET appId=?,fileKey=? WHERE id=?").run(
        tokenAppId(config!.token),
        fileKey,
        id,
      );
    }
    res.json(storageStatus());
  });
  app.post("/api/admin/categories", (req, res) => {
    const v = categorySchema.parse(req.body);
    const r = db
      .prepare("INSERT INTO categories(name,kind) VALUES(?,?)")
      .run(v.name, v.kind);
    res.status(201).json({ ...v, id: Number(r.lastInsertRowid) });
  });
  app.put("/api/admin/categories/:id", (req, res) => {
    const v = categorySchema.parse(req.body);
    const r = db
      .prepare("UPDATE categories SET name=?,kind=? WHERE id=?")
      .run(
        v.name,
        v.kind,
        z.coerce.number().int().positive().parse(req.params.id),
      );
    if (!r.changes) fail(404, "Không tìm thấy danh mục.");
    res.json({ ok: true });
  });
  app.delete("/api/admin/categories/:id", (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    if (products(db).some((p) => p.categoryIds.includes(id)))
      fail(
        409,
        "Danh mục đang có mẫu hoa. Hãy chuyển các mẫu sang danh mục khác trước.",
      );
    const r = db.prepare("DELETE FROM categories WHERE id=?").run(id);
    if (!r.changes) fail(404, "Không tìm thấy danh mục.");
    res.json({ ok: true });
  });
  function writeProduct(body: unknown, id?: number) {
    if (id && !products(db).some((p) => p.id === id))
      fail(404, "Không tìm thấy mẫu hoa.");
    const v = productSchema.parse(body);
    const ids = new Set(categories(db).map((c) => c.id));
    if (v.categoryIds.some((c) => !ids.has(c)))
      fail(400, "Danh mục không tồn tại.");
    if (
      v.images.some(
        (i) => !db.prepare("SELECT id FROM media WHERE id=?").get(i),
      )
    )
      fail(400, "Ảnh không tồn tại. Vui lòng tải ảnh lại.");
    return saveProduct(db, v, id);
  }
  app.post("/api/admin/products", (req, res) =>
    res.status(201).json({ id: writeProduct(req.body) }),
  );
  app.put("/api/admin/products/:id", (req, res) =>
    res.json({
      id: writeProduct(
        req.body,
        z.coerce.number().int().positive().parse(req.params.id),
      ),
    }),
  );
  app.delete("/api/admin/products/:id", (req, res) => {
    const r = db
      .prepare("DELETE FROM products WHERE id=?")
      .run(z.coerce.number().int().positive().parse(req.params.id));
    if (!r.changes) fail(404, "Không tìm thấy mẫu hoa.");
    res.json({ ok: true });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (_req, f, cb) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.mimetype))
        return cb(new HttpError(400, "Chỉ nhận ảnh JPEG, PNG hoặc WebP."));
      cb(null, true);
    },
  });
  app.post("/api/admin/media", upload.single("image"), async (req, res) => {
    if (!req.file) fail(400, "Vui lòng chọn ảnh.");
    const pipeline = sharp(req.file!.buffer, {
      limitInputPixels: 40_000_000,
      failOn: "error",
    });
    let meta: Metadata;
    try {
      meta = await pipeline.metadata();
    } catch {
      return fail(400, "Tệp không phải ảnh hợp lệ.");
    }
    if (
      !meta.format ||
      !["jpeg", "png", "webp"].includes(meta.format) ||
      (meta.pages ?? 1) > 1
    )
      fail(400, "Chỉ nhận ảnh tĩnh JPEG, PNG hoặc WebP.");
    const id = randomUUID(),
      filename = `${id}.webp`;
    let bytes: Buffer;
    try {
      bytes = await pipeline
        .rotate()
        .resize({
          width: 1600,
          height: 1800,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      return fail(400, "Không thể xử lý ảnh. Vui lòng chọn ảnh khác.");
    }
    const config = loadCloudConfig(directory);
    const fileKey = config ? await storage.upload(bytes, id, config) : null;
    writeFileSync(path.join(directory, "uploads", filename), bytes);
    db.prepare(
      "INSERT INTO media(id,filename,appId,fileKey) VALUES(?,?,?,?)",
    ).run(
      id,
      filename,
      (config ? tokenAppId(config.token) : null) || null,
      fileKey,
    );
    res.status(201).json({ id, storage: fileKey ? "uploadthing" : "local" });
  });
  app.get("/media/:id", async (req, res) => {
    const id = req.params.id;
    if (!z.string().uuid().safeParse(id).success)
      return fail(404, "Không tìm thấy ảnh.");
    const media = db.prepare("SELECT * FROM media WHERE id=?").get(id) as
      MediaRow | undefined;
    if (
      !media ||
      (!req.session.admin &&
        !products(db).some((p) => p.visible && p.images.includes(id)))
    )
      fail(404, "Không tìm thấy ảnh.");
    if (media!.fileKey) {
      const config = loadCloudConfig(directory);
      if (config && tokenAppId(config.token) === media!.appId) {
        try {
          const bytes = await storage.download(media!.fileKey, config);
          res
            .set("Cache-Control", "private, no-store")
            .type("image/webp")
            .send(bytes);
          return;
        } catch {
          if (!existsSync(path.join(directory, "uploads", media!.filename)))
            throw new CloudStorageError(
              "Ảnh tạm thời không tải được. Vui lòng thử lại.",
            );
        }
      }
    }
    res
      .set("Cache-Control", "private, no-store")
      .sendFile(path.resolve(directory, "uploads", media!.filename));
  });
  app.use("/api", (_req, _res, next) =>
    next(new HttpError(404, "Không tìm thấy chức năng.")),
  );
  const dist = path.resolve("dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*splat}", (_req, res) =>
      res.sendFile(path.join(dist, "index.html")),
    );
  }
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (err instanceof CloudStorageError)
        return res.status(502).json({ error: err.message });
      if (err instanceof z.ZodError)
        return res
          .status(400)
          .json({ error: err.issues.map((i) => i.message).join(" ") });
      if (err instanceof multer.MulterError)
        return res.status(400).json({
          error:
            err.code === "LIMIT_FILE_SIZE"
              ? "Ảnh vượt quá 10 MB."
              : "Chỉ tải lên một ảnh mỗi lần.",
        });
      if (err instanceof HttpError)
        return res.status(err.status).json({ error: err.message });
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        String(err.code).startsWith("SQLITE_CONSTRAINT")
      )
        return res
          .status(409)
          .json({ error: "Mã mẫu, đường dẫn hoặc tên danh mục đã tồn tại." });
      if (err instanceof SyntaxError)
        return res.status(400).json({ error: "Dữ liệu gửi lên không hợp lệ." });
      console.error("Lỗi máy chủ:", err instanceof Error ? err.message : err);
      res.status(500).json({ error: "Không thể hoàn tất. Vui lòng thử lại." });
    },
  );
  return { app, db };
}
