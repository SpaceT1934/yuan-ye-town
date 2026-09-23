import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:2048,height:1536}});
await page.goto('http://127.0.0.1:5183');
await page.evaluate(async()=>{const g=await import('/source-world/data/gentle.js');document.body.replaceChildren();document.body.style.margin='0';const c=document.createElement('canvas');c.width=g.mapwidth*32;c.height=g.mapheight*32;document.body.append(c);const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;const img=new Image();img.src='/source-world/gentle-obj.png';await img.decode();for(const layer of [...g.bgtiles,...g.objmap])for(let x=0;x<g.mapwidth;x++)for(let y=0;y<g.mapheight;y++){const id=layer[x][y];if(id<0)continue;ctx.drawImage(img,id%45*32,Math.floor(id/45)*32,32,32,x*32,y*32,32,32)}ctx.font='14px sans-serif';for(let x=0;x<64;x+=4)for(let y=0;y<48;y+=4){ctx.fillStyle='#0009';ctx.fillRect(x*32,y*32,48,18);ctx.fillStyle='white';ctx.fillText(`${x},${y}`,x*32,y*32+14)}});
await page.screenshot({path:'/Users/jan/Documents/Codex/city/ai-town-3d/source-world/original-map.png'});await browser.close();
