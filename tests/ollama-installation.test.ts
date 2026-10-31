import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { installedOllama } from "../server/ollama-installation.ts";

test("Ollama discovery supports standard and custom PATH installs without searching relative directories", () => {
  const standard = join("C:/Users/Test/AppData/Local", "Programs", "Ollama", "ollama.exe");
  assert.equal(installedOllama({ LOCALAPPDATA: "C:/Users/Test/AppData/Local" }, (file) => file === standard), standard);
  const custom = join("D:/Local AI", "ollama.exe");
  assert.equal(installedOllama({ PATH: ';relative;"D:/Local AI"' }, (file) => file === custom), custom);
  assert.equal(installedOllama({ PATH: ".;relative;;" }, () => true), undefined);
  assert.equal(installedOllama({ ProgramFiles: "C:/Program Files" }, () => false), undefined);
});
