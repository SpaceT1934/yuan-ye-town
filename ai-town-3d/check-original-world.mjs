import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const original=JSON.parse(fs.readFileSync('source-world/world-snapshot.json','utf8'));
const snapshot=JSON.parse(fs.readFileSync('public/world/snapshot.json','utf8'));
assert.deepEqual(snapshot.map.bgTiles,original.tables.maps[0].bgTiles);
assert.deepEqual(snapshot.map.objectTiles,original.tables.maps[0].objectTiles);
assert.deepEqual(snapshot.map.animatedSprites,original.tables.maps[0].animatedSprites);
assert.deepEqual(new Set(snapshot.residents.map(r=>r.playerId)),new Set(original.tables.worlds[0].players.map(r=>r.id)));
for(const r of snapshot.residents){const old=original.tables.societyResidents.find(p=>p.playerId===r.playerId);for(const key of ['name','job','health','faction','coins','partnerId'])assert.equal(r[key],old[key]);assert.deepEqual(r.position,original.tables.worlds[0].players.find(p=>p.id===r.playerId).position)}
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl']});
const page=await browser.newPage({viewport:{width:1600,height:1050}});const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
await page.goto(process.env.TOWN_URL||'http://127.0.0.1:5183');await page.waitForFunction(()=>window.__townReady,null,{timeout:90000});
await page.screenshot({path:'original-world-overview.png',timeout:120000});
const measurement=await page.evaluate(()=>window.__town.measure());assert.equal(measurement.length,8);for(const p of measurement){assert.ok(p.size[1]>1.4&&p.size[1]<2.1);assert.ok(Math.abs(p.position[0]-(p.sourcePosition.x-32)*1.5)<1e-5);assert.ok(Math.abs(p.position[2]-(p.sourcePosition.y-24)*1.5)<1e-5)}
for(const resident of snapshot.residents){await page.selectOption('#resident-select',resident.playerId);assert.ok((await page.locator('#profile').innerText()).includes(resident.identity))}
await page.selectOption('#resident-select','p:8417');assert.ok((await page.locator('#profile').innerText()).includes('25 / 100'));await page.screenshot({path:'original-world-resident.png',timeout:120000});
await page.getByRole('button',{name:'播放人物展示动作',exact:true}).click();const before=await page.evaluate(()=>window.__town.people.map(p=>p.group.position.toArray()));await page.waitForTimeout(600);const after=await page.evaluate(()=>window.__town.people.map(p=>p.group.position.toArray()));assert.deepEqual(after,before);await page.getByRole('button',{name:'暂停人物展示动作',exact:true}).click();
await page.getByRole('button',{name:'查看原图 ↗',exact:true}).click();assert.ok(await page.locator('#map-dialog').isVisible());await page.getByRole('button',{name:'关闭',exact:true}).click();
assert.equal(requests.filter(r=>r.method!=='GET').length,0);assert.equal(requests.filter(r=>/11434|11435|3210|api\/chat|api\/generate/.test(r.url)).length,0);assert.deepEqual(errors,[]);
console.log(JSON.stringify({residents:8,map:[64,48],sourceLayersUnchanged:true,identityAndHealthPreserved:true,positionsPreserved:true,llmRequests:0,geometry:measurement,terrain:await page.evaluate(()=>window.__town.terrain.counts),errors}));
await browser.close();
