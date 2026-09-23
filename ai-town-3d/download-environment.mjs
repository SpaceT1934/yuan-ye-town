import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const curl=(url,args=[])=>execFileSync('curl',['-x','http://127.0.0.1:7890','-fsSL','--retry','2','--max-time','180',...args,url],{maxBuffer:10*1024*1024});
for(const id of ['island_tree_01','tree_stump_01','rock_moss_set_01']){
 const manifest=JSON.parse(curl('https://api.polyhaven.com/files/'+id));
 const asset=manifest.gltf['1k'].gltf,root=`reference-assets/environment/${id}`;
 for(const [name,entry] of [[`${id}.gltf`,asset],...Object.entries(asset.include)]){const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});if(!fs.existsSync(target))curl(entry.url,['-o',target]);}
 console.log('Downloaded',id);
}
