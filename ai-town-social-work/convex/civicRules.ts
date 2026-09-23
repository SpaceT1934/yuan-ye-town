export type ProjectKey='hospital'|'market'|'bridge';
export const PROJECTS = [
 {key:'hospital' as const,title:'扩建医院',description:'增加药品储备和治疗能力，优先保障伤者。',cost:80,materialGoal:8,laborGoal:12},
 {key:'market' as const,title:'建立集市',description:'改善食物供应，降低交易中的食物价格。',cost:90,materialGoal:12,laborGoal:16},
 {key:'bridge' as const,title:'修缮河桥',description:'改善公共交通，降低居民每日劳动精力消耗。',cost:70,materialGoal:10,laborGoal:14},
];
export const projectKey=(s:string):ProjectKey|undefined=>({医院:'hospital',集市:'market',修桥:'bridge',河桥:'bridge'} as Record<string,ProjectKey>)[s];
export function preference(r:{job:string;values?:string[];health?:number;hunger:number;coins:number;faction?:string},key:ProjectKey){
 let score=1;
 if(key==='hospital'){score+=(100-(r.health??100))/12;if(r.job.includes('医生'))score+=6;if(r.values?.includes('基本保障'))score+=3;}
 if(key==='market'){score+=r.hunger/22;if(/商|农/.test(r.job))score+=6;if(r.values?.includes('市场'))score+=3;}
 if(key==='bridge'){if(/建筑|工匠/.test(r.job))score+=7;if(r.values?.includes('劳动'))score+=3;}
 if(r.faction==='公共协作派')score+=2;
 if(r.coins<25)score-=2;
 return score;
}
export function repayment(coins:number,amount:number){return Math.min(Math.max(0,Math.floor(coins)-20),Math.max(0,amount));}
export function boundedAmount(s:string,max:number){const n=Number(s);return Number.isInteger(n)&&n>0&&n<=max?n:null;}
// Only a final, explicit structured action is executable, never quoted prose.
export function command(text:string){return text.trim().match(/(?:^|\n)【小镇：([^【】\n]{1,60})】$/)?.[1]??null;}
export function rumor(account:string,hops:number){return hops>=2?'转述中只剩大意：'+account.replace(/\d+(?:枚|份|点|天)?/g,'若干').slice(0,200):account.slice(0,240);}
