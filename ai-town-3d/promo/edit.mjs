import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const shots=[['opening',8],['two-d',15],['wide',8],['zhou',6],['street',6],['stella',6],['forest',7],['sunset',8]];
const filters=shots.map(([n,d],i)=>`[${i}:v]trim=start=0.3:duration=${d},setpts=PTS-STARTPTS,fps=60,setsar=1,format=yuv420p[v${i}]`);
let end=shots[0][1],last='v0';
for(let i=1;i<shots.length;i++){const label='x'+i;filters.push(`[${last}][v${i}]xfade=transition=fade:duration=0.5:offset=${end-.5}[${label}]`);end+=shots[i][1]-.5;last=label}
filters.push(`[${last}]crop=1600:800:0:50,pad=1600:900:0:50:black,eq=contrast=1.035:saturation=1.035,fade=t=in:st=0:d=0.7,fade=t=out:st=59:d=1.5,ass=promo.ass[v]`);
filters.push(`[8:a]atrim=duration=${end},asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=out:st=57.5:d=3[a]`);
fs.writeFileSync('edit-filter.txt',filters.join(';\n'));
const args=['-hide_banner','-loglevel','warning','-nostdin','-y','-filter_complex_threads','2',...shots.flatMap(([n])=>['-i',n+'.mp4']),'-i','original-score.wav','-filter_complex_script','edit-filter.txt','-map','[v]','-map','[a]','-c:v','h264_nvenc','-preset','p5','-rc','vbr','-cq','19','-b:v','0','-c:a','aac','-b:a','192k','-pix_fmt','yuv420p','-movflags','+faststart','-t',String(end),'原野小镇-从二维到三维-宣传片.mp4'];
const r=spawnSync('ffmpeg',args,{stdio:'inherit'});if(r.status)process.exit(r.status);console.log({duration:end});
