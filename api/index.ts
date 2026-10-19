import type { Request, Response } from "express";
import { buildApp } from "../server/app.js";
import { connectTurso, remoteQueries } from "../server/persistence.js";
import {
  createUploadThingAdapter,
  cloudConfigSchema,
} from "../server/cloud-storage.js";

export function validateServerEnvironment(env = process.env) {
  for (const name of [
    "TURSO_DATABASE_URL",
    "TURSO_AUTH_TOKEN",
    "UPLOADTHING_TOKEN",
    "SESSION_SECRET",
    "MEDIA_ENCRYPTION_KEY",
  ])
    if (!env[name]) throw new Error(`Thiếu biến môi trường ${name}.`);
  if (env.SESSION_SECRET!.length < 32)
    throw new Error("SESSION_SECRET phải có ít nhất 32 ký tự.");
  if (!/^[a-f0-9]{64}$/i.test(env.MEDIA_ENCRYPTION_KEY!))
    throw new Error("MEDIA_ENCRYPTION_KEY không hợp lệ.");
  cloudConfigSchema.parse({ token: env.UPLOADTHING_TOKEN });
}
let app: ReturnType<typeof buildApp> | undefined;
export default function handler(req: Request, res: Response) {
  try {
    if (!app) {
      validateServerEnvironment();
      const db = remoteQueries(connectTurso());
      app = buildApp(
        db,
        "/tmp/iapa",
        createUploadThingAdapter("/tmp/iapa"),
        true,
      );
    }
    return app(req, res);
  } catch {
    res.status(503).json({
      error:
        "Máy chủ chưa được cấu hình đầy đủ. Vui lòng kiểm tra biến môi trường trên Vercel.",
    });
  }
}
