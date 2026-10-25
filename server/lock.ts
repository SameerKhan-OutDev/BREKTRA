import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

// OS-owned sockets disappear on process exit; stale PID files never grant ownership.
export async function acquireLock(identity: string): Promise<() => Promise<void>> {
  const digest = createHash("sha256").update(identity).digest("hex");
  const address = process.platform === "win32"
    ? `\\\\.\\pipe\\BREKTRA-${digest}`
    : join(tmpdir(), `brektra-${digest}.sock`);
  const server = createServer((socket) => socket.destroy());
  await new Promise<void>((resolve, reject) => {
    server.once("error", () => reject(new Error("Another BREKTRA process controls this workspace or control spreadsheet. Stop that copy before starting this one.")));
    server.listen(address, resolve);
  });
  return () => new Promise<void>((resolve) => server.close(() => resolve()));
}
