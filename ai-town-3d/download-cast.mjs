import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
for(const name of ['Male_Adult_08','Female_Adult_01']){
 const root=`reference-assets/cast/${name}`;fs.mkdirSync(root,{recursive:true});
 for(const folder of ['Export','Textures']){
  const files=JSON.parse(execFileSync('gh',['api',`repos/microsoft/Microsoft-Rocketbox/contents/Assets/Avatars/Adults/${name}/${folder}`]));
  for(const file of files){if(folder==='Export'&&file.name!==name+'.fbx')continue;execFileSync('curl',['-x','http://127.0.0.1:7890','-fsSL','--retry','2','--max-time','60',file.download_url,'-o',`${root}/${file.name}`]);}
 }
 console.log(name);
}
execFileSync('curl',['-x','http://127.0.0.1:7890','-fsSL','https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/LICENSE.md','-o','public/assets/Rocketbox-LICENSE.txt']);
