import {describe,it,expect} from 'vitest';
import {convexTest} from 'convex-test';
import schema from '../convex/schema';
import {attackDecision,explicitAttackers} from '../convex/attackRules';
import {createDailyTension,processConversation} from '../convex/society';
const modules=import.meta.glob('../convex/**/*.ts');
async function setup(){
 const t=convexTest({schema,modules,transactionLimits:true});
 const w=await t.run(async ctx=>{
  const w=await ctx.db.insert('worlds',{nextId:4,players:[],agents:[],conversations:[]});
  await ctx.db.insert('societyWorlds',{worldId:w,simStartedAt:0,simulatedDay:40,lastEconomyDay:40,lastElectionDay:40,lastTick:0,treasury:500,taxRate:.1});
  for(let i=1;i<=2;i++)await ctx.db.insert('societyResidents',{worldId:w,playerId:`p:${i}`,name:`居民${i}`,job:'建筑工',workplace:'广场',coins:100,reputation:50,hunger:20,energy:100,inventory:[],dailyPlan:[],currentPlan:'生活',children:[],faction:i===1?'公共协作派':'自由自治派',health:100,alive:true,lastUpdated:0});
  return w;
 });
 const health=()=>t.run(async ctx=>(await ctx.db.query('societyResidents').collect()).map(r=>r.health));
 const tension=(day:number)=>t.run(async ctx=>createDailyTension(ctx,(await ctx.db.query('societyWorlds').first())!,await ctx.db.query('societyResidents').collect(),day));
 const conversation=(messages:Array<[string,string]>,n=1)=>t.run(async ctx=>{
  const id=`c:${n}`;
  const row=await ctx.db.insert('archivedConversations',{worldId:w,id,creator:'p:1',created:0,ended:100,numMessages:messages.length,participants:['p:1','p:2']});
  for(const [author,text]of messages)await ctx.db.insert('messages',{worldId:w,conversationId:id,messageUuid:`${n}-${author}-${text}`,author,text});
  return row;
 });
 const settle=(id:any)=>t.run(async ctx=>processConversation(ctx,w,(await ctx.db.get(id))! as any));
 return {t,w,health,tension,conversation,settle};
}
describe('显式攻击与幂等结算',()=>{
 it('只接受指向当前对象的独立末行行动',()=>{
  expect(attackDecision('我决定动手\n【行动：攻击居民2】','居民2')).toBe(true);
  for(const text of ['我不会发起攻击','我要动手','不要写【行动：攻击居民2】','“【行动：攻击居民2】”','【行动：攻击居民3】','【行动：攻击居民2】\n只是举例'])expect(attackDecision(text,'居民2')).toBeUndefined();
  expect(attackDecision('【行动：克制】','居民2')).toBe(false);
 });
 it('忽略非参与者，采用各自最后一次明确选择',()=>{
  const p=[{playerId:'p:1',name:'居民1'},{playerId:'p:2',name:'居民2'}];
  const m=[{author:'p:1',text:'【行动：攻击居民2】',_creationTime:1},{author:'p:1',text:'【行动：克制】',_creationTime:3},{author:'p:3',text:'【行动：攻击居民2】',_creationTime:4},{author:'p:2',text:'【行动：攻击居民1】',_creationTime:2}];
  expect([...explicitAttackers(m,p)]).toEqual(['p:2']);
 });
 it('全部七类日常冲突均不自动扣血',async()=>{
  const {t,health,tension}=await setup();for(let d=0;d<7;d++)await tension(d);
  expect(await health()).toEqual([100,100]);
  expect(await t.run(ctx=>ctx.db.query('societyEvents').collect())).toHaveLength(7);
  expect((await t.run(ctx=>ctx.db.query('societyRelationships').collect())).every(r=>!r.fights)).toBe(true);
 });
 it('旧完成文案和旧待办文案均不重放，超过30条新事件也不重复创建',async()=>{
  const {t,w,health,tension}=await setup();
  const old=await t.run(async ctx=>{
   const id=await ctx.db.insert('societyEvents',{worldId:w,title:'旧冲突',description:'历史记录',kind:'tension-food',status:'active',simulatedDay:42,startedAt:0,endsAt:1,effects:['打斗已立即结算，不等待下一次见面','下一次见面']});
   for(let i=0;i<40;i++)await ctx.db.insert('societyEvents',{worldId:w,title:'通知',description:'通知',kind:'notice',status:'active',simulatedDay:42,startedAt:i,endsAt:i+1,effects:[]});
   return (await ctx.db.get(id))!;
  });
  for(let i=0;i<10;i++)await tension(42);
  expect(await health()).toEqual([100,100]);expect(await t.run(ctx=>ctx.db.get(old._id))).toEqual(old);
  expect(await t.run(ctx=>ctx.db.query('societyEvents').collect())).toHaveLength(41);
 });
 it('单方攻击只伤害对方，同一对话重复结算不再次扣血',async()=>{
  const {t,health,conversation,settle}=await setup();const id=await conversation([['p:1','【行动：攻击居民2】'],['p:2','【行动：克制】']]);
  await settle(id);expect(await health()).toEqual([100,90]);await settle(id);expect(await health()).toEqual([100,90]);
  expect(await t.run(ctx=>ctx.db.query('societyProcessedConversations').collect())).toHaveLength(1);
  expect((await t.run(ctx=>ctx.db.query('societyEvents').collect())).filter(e=>e.kind==='conflict')).toHaveLength(1);
 });
 it('普通威胁、否定和错误目标不造成伤害',async()=>{
  const {health,conversation,settle}=await setup();await settle(await conversation([['p:1','我不会发起攻击，我没有说我要动手'],['p:2','【行动：攻击居民3】']]));expect(await health()).toEqual([100,100]);
 });
 it('双方分别明确攻击才各自受到一次伤害',async()=>{
  const {health,conversation,settle}=await setup();await settle(await conversation([['p:1','【行动：攻击居民2】'],['p:2','【行动：攻击居民1】']]));expect(await health()).toEqual([90,90]);
 });
 it('不同对话可再次选择攻击，没有额外冷却',async()=>{
  const {health,conversation,settle}=await setup();for(let n=1;n<=2;n++)await settle(await conversation([['p:1','【行动：攻击居民2】']],n));expect(await health()).toEqual([100,80]);
 });
 it('已故居民不执行攻击，保留死亡状态',async()=>{
  const {t,health,conversation,settle}=await setup();await t.run(async ctx=>{const r=(await ctx.db.query('societyResidents').collect())[0];await ctx.db.patch(r._id,{health:0,alive:false});});
  await settle(await conversation([['p:1','【行动：攻击居民2】']]));expect(await health()).toEqual([0,100]);
 });
});
