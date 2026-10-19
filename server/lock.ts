import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
export function assertStopped(dir: string) {
  const file = path.join(dir, "server.lock");
  if (existsSync(file)) {
    const pid = Number(readFileSync(file, "utf8"));
    let alive = false;
    try {
      process.kill(pid, 0);
      alive = true;
    } catch {
      /* Stale lock. */
    }
    if (alive)
      throw new Error("Hãy dừng website (Ctrl+C) trước khi chạy lệnh dữ liệu.");
    unlinkSync(file);
  }
}
export function claimLock(dir: string) {
  mkdirSync(dir, { recursive: true });
  assertStopped(dir);
  const file = path.join(dir, "server.lock");
  writeFileSync(file, String(process.pid), { flag: "wx" });
  return () => {
    if (existsSync(file) && readFileSync(file, "utf8") === String(process.pid))
      unlinkSync(file);
  };
}
