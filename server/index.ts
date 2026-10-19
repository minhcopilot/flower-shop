import { createApp } from "./app.js";
import path from "node:path";
import { claimLock } from "./lock.js";
const directory = path.resolve(process.env.DATA_DIR || "data");
const release = claimLock(directory);
const { app, db } = createApp(directory);
const port = Number(process.env.PORT || 4317);
const server = app.listen(port, "127.0.0.1", () =>
  console.log(`Hoa Tươi Ia Pa: http://localhost:${port}`),
);
function shutdown() {
  server.close(() => {
    db.close();
    release();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", release);
server.on("error", (err) => {
  console.error(err.message);
  db.close();
  release();
  process.exit(1);
});
