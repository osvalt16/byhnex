import fs from 'node:fs';
import path from 'node:path';
export {publicFiles} from './public-files.js';
import {publicFiles} from './public-files.js';
const output=path.resolve('dist');
for(const old of fs.existsSync(output)?fs.readdirSync(output):[]){if(!publicFiles.includes(old)&&old!=='.nojekyll')throw Error('Fichier non public dans dist : '+old);}
fs.mkdirSync(output,{recursive:true});
for(const file of publicFiles){
  if(file.endsWith('.html')){
    const html=fs.readFileSync(file,'utf8');
    for(const match of html.matchAll(/(?:href|src)="([^"\s]+)"/g)){
      const ref=match[1];
      if(/^(?:https?:|data:|#|\$\{)/.test(ref))continue;
      const target=ref.split(/[?#]/)[0];
      if(target.startsWith('/'))throw Error(`${file}: chemin absolu incompatible avec /byhnex/ : ${target}`);
      if(!publicFiles.includes(target))throw Error(`${file}: ressource absente de la publication : ${target}`);
    }
  }
  const source=/\.(html|css|js|json)$/.test(file)?fs.readFileSync(file,'utf8'):'';
  if(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/.test(source)||/OPENAI_API_KEY\s*[:=]\s*["'][^"']+["']/.test(source))throw Error(file+': secret d?tect? dans les ressources publiques');
  if(/\.(html|css|js|json)$/.test(file))fs.writeFileSync(path.join(output,file),fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n'));
  else fs.copyFileSync(file,path.join(output,file));
}
fs.writeFileSync(path.join(output,'.nojekyll'),'');
console.log(`${publicFiles.length} fichiers publics vérifiés et préparés dans dist/.`);
