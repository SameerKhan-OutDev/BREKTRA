import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Build this portable package using a Windows x64 Node runtime.');
const root = resolve('.');
const stagingParent = join(root, 'tmp', `portable-${randomUUID()}`);
const staging = join(stagingParent, 'BREKTRA');
const destination = join(root, 'release', 'BREKTRA-Windows-x64');
const archive = join(root, 'release', 'BREKTRA-Windows-x64.zip');
await mkdir(join(staging, 'runtime'), { recursive: true });
const output = await build({
  entryPoints: ['server/index.ts'], outfile: join(staging, 'server.mjs'), bundle: true,
  platform: 'node', target: 'node24', format: 'esm', external: ['vite'], metafile: true,
  banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
});
await cp(join(root, 'dist'), join(staging, 'dist'), { recursive: true });
await mkdir(join(staging, 'docs'), { recursive: true });
for (const name of ['WORKING_NOTES.md', 'BACKEND_IMPLEMENTATION_PLAN.md', 'IMPLEMENTATION_STATUS.md', 'PERSISTENCE.md'])
  await cp(join(root, 'docs', name), join(staging, 'docs', name));
await cp(process.execPath, join(staging, 'runtime', 'node.exe'));
for (const name of await readdir(join(root, 'scripts', 'portable'))) await cp(join(root, 'scripts', 'portable', name), join(staging, name));
await cp(join(root, '.env.example'), join(staging, '.env.example'));
const runtimeLicense = await fetch(`https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`, { signal: AbortSignal.timeout(20000) });
if (!runtimeLicense.ok) throw new Error(`Could not retrieve the Node ${process.version} license.`);
await writeFile(join(staging, 'runtime', 'LICENSE.txt'), await runtimeLicense.text());
const require = createRequire(import.meta.url);
const packageRoots = new Set();
for (const input of Object.keys(output.metafile.inputs)) {
  if (!input.includes('node_modules')) continue;
  let directory = dirname(resolve(input));
  while (directory !== dirname(directory)) {
    try { await readFile(join(directory, 'package.json')); packageRoots.add(directory); break; } catch {}
    directory = dirname(directory);
  }
}
for (const name of ['react', 'react-dom', 'lucide-react']) packageRoots.add(dirname(require.resolve(`${name}/package.json`)));
packageRoots.add(dirname(createRequire(require.resolve('react-dom/package.json')).resolve('scheduler/package.json')));
let notices = 'BREKTRA third-party software notices\nBundled Node runtime license: runtime/LICENSE.txt\n\n';
for (const directory of [...packageRoots].sort()) {
  const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  notices += `\n${'='.repeat(72)}\n${metadata.name} ${metadata.version} (${metadata.license || 'see accompanying license'})\n`;
  for (const file of (await readdir(directory)).filter(name => /^(licen[cs]e|copying|notice)(\.|$|-)/i.test(name))) {
    try { notices += `\n${file}\n${await readFile(join(directory, file), 'utf8')}\n`; } catch {}
  }
}
await writeFile(join(staging, 'THIRD-PARTY-NOTICES.txt'), notices);
await writeFile(join(staging, 'READ ME FIRST.txt'), `BREKTRA - Windows 10/11, 64-bit\r\n\r\n1. Extract the entire ZIP. Do not run it inside the ZIP.\r\n2. Open the BREKTRA folder.\r\n3. Double-click START BREKTRA. Your browser opens automatically.\r\n4. When finished, double-click STOP BREKTRA.\r\n\r\nNo Node.js installation or terminal commands are needed.\r\nKeep the runtime and dist folders beside the launcher.\r\nKeep your computer awake while campaigns run.\r\n\r\nThis version starts with DEMO DATA. No LinkedIn requests or messages are sent.\r\nDemo changes reset when you stop and restart the app.\r\nEach computer has its own local demo. Shared live operation is not set up.\r\nGoogle Sheets and local AI need separate setup through Settings.\r\nIf you later use the same control spreadsheet on two computers, run only one app at a time.\r\n\r\nShare the original BREKTRA-Windows-x64.zip, not a folder containing your .env, credentials, or logs.\r\nBuilt with Node ${process.version}.\r\n`);
await mkdir(dirname(archive), { recursive: true });
// Archive only the fresh allowlisted staging tree, never a user's configured copy.
execFileSync('tar.exe', ['-a', '-cf', archive, '-C', stagingParent, basename(staging)], { stdio: 'inherit' });
// Windows locks a running node.exe. Reuse it only when its bytes match this build.
// This keeps a running configured copy intact; the ZIP always uses fresh staging.
const stagedRuntime = join(staging, 'runtime', 'node.exe');
const installedRuntime = join(destination, 'runtime', 'node.exe');
let reuseRuntime = false;
try {
  reuseRuntime = (await readFile(stagedRuntime)).equals(await readFile(installedRuntime));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await cp(staging, destination, {
  recursive: true,
  filter: source => !(reuseRuntime && source === stagedRuntime),
});
console.log(`Portable folder: ${destination}\nShare this ZIP: ${archive}`);
