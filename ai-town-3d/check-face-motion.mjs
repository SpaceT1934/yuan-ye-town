import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TOWN_URL??'http://localhost:5183/');await page.waitForFunction(()=>window.__town?.people.every(p=>p.faceMotion),null,{timeout:90000});
 const results=await page.evaluate(()=>{const t=window.__town;t.life.step=()=>{};t.life.setLiveWorld=()=>{};
  return t.people.map(p=>{let drift=0,lipError=0,finite=true;
   for(const mode of ['idle','walk']){p.mixer.stopAllAction();p[mode].reset().play();
    for(let frame=0;frame<240;frame++){p.mixer.update(.05);p.faceMotion.apply(frame*.05);const first=p.faceMotion.lids.map(l=>[l.bone.position.clone(),l.bone.quaternion.clone()]);p.faceMotion.apply(frame*.05);
     p.faceMotion.lids.forEach((l,i)=>{drift=Math.max(drift,l.bone.position.distanceTo(first[i][0]),1-Math.abs(l.bone.quaternion.dot(first[i][1])));finite&&=[...l.bone.position,...l.bone.quaternion].every(Number.isFinite)});
     p.visual.traverse(b=>{if(b.isBone&&/jaw|lip|mouth/i.test(b.name)){const q=p.bindPose.get(b.name)?.quaternion;if(q)lipError=Math.max(lipError,1-Math.abs(q.dot(b.quaternion)))}});
    }
   }return {name:p.resident.name,lids:p.faceMotion.lids.length,drift,lipError,finite};
  })});
 assert.deepEqual(errors,[]);for(const r of results){assert.ok(r.lids>=2);assert.ok(r.drift<1e-5);assert.ok(r.lipError<1e-5);assert.ok(r.finite)}
 await fs.writeFile('promo/face-regression.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify(results));
}finally{await browser.close()}
