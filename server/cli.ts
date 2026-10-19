import path from "node:path";
import { createInterface, emitKeypressEvents } from "node:readline";
import { stdin, stdout } from "node:process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomUUID, randomBytes } from "node:crypto";
import Database from "better-sqlite3";
import { openDatabase, hashPassword, products } from "./db.js";
import { assertStopped } from "./lock.js";

const directory = path.resolve(process.env.DATA_DIR || "data");
function question(prompt: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  return new Promise((resolve) =>
    rl.question(prompt, (v) => {
      rl.close();
      resolve(v.trim());
    }),
  );
}
async function password(prompt: string): Promise<string> {
  if (!stdin.isTTY)
    throw new Error(
      "Hãy chạy trong terminal tương tác để nhập mật khẩu được che.",
    );
  stdout.write(prompt);
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const handler = (text: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.name === "return") {
        stdin.off("keypress", handler);
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write("\n");
        resolve(value);
      } else if (key.ctrl && key.name === "c") {
        stdin.off("keypress", handler);
        stdin.setRawMode(false);
        stdin.pause();
        reject(new Error("Đã hủy."));
      } else if (key.name === "backspace") {
        value = value.slice(0, -1);
        stdout.write("\b \b");
      } else if (text && !key.ctrl && key.name !== "escape") {
        value += text;
        stdout.write("*");
      }
    };
    stdin.on("keypress", handler);
  });
}
function digest(file: string) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}
export function backupData(dir: string, root = path.resolve("backups")) {
  assertStopped(dir);
  if (!existsSync(path.join(dir, "shop.sqlite")))
    throw new Error("Chưa có dữ liệu để sao lưu.");
  const dest = path.join(
    root,
    `iapa-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 6)}`,
  );
  mkdirSync(dest, { recursive: true });
  const db = new Database(path.join(dir, "shop.sqlite"));
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
  } finally {
    db.close();
  }
  cpSync(path.join(dir, "shop.sqlite"), path.join(dest, "shop.sqlite"));
  cpSync(path.join(dir, "uploads"), path.join(dest, "uploads"), {
    recursive: true,
  });
  const hashes: Record<string, string> = {
    "shop.sqlite": digest(path.join(dest, "shop.sqlite")),
  };
  for (const file of readdirSync(path.join(dest, "uploads")))
    hashes[`uploads/${file}`] = digest(path.join(dest, "uploads", file));
  writeFileSync(
    path.join(dest, "manifest.json"),
    JSON.stringify(
      { version: 1, createdAt: new Date().toISOString(), hashes },
      null,
      2,
    ),
  );
  return dest;
}
export function restoreData(dir: string, source: string) {
  assertStopped(dir);
  source = path.resolve(source);
  dir = path.resolve(dir);
  if (source === dir || source.startsWith(dir + path.sep))
    throw new Error("Bản sao lưu phải nằm ngoài thư mục dữ liệu đang dùng.");
  const manifest = JSON.parse(
    readFileSync(path.join(source, "manifest.json"), "utf8"),
  ) as { version: number; hashes: Record<string, string> };
  if (manifest.version !== 1 || !manifest.hashes["shop.sqlite"])
    throw new Error("Bản sao lưu không hợp lệ.");
  for (const [file, hash] of Object.entries(manifest.hashes)) {
    if (file !== "shop.sqlite" && !/^uploads\/[a-f0-9-]+\.webp$/.test(file))
      throw new Error("Đường dẫn trong bản sao lưu không hợp lệ.");
    if (digest(path.join(source, file)) !== hash)
      throw new Error("Bản sao lưu bị thay đổi hoặc thiếu tệp: " + file);
  }
  const checked = new Database(path.join(source, "shop.sqlite"), {
    readonly: true,
  });
  try {
    if (checked.pragma("integrity_check", { simple: true }) !== "ok")
      throw new Error("Database sao lưu bị lỗi.");
    const rows = checked.prepare("SELECT filename FROM media").all() as {
      filename: string;
    }[];
    for (const row of rows)
      if (!manifest.hashes[`uploads/${row.filename}`])
        throw new Error("Thiếu ảnh trong bản sao lưu.");
    products(checked);
  } finally {
    checked.close();
  }
  const staging = dir + ".restore-" + randomUUID();
  mkdirSync(staging, { recursive: true });
  cpSync(path.join(source, "shop.sqlite"), path.join(staging, "shop.sqlite"));
  cpSync(path.join(source, "uploads"), path.join(staging, "uploads"), {
    recursive: true,
  });
  const clean = new Database(path.join(staging, "shop.sqlite"));
  clean.prepare("DELETE FROM sessions").run();
  clean.close();
  const previous = dir + ".before-restore-" + Date.now();
  if (existsSync(dir)) renameSync(dir, previous);
  try {
    renameSync(staging, dir);
  } catch (e) {
    if (existsSync(previous)) renameSync(previous, dir);
    throw e;
  }
  return previous;
}
async function run() {
  const command = process.argv[2];
  if (command === "backup") {
    console.log("Đã sao lưu: " + backupData(directory));
    return;
  }
  if (command === "restore") {
    if (!process.argv[3])
      throw new Error('Dùng: npm run restore -- "đường-dẫn-bản-sao-lưu"');
    console.log(
      "Đã khôi phục. Dữ liệu trước đó được giữ tại: " +
        restoreData(directory, process.argv[3]),
    );
    return;
  }
  assertStopped(directory);
  const db = openDatabase(directory);
  try {
    const old = db.prepare("SELECT username FROM admin WHERE id=1").get() as
      { username: string } | undefined;
    if (command === "setup" && old)
      throw new Error(
        "Đã có tài khoản. Dùng npm run admin:password để đổi mật khẩu.",
      );
    if (command === "password" && !old)
      throw new Error("Chưa có tài khoản. Dùng npm run admin:setup.");
    if (!["setup", "password"].includes(command))
      throw new Error("Lệnh không hợp lệ.");
    const generated =
      command === "setup" && process.argv.includes("--generate");
    const username =
      old?.username ||
      (generated ? "hanghang" : await question("Tên đăng nhập chủ shop: "));
    if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username))
      throw new Error(
        "Tên đăng nhập từ 3–40 ký tự, gồm chữ không dấu, số, dấu chấm/gạch.",
      );
    const first = generated
      ? randomBytes(24).toString("base64url")
      : await password("Mật khẩu mới (ít nhất 12 ký tự): ");
    const second = generated ? first : await password("Nhập lại mật khẩu: ");
    if (first.length < 12 || first.length > 200 || first !== second)
      throw new Error(
        "Mật khẩu cần 12–200 ký tự và hai lần nhập phải giống nhau.",
      );
    db.prepare("INSERT OR REPLACE INTO admin VALUES(1,?,?)").run(
      username,
      hashPassword(first),
    );
    db.prepare("DELETE FROM sessions").run();
    const accessFile = path.join(directory, "owner-access.txt");
    if (generated)
      writeFileSync(
        accessFile,
        `Hoa Tươi Ia Pa - tài khoản quản trị local\nĐịa chỉ: http://localhost:4317/admin\nTên đăng nhập: ${username}\nMật khẩu: ${first}\nĐổi mật khẩu: dừng website rồi chạy npm run admin:password\n`,
        { mode: 0o600, flag: "wx" },
      );
    else if (existsSync(accessFile))
      writeFileSync(
        accessFile,
        "Mật khẩu đã được đổi. Dùng mật khẩu chủ shop vừa thiết lập.\n",
        { mode: 0o600 },
      );
    console.log(
      generated
        ? "Đã tạo tài khoản ngẫu nhiên. Xem thông tin trong data/owner-access.txt."
        : "Đã lưu tài khoản chủ shop và thu hồi các phiên cũ.",
    );
  } finally {
    db.close();
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve("server/cli.ts")
)
  run().catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  });
