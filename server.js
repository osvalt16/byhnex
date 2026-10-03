import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
import {publicFiles} from './public-files.js';
const root=process.cwd(),allowed=new Set(publicFiles);
http.createServer((req,res)=>{
  let p;try{p=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';}catch{res.writeHead(400).end();return;}
  if(!allowed.has(p)){res.writeHead(404).end('Page introuvable');return;}
  fs.readFile(path.join(root,p),(e,d)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.ico':'image/x-icon'})[path.extname(p)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(d);});
}).listen(5173,'127.0.0.1',()=>console.log('Byhnex : http://localhost:5173'));
