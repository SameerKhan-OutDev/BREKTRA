import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
const archive = resolve('release/BREKTRA-Server.tar.gz');
const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(name => !name.endsWith('/'));
const allowed = new Set(['server.mjs', 'VERSION.txt', 'README.md', 'ABOUT_BREKTRA.md', 'CHANGELOG.md', 'Dockerfile', 'hosted.env.example', 'THIRD-PARTY-NOTICES.txt', 'dist/index.html',
  ...['WORKING_NOTES.md','BACKEND_IMPLEMENTATION_PLAN.md','IMPLEMENTATION_STATUS.md','PERSISTENCE.md','OUTREACH_EXPANSION_PLAN.md','HOSTED_SETUP.md','UPDATE_0.3.0_IMPLEMENTATION_PLAN.md','COMPANY_MIGRATION.md', 'LOCAL_SETUP.md'].map(name => `docs/${name}`)]);
for (const entry of entries) {
  assert.ok(entry.startsWith('BREKTRA-Server/'), `Unexpected root: ${entry}`);
  const path = entry.slice('BREKTRA-Server/'.length);
  assert.ok(allowed.has(path) || /^dist\/assets\/[A-Za-z0-9_-]+\.(js|css)$/.test(path), `Non-allowlisted file: ${entry}`);
}
for (const path of allowed) assert.ok(entries.includes(`BREKTRA-Server/${path}`), `Missing ${path}`);
const directory = await mkdtemp(join(tmpdir(), 'BREKTRA-Server-Verify-'));
execFileSync('tar', ['-xzf', archive, '-C', directory]);
const appRoot = join(directory, 'BREKTRA-Server');
const probe = createServer();
await new Promise((resolve,reject) => {probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const environment = {...process.env,PORT:String(port),STORAGE_MODE:'demo',BREKTRA_USE_ENV:'0',BREKTRA_HOSTED:'0',BREKTRA_AUTH:'0',OLLAMA_URL:'http://127.0.0.1:1'};
const child = spawn(process.execPath,['server.mjs','--production'],{cwd:appRoot,env:environment,stdio:'pipe',windowsHide:true});
let output='';child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
const url=`http://127.0.0.1:${port}`;
try {
  let ready=false;
  for(let i=0;i<150;i++){
    try{const response=await fetch(`${url}/api/health`);const health=await response.json();if(response.ok&&health.pid===child.pid){ready=true;break;}}catch{}
    if(child.exitCode!==null)break;await delay(100);
  }
  assert.ok(ready,output || 'Server bundle did not start');
  const expectedVersion = JSON.parse(await readFile(resolve('package.json'), 'utf8')).version;
  assert.equal((await (await fetch(`${url}/api/health`)).json()).version, expectedVersion);
  assert.equal((await readFile(join(appRoot, 'VERSION.txt'), 'utf8')).trim(), expectedVersion);
  for (const name of ['README.md', 'ABOUT_BREKTRA.md', 'CHANGELOG.md']) assert.deepEqual(await readFile(join(appRoot,name)), await readFile(resolve(name)));
  const workspace=await (await fetch(`${url}/api/workspace`)).json();
  assert.equal(workspace.health.mode,'demo');assert.equal(workspace.auth.required,false);
  assert.equal(workspace.state.outreachActions.length,0);assert.equal(workspace.state.members.length,0);
  assert.equal(workspace.state.mailboxes[0].sendingEnabled,false);
  assert.equal(workspace.state.companies.length,0); assert.equal(workspace.state.companyMigrations.length,0);
  assert.equal(workspace.state.conversations[0].simulated,true);
  const setup=await (await fetch(`${url}/api/setup`)).json();
  assert.equal(setup.local,true);assert.equal(setup.connected,false);assert.ok(!JSON.stringify(setup).includes('private_key'));
  const html=await (await fetch(url)).text();assert.match(html,/BREKTRA/);
  for(const match of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) assert.equal((await fetch(`${url}${match[1]}`)).status,200);
  for(const name of [...allowed].filter(name=>name.startsWith('docs/')))assert.deepEqual(await readFile(join(appRoot,name)),await readFile(resolve(name)));
  const preview=await (await fetch(`${url}/api/settings/company-migration`)).json();
  const prepare=await fetch(`${url}/api/settings/company-migration`,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name:'Server verification company',fingerprint:preview.fingerprint,backupConfirmed:true})});
  assert.equal(prepare.status,200);
  const migrated=await (await fetch(`${url}/api/workspace`)).json();
  assert.equal(migrated.state.companies.length,1); assert.equal(migrated.state.companyMigrations.length,1);
  assert.ok(migrated.state.leads.every(lead=>lead.companyId===migrated.state.companies[0].id));
  assert.ok(migrated.state.mailboxes.every(mailbox=>!mailbox.sendingEnabled));
}finally{
  child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});
}
const invalid = spawn(process.execPath,['server.mjs','--production'],{cwd:appRoot,env:{...environment,BREKTRA_HOSTED:'1',BREKTRA_PUBLIC_ORIGIN:'https://workspace.example.invalid',BREKTRA_SECRET_KEY:randomBytes(32).toString('base64')},stdio:'pipe',windowsHide:true});
let failure='';invalid.stderr.on('data',chunk=>{failure+=chunk;});invalid.stdout.resume();
const timer=setTimeout(()=>invalid.kill(),10000);
const code=await new Promise(resolve=>invalid.once('exit',resolve));clearTimeout(timer);
assert.notEqual(code,0);assert.match(failure,/Hosted workspaces require persistent Sheets mode/);
console.log(JSON.stringify({archive,sha256:createHash('sha256').update(await readFile(archive)).digest('hex'),extraction:appRoot,
  allowlistedFiles:entries.length,checks:'bundle startup, release version, health, clean demo workspace, frontend/assets, document hashes, bundled company preview/apply, authenticated-hosted prerequisites fail closed, private-file allowlist; no external deployment claimed'},null,2));
