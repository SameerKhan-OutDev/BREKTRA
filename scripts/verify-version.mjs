import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'Use MAJOR.UPDATE.PATCH');
const docs = ['README.md', 'ABOUT_BREKTRA.md', 'CHANGELOG.md', ...(await readdir(new URL('../docs/', import.meta.url))).filter(name => name.endsWith('.md')).map(name => `docs/${name}`)];
for (const name of docs) {
  const text = await readFile(new URL(`../${name}`, import.meta.url), 'utf8');
  assert.ok(text.includes(`Current release: **${version}**`), `${name}: current release must match package.json (${version})`);
}
console.log(`BREKTRA ${version}: release labels match across ${docs.length} documents.`);
