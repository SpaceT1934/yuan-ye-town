import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const dir=new URL('./recordings/',import.meta.url).pathname;
const m=JSON.parse(await fs.readFile(dir+'manifest.json','utf8'));
if(m.errors.length||m.final.error)throw Error('Recording reported application errors');
const target=dir+'原野小镇-3D实机演示.mp4';
const result=spawnSync('/opt/homebrew/bin/ffmpeg',['-hide_banner','-nostdin','-n','-ss',String(m.start),'-i',m.raw,'-t',String(m.duration),'-an','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart','-metadata','title=原野小镇 · 3D 实机演示',target],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);
console.log(target);
