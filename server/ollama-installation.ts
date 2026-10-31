import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";

// Resolve installed files only; never execute a shell command or browser input.
export function installedOllama(env: NodeJS.ProcessEnv = process.env, exists = existsSync) {
  const directories = [
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, "Programs", "Ollama"),
    env.ProgramFiles && join(env.ProgramFiles, "Ollama"),
    env.ProgramW6432 && join(env.ProgramW6432, "Ollama"),
    ...(env.PATH || env.Path || "").split(";").map((value) => value.trim().replace(/^"(.*)"$/, "$1")),
  ];
  return directories.filter((value): value is string => !!value && isAbsolute(value))
    .map((directory) => join(directory, "ollama.exe")).find((file) => exists(file));
}
