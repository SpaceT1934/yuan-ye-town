import { chromium } from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.TOWN_URL||'http://127.0.0.1:5183');await page.waitForFunction(()=>window.__townReady,{},{timeout:60000});
await page.screenshot({path:'/Users/jan/Documents/Codex/city/ai-town-3d/preview-wide.png'});
await page.getByRole('button',{name:'人物近景'}).click();await page.waitForTimeout(1000);await page.screenshot({path:'/Users/jan/Documents/Codex/city/ai-town-3d/preview-person.png'});
for(const i of [1,2,3]){await page.evaluate(i=>window.__town.select(i,true),i);await page.waitForTimeout(300);await page.screenshot({path:`/Users/jan/Documents/Codex/city/ai-town-3d/preview-person-${i}.png`})}
await page.getByRole('button',{name:'暂停行走',exact:true}).click();const a=await page.evaluate(()=>window.__town.people[0].model.position.z);await page.waitForTimeout(350);const b=await page.evaluate(()=>window.__town.people[0].model.position.z);if(a!==b)errors.push('Pause does not freeze positions');
await page.getByRole('button',{name:'蓝调时刻',exact:true}).click();await page.getByRole('button',{name:'重置视角'}).click();
const measurements=await page.evaluate(()=>window.__town.measure());for(const person of measurements)if(person.size[1]<1.3||person.size[1]>2.2||person.size.some(v=>!Number.isFinite(v)))errors.push('Invalid human dimensions');
console.log(JSON.stringify({people:await page.evaluate(()=>window.__town.people.length),measurements,errors}));await browser.close();if(errors.length)process.exit(1);
