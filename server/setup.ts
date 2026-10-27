import { Router } from "express";
import { z } from "zod";
import { randomBytes, createPrivateKey } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import type { Secrets } from "./private-store.ts";
import type { Store } from "./store.ts";
import type { TeamAuth } from "./team.ts";
import { Sheets, type ServiceAccountCredentials } from "./sheets.ts";
import { aiHealth, ollamaOrigin } from "./ai.ts";
import { companyFingerprint } from "./company.ts";
import { downloadableModels, type ModelDownload, type SetupStatus } from "../shared/setup.ts";

const credentialsSchema = z.object({ type: z.literal("service_account"), client_email: z.email().max(320), private_key: z.string().min(100).max(16000) });
const modelName = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*(?::[a-zA-Z0-9][a-zA-Z0-9._-]*)?$/).max(100);
const configurationSchema = z.object({ version: z.literal(1), model: modelName.optional(),
  sheets: z.object({ spreadsheetId: z.string().regex(/^[a-zA-Z0-9_-]{8,200}$/), credentials: credentialsSchema }).strict().optional() }).strict();
export type LocalConfiguration = z.infer<typeof configurationSchema>;

export function spreadsheetId(value: string) {
  const input = value.trim();
  if (/^[a-zA-Z0-9_-]{8,200}$/.test(input)) return input;
  try {
    const url = new URL(input), match = /^\/spreadsheets\/d\/([a-zA-Z0-9_-]{8,200})(?:\/|$)/.exec(url.pathname);
    if (url.origin === "https://docs.google.com" && !url.username && !url.password && match) return match[1];
  } catch {}
  throw new Error("Paste a Google Sheets spreadsheet URL or its spreadsheet ID.");
}
export function parseServiceAccount(value: string): ServiceAccountCredentials {
  try {
    const result = credentialsSchema.parse(JSON.parse(value));
    const key = createPrivateKey(result.private_key);
    if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength || 0) < 2048) throw new Error();
    return result;
  } catch { throw new Error("Choose a valid Google service-account JSON key file. Its private contents are never shown or logged."); }
}
export class SetupConfiguration {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private secrets: Secrets, private value: LocalConfiguration = { version: 1 }) {}
  static async load(secrets: Secrets, directory: string) {
    const stored = existsSync(join(directory, "private.enc")) ? await secrets.get<unknown>("setup.configuration") : undefined;
    return new SetupConfiguration(secrets, stored === undefined ? { version: 1 } : configurationSchema.parse(stored));
  }
  snapshot() { return structuredClone(this.value); }
  async update(patch: Partial<Omit<LocalConfiguration, "version">>) {
    const work = this.tail.then(async () => {
      const candidate = configurationSchema.parse({ ...this.value, ...patch });
      await this.secrets.set("setup.configuration", candidate);
      this.value = candidate;
    });
    this.tail = work.catch(() => {}); await work;
  }
}

// Launch only a known installed executable, never a browser-provided command.
export async function startInstalledOllama() {
  if ((await aiHealth()).connected) return;
  if (process.platform !== "win32") throw new Error("Start Ollama on this server, then use Check connection.");
  const candidates = [
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Programs", "Ollama", "ollama.exe"),
    process.env.ProgramFiles && join(process.env.ProgramFiles, "Ollama", "ollama.exe"),
  ];
  const executable = candidates.find((p): p is string => !!p && existsSync(p));
  if (!executable) throw new Error("Install Ollama using the official download button, then try Start Ollama again.");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, ["serve"], { windowsHide: true, stdio: "ignore",
      env: { ...process.env, OLLAMA_HOST: new URL(ollamaOrigin()).host } });
    child.once("error", () => reject(new Error("Ollama could not start. Open the installed Ollama app and try again.")));
    child.once("spawn", () => { child.unref(); resolve(); });
  });
  const until = Date.now() + 12000;
  while (Date.now() < until) { if ((await aiHealth()).connected) return; await delay(250); }
  throw new Error("Ollama is still starting. Use Check connection in a moment.");
}

interface SetupDependencies {
  configuration: SetupConfiguration; store: Store; auth: TeamAuth; local: boolean;
  connect: (adapter: Sheets, source: string, target: string, configuration: LocalConfiguration["sheets"]) => Promise<void>;
  refreshAI: () => Promise<void>;
  startOllama?: () => Promise<void>;
  now?: () => number;
}
export function setupApi(deps: SetupDependencies) {
  const router = Router();
  let pending: { token: string; until: number; adapter: Sheets; connection: NonNullable<LocalConfiguration["sheets"]>; source: string; target: string } | undefined;
  let pendingExpiry: ReturnType<typeof setTimeout> | undefined;
  const clock = deps.now || Date.now;
  let checking = false, starting = false;
  let download: ModelDownload | undefined, abort: AbortController | undefined;
  const downloading = () => download?.status === "downloading";
  const local = () => { if (!deps.local) throw new Error("This shared server uses operator-managed configuration. Use the hosted setup guide."); };
  router.use("/setup", (req, _res, next) => { try { deps.auth.require(req, "manage"); next(); } catch (e) { next(e); } });
  router.get("/setup", async (_req, res) => {
    const config = deps.configuration.snapshot();
    const status: SetupStatus = { local: deps.local, connected: !!deps.store.sheets,
      spreadsheetId: deps.store.sheets?.controlId || "", serviceEmail: config.sheets?.credentials.client_email || "",
      ai: await aiHealth(), download };
    res.json(status);
  });
  router.post("/setup/sheets/check", async (req, res) => {
    local();
    if (deps.store.sheets) throw new Error("A real workspace is already configured. Use Reconnect & sync to check it.");
    if (checking) throw new Error("A connection check is already running.");
    const input = z.object({ spreadsheet: z.string().max(2000), credentialFile: z.string().max(32000) }).strict().parse(req.body);
    checking = true; pending = undefined; clearTimeout(pendingExpiry);
    try {
      const credentials = parseServiceAccount(input.credentialFile), id = spreadsheetId(input.spreadsheet);
      const adapter = new Sheets(credentials, id), checked = await adapter.inspect();
      const token = randomBytes(24).toString("hex");
      pending = { token, until: clock() + 300000, adapter, connection: { spreadsheetId: id, credentials },
        source: companyFingerprint(deps.store.state), target: companyFingerprint(checked.state) };
      pendingExpiry = setTimeout(() => { if (pending?.token === token) pending = undefined; }, 300000);
      pendingExpiry.unref();
      res.json({ checkId: token, spreadsheetId: id, serviceEmail: credentials.client_email, missingTabs: checked.missingTabs.length,
        counts: { leads: checked.state.leads.length, campaigns: checked.state.campaigns.length, conversations: checked.state.conversations.length } });
    } finally { checking = false; }
  });
  router.post("/setup/sheets/connect", async (req, res) => {
    local();
    const input = z.object({ checkId: z.string().length(48), confirmed: z.literal(true) }).strict().parse(req.body);
    const checked = pending;
    if (!checked || checked.token !== input.checkId || checked.until < clock()) throw new Error("Run Check spreadsheet again before connecting.");
    pending = undefined; clearTimeout(pendingExpiry);
    await deps.connect(checked.adapter, checked.source, checked.target, checked.connection);
    res.json({ ok: true });
  });
  router.post("/setup/ollama/start", async (_req, res) => {
    local(); if (starting) throw new Error("Ollama is already starting."); starting = true;
    try { await (deps.startOllama || startInstalledOllama)(); await deps.refreshAI(); res.json({ ok: true }); }
    finally { starting = false; }
  });
  router.post("/setup/ollama/model", async (req, res) => {
    local(); if (downloading()) throw new Error("Wait for or cancel the model download first.");
    const { model } = z.object({ model: modelName }).strict().parse(req.body);
    if (!(await aiHealth()).models.includes(model)) throw new Error("This model is not installed. Download a supported model first.");
    if (downloading()) throw new Error("Wait for or cancel the model download first.");
    await deps.configuration.update({ model }); process.env.OLLAMA_MODEL = model;
    await deps.refreshAI(); res.json({ ok: true });
  });
  router.post("/setup/ollama/pull", async (req, res) => {
    local(); if (downloading()) throw new Error("A model download is already running.");
    const { model } = z.object({ model: z.enum(downloadableModels) }).strict().parse(req.body);
    if (!(await aiHealth()).connected) throw new Error("Start Ollama before downloading a model.");
    if (downloading()) throw new Error("A model download is already running.");
    const controller = new AbortController(); abort = controller;
    const job: ModelDownload = { model, status: "downloading", detail: "Starting download", completed: 0, total: 0 }; download = job;
    void (async () => {
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        const response = await fetch(`${ollamaOrigin()}/api/pull`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, stream: true }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(1800000)]) });
        if (!response.ok || !response.body) throw new Error();
        let buffer = "", success = false;
        const decoder = new TextDecoder();
        const line = (text: string) => {
          if (!text.trim()) return;
          const event = JSON.parse(text); if (event.error) throw new Error();
          if (event.status === "success") success = true;
          if (typeof event.status === "string") job.detail = event.status.slice(0, 160);
          for (const key of ["completed", "total"] as const) if (typeof event[key] === "number" && Number.isFinite(event[key])) job[key] = Math.max(0, Math.min(event[key], 1e13));
        };
        reader = response.body.getReader();
        while (true) {
          const { value: chunk, done } = await reader.read(); if (done) break;
          buffer += decoder.decode(chunk, { stream: true });
          let end: number;
          while ((end = buffer.indexOf("\n")) >= 0) { if (end > 65536) throw new Error(); line(buffer.slice(0, end)); buffer = buffer.slice(end + 1); }
          if (buffer.length > 65536) throw new Error();
        }
        buffer += decoder.decode(); if (buffer) line(buffer);
        if (!success || controller.signal.aborted || !(await aiHealth()).models.includes(model)) throw new Error();
        await deps.configuration.update({ model }); process.env.OLLAMA_MODEL = model;
        job.status = "completed"; job.detail = "Model ready and selected";
        await deps.refreshAI();
      } catch {
        job.status = controller.signal.aborted ? "cancelled" : "failed";
        job.detail = controller.signal.aborted ? "Download cancelled. You can resume by downloading again." : "Download failed. Check Ollama, available disk space and internet access, then try again.";
      } finally { await reader?.cancel().catch(() => {}); if (abort === controller) abort = undefined; }
    })();
    res.status(202).json({ ok: true });
  });
  router.post("/setup/ollama/cancel", (_req, res) => { local(); abort?.abort(); res.json({ ok: true }); });
  return router;
}
