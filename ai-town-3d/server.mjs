import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
const backendOrigin=process.env.TOWN_BACKEND_URL??'http://127.0.0.1:3210';
const queries=new Set(['world:defaultWorldStatus','world:worldState','world:gameDescriptions','world:previousConversation','observatory:overview','civic:overview','messages:listMessages','aiTown/main:inputStatus']);
const mutations=new Set(['world:joinWorld','world:leaveWorld','world:sendWorldInput','world:heartbeatWorld','messages:writeMessage','testing:stop','testing:resume','civic:respond']);
const inputs=new Set(['moveTo','startConversation','acceptInvite','rejectInvite','leaveConversation','startTyping']);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.hdr':'application/octet-stream'};
http.createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/api/backend'){
  if(req.method!=='POST')throw Error('POST required');
  if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){res.writeHead(403);res.end('Origin rejected');return}
  let body='';for await(const chunk of req){body+=chunk;if(body.length>32768)throw Error('Request too large')}
  const payload=JSON.parse(body),allowed=payload.kind==='query'?queries:payload.kind==='mutation'?mutations:new Set();
  if(!allowed.has(payload.path))throw Error('Function not allowed');
  if(payload.path==='world:sendWorldInput'&&!inputs.has(payload.args?.name))throw Error('Input not allowed');
  const upstream=await fetch(backendOrigin+'/api/'+payload.kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:payload.path,args:payload.args??{},format:'json'}),signal:AbortSignal.timeout(20000)});
  res.writeHead(upstream.status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(await upstream.text());return;
 }
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
 const file=path.resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':'no-cache'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch(e){res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'error',errorMessage:e.message}))}
}).listen(Number(process.env.PORT??5183),'0.0.0.0');
