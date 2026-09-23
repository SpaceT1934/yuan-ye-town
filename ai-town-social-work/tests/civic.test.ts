import {describe,it,expect} from 'vitest';
import {convexTest} from 'convex-test';
import {makeFunctionReference} from 'convex/server';
import schema from '../convex/schema';
import {ensureSeason,advanceCivic,civicConversation,civicContext,civicOverview} from '../convex/civic';
import {command,repayment,boundedAmount} from '../convex/civicRules';
const modules=import.meta.glob('../convex/**/*.ts');
async function setup(){
 const t=convexTest({schema,modules,transactionLimits:true});
 const w=await t.run(async ctx=>{
  const w=await ctx.db.insert('worlds',{nextId:4,players:[],agents:[],conversations:[]});
  const layer=Array.from({length:64},()=>Array(48).fill(-1));for(let y=0;y<48;y++)layer[25][y]=458;layer[24][28]=999;
  await ctx.db.insert('maps',{worldId:w,width:64,height:48,tileSetUrl:'test',tileSetDimX:16,tileSetDimY:16,tileDim:16,bgTiles:[],objectTiles:[layer],animatedSprites:[]});
  await ctx.db.insert('societyWorlds',{worldId:w,simStartedAt:0,simulatedDay:40,lastEconomyDay:40,lastElectionDay:40,lastTick:0,treasury:500,taxRate:.1});
  for(let i=1;i<=3;i++)await ctx.db.insert('societyResidents',{worldId:w,playerId:`p:${i}`,name:`居民${i}`,job:'建筑工',workplace:'广场',coins:100,reputation:50,hunger:20,energy:100,inventory:[{item:'建筑材料',quantity:20},{item:'食物',quantity:10}],dailyPlan:[],currentPlan:'生活',children:[],faction:'公共协作派',values:['互助','公平'],health:60,alive:true,lastUpdated:0});
  for(const [a,b]of[[1,2],[1,3],[2,3]])await ctx.db.insert('societyRelationships',{worldId:w,player1:`p:${a}`,player2:`p:${b}`,familiarity:20,trust:10,affection:10,conflict:0,stage:'认识',conversations:1,lastInteractionAt:0});
  await ensureSeason(ctx,w,40);return w;
 });
 const say=(author:string,text:string,other='p:2',day=40)=>t.run(async ctx=>{const s=(await ctx.db.query('societyWorlds').collect())[0];await ctx.db.patch(s._id,{simulatedDay:day});return civicConversation(ctx,w,[{author,text,_creationTime:Date.now()}] as any,[author,other]);});
 const balances=()=>t.run(async ctx=>(await ctx.db.query('societyResidents').collect()).map(r=>r.coins));
 return {t,w,say,balances};
}
describe('建设季',()=>{
 it('短工耗费精力、每日只能一次、不改变职业',async()=>{const {t,say}=await setup();await say('p:1','我愿意做\n【小镇：制作建材】');await say('p:1','再做\n【小镇：制作建材】');const r=(await t.run(ctx=>ctx.db.query('societyResidents').collect()))[0];expect(r.inventory.find(i=>i.item==='建筑材料')!.quantity).toBe(21);expect(r.energy).toBe(88);expect(r.job).toBe('建筑工');expect(await t.run(ctx=>ctx.db.query('civicWork').collect())).toHaveLength(1)});
 it('仅解析独立末行指令，保留生活费用',()=>{expect(command('引用【小镇：借款：10】')).toBeNull();expect(command('想借钱\n【小镇：借款：10】')).toBe('借款：10');expect(repayment(23,10)).toBe(3);expect(boundedAmount('999',20)).toBeNull()});
 it('初始化不重置居民且重复初始化幂等',async()=>{const {t,w,balances}=await setup();await t.run(ctx=>ensureSeason(ctx,w,41));expect(await balances()).toEqual([100,100,100]);expect(await t.run(ctx=>ctx.db.query('civicProjects').collect())).toHaveLength(3)});
 it('借款双向同意、重复同意不转账、归还守恒',async()=>{const {t,w,say,balances}=await setup();await say('p:1','借一点\n【小镇：借款：10】');expect(await balances()).toEqual([100,100,100]);await say('p:2','可以\n【小镇：同意借款】','p:1');expect(await balances()).toEqual([110,90,100]);await say('p:2','同意\n【小镇：同意借款】','p:1');expect(await balances()).toEqual([110,90,100]);await say('p:1','还你\n【小镇：还款】');expect(await balances()).toEqual([100,100,100]);expect((await t.run(ctx=>civicOverview(ctx,w)))!.commitments[0].status).toBe('fulfilled')});
 it('私密消息不自动广播，主动转述才进入第三人知识',async()=>{const {t,w,say}=await setup();await say('p:1','借一点\n【小镇：借款：10】');const before=await t.run(ctx=>civicContext(ctx,w,'p:3'));expect(before!.knowledge.some(k=>k.account.includes('借款'))).toBe(false);await say('p:1','告诉你\n【小镇：分享消息】','p:3');const after=await t.run(ctx=>civicContext(ctx,w,'p:3'));expect(after!.knowledge.some(k=>k.source==='居民1转述'&&k.confidence===80)).toBe(true)});
 it('过期拒付影响信任而非凭空扣钱',async()=>{const {t,w,say,balances}=await setup();await say('p:1','借钱\n【小镇：借款：10】');await say('p:2','同意\n【小镇：同意借款】','p:1');await t.run(async ctx=>{const r=(await ctx.db.query('societyResidents').collect())[0];await ctx.db.patch(r._id,{coins:0});});await t.run(ctx=>advanceCivic(ctx,w,45));const c=(await t.run(ctx=>civicOverview(ctx,w)))!.commitments[0];expect(c.status).toBe('broken');expect((await balances()).every(n=>n>=0)).toBe(true)});
 it('建设消耗真实库存，资金守恒，每日推进幂等',async()=>{const {t,w}=await setup();const total=()=>t.run(async ctx=>{const rs=await ctx.db.query('societyResidents').collect(),s=await ctx.db.query('societyWorlds').first(),ps=await ctx.db.query('civicProjects').collect();return rs.reduce((a,r)=>a+r.coins,0)+s!.treasury+ps.reduce((a,p)=>a+p.funds-p.spent,0)});const initial=await total();for(let day=40;day<=46;day++)await t.run(ctx=>advanceCivic(ctx,w,day));expect(await total()).toBe(initial);const before=await t.run(ctx=>civicOverview(ctx,w));await t.run(ctx=>advanceCivic(ctx,w,46));expect(await t.run(ctx=>civicOverview(ctx,w))).toEqual(before);expect(before!.projects.some(p=>p.status==='completed')).toBe(true)});
 it('竞选与投票分阶段，保存每人一票和任期承诺',async()=>{const {t,w,say}=await setup();await t.run(ctx=>advanceCivic(ctx,w,45));expect((await t.run(ctx=>civicOverview(ctx,w)))!.election!.status).toBe('campaigning');await t.run(ctx=>advanceCivic(ctx,w,46));await say('p:1','支持你\n【小镇：投票：居民2】','p:2',46);await t.run(ctx=>advanceCivic(ctx,w,47));const e=(await t.run(ctx=>civicOverview(ctx,w)))!.election!;expect(e.status).toBe('completed');expect(e.ballots).toHaveLength(3);expect(e.ballots.find(b=>b.voterId==='p:1')).toMatchObject({candidateId:'p:2',explicit:true});expect(new Set(e.ballots.map(b=>b.voterId)).size).toBe(3)});
 it('桥梁完工只开放指定河道，保留其他物品与地图',async()=>{const {t,w}=await setup();for(let day=40;day<=46;day++)await t.run(ctx=>advanceCivic(ctx,w,day));const m=await t.run(ctx=>ctx.db.query('maps').first());expect(m!.objectTiles[0][25][28]).toBe(-1);expect(m!.objectTiles[0][25][29]).toBe(-1);expect(m!.objectTiles[0][25][30]).toBe(458);expect(m!.objectTiles[0][24][28]).toBe(999)});
 it('访客回应幂等，不直接修改居民金币，拒绝不会受罚',async()=>{const {t,w,balances}=await setup();await t.run(ctx=>advanceCivic(ctx,w,40));const req=(await t.run(ctx=>civicOverview(ctx,w)))!.requests[0];const before=await balances(),fn=makeFunctionReference<'mutation'>('civic:respond');await t.mutation(fn,{worldId:w,requestId:req._id,accept:false});expect(await t.mutation(fn,{worldId:w,requestId:req._id,accept:true})).toEqual({status:'declined'});expect(await balances()).toEqual(before)});
 it('已故居民不执行新契约，原记录仍保留',async()=>{const {t,w,say,balances}=await setup();await t.run(async ctx=>{const r=(await ctx.db.query('societyResidents').collect())[0];await ctx.db.patch(r._id,{alive:false,health:0})});await say('p:1','借钱\n【小镇：借款：10】');expect((await t.run(ctx=>civicOverview(ctx,w)))!.commitments).toHaveLength(0);expect(await balances()).toEqual([100,100,100]);expect(await t.run(ctx=>ctx.db.query('societyResidents').collect())).toHaveLength(3)});
});
