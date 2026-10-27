import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

export interface Secrets {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}
async function protect(data: Buffer, decrypt: boolean): Promise<Buffer> {
  const operation = decrypt ? "Unprotect" : "Protect";
  const script = `Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::${operation}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))`;
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    const timeout = setTimeout(() => { child.kill(); reject(new Error("Private storage protection timed out.")); }, 15000);
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.resume(); // Never expose crypto input or host diagnostics to HTTP clients/logs.
    child.once("error", () => { clearTimeout(timeout); reject(new Error("Windows private storage is unavailable.")); });
    child.once("exit", (code) => { clearTimeout(timeout); code === 0 ? resolve(Buffer.from(output.trim(), "base64")) : reject(new Error("Unable to unlock private storage for this Windows user.")); });
    child.stdin.end(data.toString("base64"));
  });
}
export class PrivateStore implements Secrets {
  private data: Record<string, unknown> = {};
  private loaded?: Promise<void>;
  private tail: Promise<unknown> = Promise.resolve();
  private key!: Buffer;
  constructor(private directory: string, private configuredKey = process.env.BREKTRA_SECRET_KEY || "") {}
  private async load() {
    if (this.loaded) return this.loaded;
    this.loaded = (async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      if (this.configuredKey) {
        this.key = Buffer.from(this.configuredKey, "base64");
        if (this.key.length !== 32) throw new Error("BREKTRA_SECRET_KEY must encode exactly 32 random bytes as base64.");
      } else {
        if (process.platform !== "win32") throw new Error("Set BREKTRA_SECRET_KEY for protected server credentials.");
        const keyFile = join(this.directory, "private-key.dpapi");
        try { this.key = await protect(await readFile(keyFile), true); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          this.key = randomBytes(32);
          await writeFile(keyFile, await protect(this.key, false), { flag: "wx", mode: 0o600 });
        }
      }
      try {
        const stored = JSON.parse(await readFile(join(this.directory, "private.enc"), "utf8"));
        const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(stored.iv, "base64"));
        decipher.setAuthTag(Buffer.from(stored.tag, "base64"));
        this.data = JSON.parse(Buffer.concat([decipher.update(Buffer.from(stored.data, "base64")), decipher.final()]).toString("utf8"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Private storage cannot be decrypted. Restore its original key/Windows user; it has not been overwritten.");
      }
    })();
    return this.loaded;
  }
  async get<T>(key: string): Promise<T | undefined> { await this.load(); await this.tail; return structuredClone(this.data[key]) as T | undefined; }
  async set(key: string, value: unknown) {
    await this.load();
    const operation = this.tail.then(async () => {
      const candidate = { ...this.data };
      if (value === undefined) delete candidate[key]; else candidate[key] = structuredClone(value);
      const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", this.key, iv);
      const data = Buffer.concat([cipher.update(JSON.stringify(candidate)), cipher.final()]);
      const path = join(this.directory, "private.enc"), temporary = `${path}.${randomBytes(8).toString("hex")}.tmp`;
      await writeFile(temporary, JSON.stringify({ iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") }), { mode: 0o600, flag: "wx" });
      await rename(temporary, path);
      this.data = candidate;
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
}
