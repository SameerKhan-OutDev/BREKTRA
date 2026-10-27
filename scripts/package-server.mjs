import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = resolve('.'), parent = join(root, 'tmp', `server-${randomUUID()}`), staging = join(parent, 'BREKTRA-Server');
await mkdir(staging, { recursive: true });
const output = await build({ entryPoints: ['server/index.ts'], outfile: join(staging, 'server.mjs'),
  bundle: true, platform: 'node', target: 'node24', format: 'esm', external: ['vite'], metafile: true,
  banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' } });
await cp(join(root, 'dist'), join(staging, 'dist'), { recursive: true });
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
for (const name of ['README.md', 'ABOUT_BREKTRA.md', 'CHANGELOG.md']) await cp(join(root, name), join(staging, name));
await writeFile(join(staging, 'VERSION.txt'), `${version}\n`);
await mkdir(join(staging, 'docs'));
for (const name of ['WORKING_NOTES.md', 'BACKEND_IMPLEMENTATION_PLAN.md', 'IMPLEMENTATION_STATUS.md', 'PERSISTENCE.md', 'OUTREACH_EXPANSION_PLAN.md', 'HOSTED_SETUP.md', 'UPDATE_0.3.0_IMPLEMENTATION_PLAN.md', 'COMPANY_MIGRATION.md', 'LOCAL_SETUP.md'])
  await cp(join(root, 'docs', name), join(staging, 'docs', name));
await cp(join(root, 'deploy', 'Dockerfile'), join(staging, 'Dockerfile'));
await cp(join(root, 'deploy', 'hosted.env.example'), join(staging, 'hosted.env.example'));
const require = createRequire(import.meta.url), roots = new Set();
for (const input of Object.keys(output.metafile.inputs)) {
  if (!input.includes('node_modules')) continue;
  let directory = dirname(resolve(input));
  while (directory !== dirname(directory)) {
    try { await readFile(join(directory, 'package.json')); roots.add(directory); break; } catch {}
    directory = dirname(directory);
  }
}
for (const name of ['react', 'react-dom', 'lucide-react']) roots.add(dirname(require.resolve(`${name}/package.json`)));
roots.add(dirname(createRequire(require.resolve('react-dom/package.json')).resolve('scheduler/package.json')));
let notices = 'BREKTRA hosted workspace - third-party software notices\nNode runtime is installed separately or supplied by the official Node container image.\n';
for (const directory of [...roots].sort()) {
  const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  notices += `\n${'='.repeat(72)}\n${metadata.name} ${metadata.version} (${metadata.license || 'see license'})\n`;
  for (const file of (await readdir(directory)).filter(name => /^(licen[cs]e|copying|notice)(\.|$|-)/i.test(name)))
    try { notices += `\n${file}\n${await readFile(join(directory, file), 'utf8')}\n`; } catch {}
}
await writeFile(join(staging, 'THIRD-PARTY-NOTICES.txt'), notices);
await mkdir(join(root, 'release'), { recursive: true });
const archive = join(root, 'release', 'BREKTRA-Server.tar.gz');
execFileSync('tar', ['-czf', archive, '-C', parent, basename(staging)], { stdio: 'inherit' });
console.log(`Hosted server bundle: ${archive}\nSetup: docs/HOSTED_SETUP.md\nThis packages the server; it does not provision hosting or authorize Gmail.`);
