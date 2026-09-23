import {chromium} from 'playwright';
const recording=process.argv.includes('--record');
const browser=await chromium.launch({...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{channel:'chrome'}),headless:true,args:JSON.parse(process.env.CHROME_ARGS??'[]')});
const ctx=await browser.newContext({viewport:{width:1600,height:900},...(recording?{recordVideo:{dir:'recordings/perf',size:{width:1600,height:900}}}:{})});
const page=await ctx.newPage();await page.goto(process.env.TOWN_URL??'http://localhost:5183/');
await page.waitForFunction(()=>window.__town?.live?.overview,null,{timeout:90000});
await page.evaluate(()=>{
 const t=window.__town,metrics={frames:[],life:[],render:[],terrain:[],sync:[],longTasks:[]};window.__perf=metrics;
 const hook=(obj,key,bucket)=>{const original=obj[key];obj[key]=function(...args){const start=performance.now();const result=original.apply(this,args);metrics[bucket].push(performance.now()-start);return result}};
 hook(t.life,'step','life');hook(t.life,'setLiveWorld','sync');hook(t.renderer,'render','render');hook(t.terrain,'update','terrain');
 new PerformanceObserver(list=>metrics.longTasks.push(...list.getEntries().map(e=>e.duration))).observe({entryTypes:['longtask']});
 let previous;function frame(now){if(previous)metrics.frames.push(now-previous);previous=now;requestAnimationFrame(frame)}requestAnimationFrame(frame);
});
const results=[];
async function sample(name,ms=6500){
 await page.evaluate(()=>Object.values(window.__perf).forEach(a=>a.length=0));await page.waitForTimeout(ms);
 results.push(await page.evaluate(name=>{
  const stats=a=>{const s=[...a].sort((a,b)=>a-b);return {n:s.length,mean:s.reduce((a,b)=>a+b,0)/(s.length||1),p95:s[Math.floor(s.length*.95)]??0,max:s.at(-1)??0}};
  const t=window.__town,p=window.__perf;return {name,fps:1000/stats(p.frames).mean,over50ms:p.frames.filter(v=>v>50).length,metrics:Object.fromEntries(Object.entries(p).map(([k,v])=>[k,stats(v)])),draw:{...t.renderer.info.render},error:t.live.error};
 },name));console.log(JSON.stringify(results.at(-1)));
}
await sample('wide');
if(process.argv.includes('--forest')){
 console.log(JSON.stringify(await page.evaluate(()=>{const meshes=[];window.__town.scene.traverse(m=>{if(m.isMesh){const n=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;meshes.push({name:m.name,instances:m.isInstancedMesh?m.count:1,triangles:n*(m.isInstancedMesh?m.count:1),environment:!!m.userData.navigationObstacle})}});return meshes.sort((a,b)=>b.triangles-a.triangles).slice(0,12)})));
 await page.evaluate(()=>window.__town.scene.traverse(m=>{if(m.isInstancedMesh&&m.userData.navigationObstacle)m.visible=false}));
 await sample('wide_no_scanned_environment');await ctx.close();await browser.close();process.exit(0);
}
await page.evaluate(()=>window.__town.select(0,true));await sample('closeup');
if(!recording&&!process.argv.includes('--quick')){
 await page.evaluate(()=>window.__town.renderer.shadowMap.enabled=false);await sample('closeup_no_shadows');
 await page.evaluate(()=>{window.__town.renderer.shadowMap.enabled=true;window.__savedStep=window.__town.life.step;window.__town.life.step=()=>{}});await sample('closeup_no_character_updates');
 await page.evaluate(()=>{window.__town.life.step=window.__savedStep;window.__town.people.forEach(p=>p.visual.visible=false)});await sample('closeup_characters_hidden');
 await page.evaluate(()=>{window.__town.people[0].visual.visible=true});await sample('closeup_one_character');
}
const info=await page.evaluate(()=>{const t=window.__town,g=t.renderer.getContext(),ext=g.getExtension('WEBGL_debug_renderer_info');return {gpu:ext?g.getParameter(ext.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),feetSamples:t.people.map(p=>{let triangles=0;p.visual.traverse(m=>{if(m.isMesh)triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3});return {name:p.resident.name,triangles,vertices:p.feet.reduce((n,[m,a])=>n+a.length,0)}}),memory:t.renderer.info.memory}});
console.log(JSON.stringify({recording,info,results}));await ctx.close();await browser.close();
