import { UTApi, UTFile } from "uploadthing/server";
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import {
  randomUUID,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { z } from "zod";

const tokenPayload = z.object({
  apiKey: z.string().startsWith("sk_"),
  appId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  regions: z.array(z.string()).min(1),
});
export function tokenAppId(token: string) {
  return tokenPayload.parse(
    JSON.parse(Buffer.from(token, "base64").toString("utf8")),
  ).appId;
}
export const cloudConfigSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(20)
      .max(4096)
      .refine((v) => {
        try {
          tokenAppId(v);
          return true;
        } catch {
          return false;
        }
      }, "UPLOADTHING_TOKEN không hợp lệ. Hãy sao chép token V7 từ UploadThing."),
  })
  .strict();
export type CloudConfig = z.infer<typeof cloudConfigSchema>;
export class CloudStorageError extends Error {}
export interface CloudAdapter {
  verify(config: CloudConfig): Promise<void>;
  upload(bytes: Buffer, id: string, config: CloudConfig): Promise<string>;
  download(fileKey: string, config: CloudConfig): Promise<Buffer>;
}
function encryptionKey(directory: string) {
  if (process.env.MEDIA_ENCRYPTION_KEY) {
    if (!/^[a-f0-9]{64}$/i.test(process.env.MEDIA_ENCRYPTION_KEY))
      throw new CloudStorageError(
        "MEDIA_ENCRYPTION_KEY phải gồm 64 ký tự hex.",
      );
    return Buffer.from(process.env.MEDIA_ENCRYPTION_KEY, "hex");
  }
  const file = path.join(directory, "media-encryption-key");
  if (!existsSync(file))
    writeFileSync(file, randomBytes(32).toString("hex"), {
      mode: 0o600,
      flag: "wx",
    });
  const key = Buffer.from(readFileSync(file, "utf8").trim(), "hex");
  if (key.length !== 32)
    throw new CloudStorageError(
      "Khóa đọc ảnh cloud không hợp lệ. Hãy khôi phục khóa từ bản sao lưu.",
    );
  return key;
}
const marker = Buffer.from("IAPA1");
export function encryptMedia(bytes: Buffer, key: Buffer) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([marker, nonce, encrypted, cipher.getAuthTag()]);
}
export function decryptMedia(bytes: Buffer, key: Buffer) {
  if (bytes.length < 33 || !bytes.subarray(0, 5).equals(marker))
    throw new CloudStorageError("Tệp cloud không phải ảnh của shop.");
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(5, 17));
  decipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([
    decipher.update(bytes.subarray(17, -16)),
    decipher.final(),
  ]);
}
function client(config: CloudConfig) {
  return new UTApi({ token: config.token, logLevel: "None" });
}
export function createUploadThingAdapter(directory: string): CloudAdapter {
  return {
    async verify(config) {
      try {
        await client(config).listFiles({ limit: 1 });
      } catch {
        throw new CloudStorageError(
          "Không kết nối được UploadThing. Kiểm tra token và kết nối mạng.",
        );
      }
    },
    async upload(bytes, id, config) {
      try {
        const encrypted = encryptMedia(bytes, encryptionKey(directory));
        const file = new UTFile([Uint8Array.from(encrypted)], `${id}.utenc`, {
          type: "application/octet-stream",
          customId: id,
        });
        const result = await client(config).uploadFiles(file);
        if (result.error || !result.data?.key) throw new Error();
        return result.data.key;
      } catch {
        throw new CloudStorageError(
          "Không tải được ảnh lên UploadThing. Kiểm tra kết nối và hạn mức lưu trữ, rồi thử lại.",
        );
      }
    },
    async download(fileKey, config) {
      try {
        const { ufsUrl } = await client(config).generateSignedURL(fileKey, {
          expiresIn: 60,
        });
        const url = new URL(ufsUrl);
        if (url.protocol !== "https:" || !url.hostname.endsWith(".ufs.sh"))
          throw new Error();
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        });
        if (!response.ok) throw new Error();
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length > 10 * 1024 * 1024 + 64) throw new Error();
        return decryptMedia(bytes, encryptionKey(directory));
      } catch {
        throw new CloudStorageError("Không đọc được ảnh từ UploadThing.");
      }
    },
  };
}
export function loadCloudConfig(directory: string): CloudConfig | null {
  if (process.env.UPLOADTHING_TOKEN)
    return cloudConfigSchema.parse({ token: process.env.UPLOADTHING_TOKEN });
  const file = path.join(directory, "uploadthing.json");
  if (!existsSync(file)) return null;
  return cloudConfigSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}
export function saveCloudConfig(directory: string, config: CloudConfig) {
  if (process.env.UPLOADTHING_TOKEN)
    throw new CloudStorageError(
      "Token đang được quản lý bằng biến môi trường. Hãy cập nhật cấu hình máy chủ.",
    );
  const temporary = path.join(directory, `uploadthing-${randomUUID()}.tmp`);
  writeFileSync(temporary, JSON.stringify(config), { mode: 0o600 });
  renameSync(temporary, path.join(directory, "uploadthing.json"));
}
