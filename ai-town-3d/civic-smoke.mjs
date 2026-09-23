import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let complete=false;
 await page.route('**/api/backend',async route=>{
  const body=route.request().postDataJSON();
  if(body.kind==='mutation')throw Error('Smoke test must not mutate the live world');
  if(body.path!=='civic:overview')return route.continue();
  const projects=['hospital','market','bridge'].map((key,i)=>({key,title:['扩建医院','建立集市','修缮河桥'][i],description:'测试夹具 · 不写入存档',cost:80,funds:complete?80:0,spent:complete?80:0,materialGoal:8,laborGoal:12,materials:complete?8:0,labor:complete?12:0,status:complete?'completed':'proposed',votes:[]}));
  return route.fulfill({json:{status:'success',value:{season:{lastDay:40,startedDay:40},projects,requests:[],commitments:[],notices:[],election:null}}});
 });
 await page.goto('http://127.0.0.1:5185/');
 await page.waitForFunction(()=>window.__town?.civic?.data,{timeout:120000});
 await page.locator('#show-civic').click();await page.locator('#civic-dialog').waitFor({state:'visible'});
 assert.equal(await page.locator('#civic-dialog progress').count(),3);
 await page.screenshot({path:'civic-ui-preview.png'});
 await page.locator('#civic-dialog header button').click();complete=true;
 await page.evaluate(()=>window.__town.civic.refresh());
 const result=await page.evaluate(()=>{const t=window.__town,root=t.scene.getObjectByName('公共建设');const tiles=[];for(let x=23;x<=27;x++){const [xx,zz]=t.terrain.xy(x+.5,29.5);tiles.push(t.life.clearWorld(xx,zz));}const [x,z]=t.terrain.xy(45.5,9.5);t.camera.position.set(x+7,9,z+11);t.camera.lookAt(x,3,z);t.renderer.setAnimationLoop(null);t.renderer.render(t.scene,t.camera);return {projects:root.children.length,bridgeHeight:t.terrain.surfaceHeight(25.5,29.5),tiles,oldTentHidden:!t.scene.children.find(o=>o.userData.sourcePropId==='tile-1-44-7').visible}});
 assert.equal(result.projects,3);assert.equal(result.bridgeHeight,.28);assert.ok(result.tiles.every(Boolean));assert.ok(result.oldTentHidden);
 await page.screenshot({path:'civic-clinic-preview.png'});assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,result}));
}finally{await browser.close()}
