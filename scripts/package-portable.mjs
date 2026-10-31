import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, writeFile, unlink } from 'node:fs/promises';
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
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
for (const name of ['README.md', 'ABOUT_BREKTRA.md', 'CHANGELOG.md']) await cp(join(root, name), join(staging, name));
await writeFile(join(staging, 'VERSION.txt'), `${version}\n`);
await mkdir(join(staging, 'docs'), { recursive: true });
for (const name of ['WORKING_NOTES.md', 'BACKEND_IMPLEMENTATION_PLAN.md', 'IMPLEMENTATION_STATUS.md', 'PERSISTENCE.md', 'OUTREACH_EXPANSION_PLAN.md', 'HOSTED_SETUP.md', 'UPDATE_0.3.0_IMPLEMENTATION_PLAN.md', 'COMPANY_MIGRATION.md', 'LOCAL_SETUP.md'])
  await cp(join(root, 'docs', name), join(staging, 'docs', name));
await cp(process.execPath, join(staging, 'runtime', 'node.exe'));
for (const name of await readdir(join(root, 'scripts', 'portable'))) await cp(join(root, 'scripts', 'portable', name), join(staging, name));
execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts', 'build-setup.ps1'), '-Destination', join(staging, 'Setup_BREKTRA.exe')], { stdio: 'inherit' });
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
await writeFile(join(staging, 'READ ME FIRST.txt'), `BREKTRA ${version} - Windows 10/11, 64-bit\r\n\r\n1. Extract the entire ZIP. Do not run it inside the ZIP.\r\n2. Open the BREKTRA folder.\r\n3. Double-click Setup_BREKTRA.exe for the guided first-run setup.\r\n4. Follow Next through checks, local AI, account and Google Sheets setup.\r\n5. Launch BREKTRA at the last step. Use START BREKTRA for later launches.\r\n6. When finished, double-click STOP BREKTRA.\r\n\r\nNo Node.js installation or terminal commands are needed.\r\nKeep the runtime and dist folders beside the launcher.\r\nKeep your computer awake while campaigns run.\r\n\r\nThis version starts with DEMO DATA. No LinkedIn requests or messages are sent.\r\nDemo changes reset when you stop and restart the app.\r\nPhones and other devices on your trusted LAN share this running workspace.\r\nOpen Settings > Access from other devices for the address.\r\nThe default port stays 4310. Stop older BREKTRA copies before a fresh launch.\r\nA port conflict is reported instead of silently opening a different address.\r\nTeam invitations use LAN links automatically; choose the right network if offered.\r\nReserve this PC IP in your router for a lasting LAN bookmark.\r\nRun ALLOW LAN ACCESS and approve Windows administrator access if needed.\r\nCreate the administrator on this PC, then sign in. LAN browsers must sign in.\r\nNew registrations need administrator approval in Team.\r\nTeam supports profiles and private teammate messages.\r\nRegistrations are remembered in this installation; demo messages reset on restart.\r\nUse trusted networks only.\r\nSet BREKTRA_LAN=0 in .env and restart to disable LAN sharing.\r\nSetup can install Ollama/download a model and connect Sheets.\r\nGoogle permissions and LinkedIn/Gmail approvals require your actions.\r\nDeferring Sheets leaves demo data; finish it later in Settings.\r\nIf you later use the same control spreadsheet on two computers, run only one app at a time.\r\n\r\nShare the original BREKTRA-Windows-x64.zip, not a folder containing your .env, credentials, or logs.\r\nBuilt with Node ${process.version}.\r\n`);
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
// Keep the installed frontend aligned with the clean ZIP. Do not accumulate
// old hashed bundles, and never touch the configured copy's private runtime.
const currentAssets = new Set(await readdir(join(staging, 'dist', 'assets')));
for (const name of await readdir(join(destination, 'dist', 'assets'))) {
  if (/^index-[A-Za-z0-9_-]+\.(js|css)$/.test(name) && !currentAssets.has(name))
    await unlink(join(destination, 'dist', 'assets', name));
}
console.log(`Portable folder: ${destination}\nShare this ZIP: ${archive}`);
