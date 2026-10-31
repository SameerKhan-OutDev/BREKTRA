import {createServer} from 'node:http';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
const parent=await mkdtemp(join(tmpdir(),'BREKTRA-Setup-Verify-'));
execFileSync('tar.exe',['-xf',resolve('release/BREKTRA-Windows-x64.zip'),'-C',parent]);
let models=[], pulls=0, fail=false;
const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/test/reset'){models=[];pulls=0;fail=false;res.end('{}');}
  else if(req.url==='/test/fail'){fail=true;res.end('{}');}
  else if(req.url==='/test/status')res.end(JSON.stringify({pulls}));
  else if(req.url==='/api/tags')res.end(JSON.stringify({models:models.map(name=>({name}))}));
  else if(req.url==='/api/pull'){
    let body='';for await(const part of req)body+=part;
    const {model}=JSON.parse(body);pulls++;
    if(fail)res.end(JSON.stringify({error:'Deliberate test failure'})+'\n');
    else{res.write(JSON.stringify({status:'pulling layer',completed:50,total:100})+'\n');models.push(model);res.end(JSON.stringify({status:'success'})+'\n');}
  }else{res.statusCode=404;res.end('{}');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{
  const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve('scripts/verify-setup.ps1'),'-AppRoot',join(parent,'BREKTRA'),'-Ollama',`http://127.0.0.1:${server.address().port}`],{stdio:'inherit',windowsHide:true});
  const code=await new Promise(r=>child.once('exit',r));
  if(code!==0)throw new Error(`Setup verification failed: ${code}; extraction ${parent}`);
  console.log(`Setup verification extraction: ${parent}`);
}finally{await new Promise(r=>server.close(r));}
