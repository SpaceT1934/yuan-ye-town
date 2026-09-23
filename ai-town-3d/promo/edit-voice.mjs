import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const lines=JSON.parse(fs.readFileSync('voice/timing.json','utf8'));
const shots=[['opening',8],['two-d',15],['wide',8],['zhou',6],['street',6],['stella',6],['forest',7],['sunset',8]];
const filters=shots.map(([n,d],i)=>`[${i}:v]trim=start=0.3:duration=${d},setpts=PTS-STARTPTS,fps=60,setsar=1,format=yuv420p[v${i}]`);
let end=8,last='v0';
for(let i=1;i<shots.length;i++){const label='x'+i;filters.push(`[${last}][v${i}]xfade=transition=fade:duration=0.5:offset=${end-.5}[${label}]`);end+=shots[i][1]-.5;last=label}
filters.push(`[${last}]crop=1600:800:0:50,pad=1600:900:0:50:black,eq=contrast=1.035:saturation=1.035,fade=t=in:st=0:d=0.7,fade=t=out:st=59:d=1.5,ass=promo-voice.ass[v]`);
for(const [i,l]of lines.entries())filters.push(`[${9+i}:a]atempo=${l.tempo},loudnorm=I=-18:TP=-3:LRA=7,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.025,adelay=${Math.round(l.start*1000)}|${Math.round(l.start*1000)}[line${i}]`);
filters.push(lines.map((_,i)=>`[line${i}]`).join('')+`amix=inputs=${lines.length}:normalize=0,apad=whole_dur=60.5,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,asplit=2[voice][side]`);
filters.push('[8:a]atrim=duration=60.5,loudnorm=I=-16:TP=-2:LRA=9,aresample=48000,volume=0.30,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[bgm]');
filters.push('[bgm][side]sidechaincompress=threshold=0.02:ratio=4:attack=20:release=450[duck]');
filters.push('[duck][voice]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000,afade=t=out:st=59:d=1.5[a]');
fs.writeFileSync('edit-voice-filter.txt',filters.join(';\n'));
const args=['-hide_banner','-loglevel','warning','-nostdin','-y','-filter_complex_threads','2',...shots.flatMap(([n])=>['-i',n+'.mp4']),'-i','original-score.wav',...lines.flatMap((_,i)=>['-i',`voice/${i}.aiff`]),'-filter_complex_script','edit-voice-filter.txt','-map','[v]','-map','[a]','-c:v','h264_nvenc','-preset','p5','-rc','vbr','-cq','21','-b:v','0','-c:a','aac','-ar','48000','-b:a','192k','-pix_fmt','yuv420p','-movflags','+faststart','-t',String(end),'原野小镇-配音宣传片.mp4'];
const r=spawnSync('ffmpeg',args,{stdio:'inherit'});if(r.status)process.exit(r.status);console.log({duration:end});
