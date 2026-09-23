import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const script=JSON.parse(fs.readFileSync('promo/narration.json','utf8'));
fs.mkdirSync('promo/voice',{recursive:true});
for(const [i,line]of script.entries()){
 const path=`promo/voice/${i}.aiff`;
 const r=spawnSync('say',['-v','Tingting','-r','185','-o',path,line.text]);if(r.status)throw Error(r.stderr.toString());
 const duration=Number(spawnSync('/opt/homebrew/bin/ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',path]).stdout.toString());
 line.duration=duration;line.tempo=Math.max(1,duration/(line.end-line.start-.15));
 console.log(i,duration,line.tempo);
}
fs.writeFileSync('promo/voice/timing.json',JSON.stringify(script,null,2));
