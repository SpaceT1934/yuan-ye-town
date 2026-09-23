import { v } from 'convex/values';
import { Doc, Id } from './_generated/dataModel';
import { internalMutation, internalQuery, mutation, MutationCtx } from './_generated/server';
import { conversationId, playerId } from './aiTown/ids';
import { insertInput } from './aiTown/insertInput';
import {ensureSeason,advanceCivic,civicConversation,civicContext} from './civic';
import {explicitAttackers} from './attackRules';

const SIMULATED_DAY_MS = 30 * 60_000;

const FACTIONS = ['公共协作派', '自由自治派'] as const;

const civicProfiles: Record<string, { faction: (typeof FACTIONS)[number]; values: string[] }> = {
  乐乐: { faction: '自由自治派', values: ['开放', '科研', '信息自由'] },
  鲍勃: { faction: '自由自治派', values: ['农业', '低税', '自给自足'] },
  斯黛拉: { faction: '自由自治派', values: ['贸易', '低税', '市场'] },
  爱丽丝: { faction: '公共协作派', values: ['科研', '公共投入', '理性治理'] },
  皮特: { faction: '公共协作派', values: ['互助', '秩序', '基本保障'] },
  林岚: { faction: '公共协作派', values: ['医疗', '基本保障', '公共投入'] },
  周石: { faction: '自由自治派', values: ['建设', '劳动', '财政稳健'] },
  苏菲: { faction: '公共协作派', values: ['教育', '公平', '民主参与'] },
};

const fallbackCivicProfile = { faction: '自由自治派', values: ['自治', '社区'] };

const jobProfiles: Record<
  string,
  {
    job: string;
    workplace: string;
    output: string;
    quantity: number;
    plans: Array<{ period: string; activity: string; location: string }>;
  }
> = {
  乐乐: {
    job: '探索记者',
    workplace: '报社与观测台',
    output: '小镇新闻',
    quantity: 2,
    plans: [
      { period: '早晨', activity: '整理太空见闻和采访线索', location: '报社' },
      { period: '下午', activity: '采访居民并寻找新鲜事', location: '镇中心' },
      { period: '晚上', activity: '撰写小镇日报', location: '报社' },
    ],
  },
  鲍勃: {
    job: '园丁与农夫',
    workplace: '果园',
    output: '食物',
    quantity: 7,
    plans: [
      { period: '早晨', activity: '照料果树并采收食物', location: '果园' },
      { period: '下午', activity: '整理工具和出售农产品', location: '集市' },
      { period: '晚上', activity: '独自检查树木', location: '果园' },
    ],
  },
  斯黛拉: {
    job: '商人与活动策划人',
    workplace: '集市',
    output: '市场服务',
    quantity: 2,
    plans: [
      { period: '早晨', activity: '研究价格并寻找合作机会', location: '集市' },
      { period: '下午', activity: '组织交易和公共活动', location: '镇中心' },
      { period: '晚上', activity: '核对账本并制定营销计划', location: '商店' },
    ],
  },
  爱丽丝: {
    job: '科学研究员',
    workplace: '实验室',
    output: '研究成果',
    quantity: 2,
    plans: [
      { period: '早晨', activity: '进行实验并记录数据', location: '实验室' },
      { period: '下午', activity: '交流发现并验证假设', location: '观测台' },
      { period: '晚上', activity: '整理研究报告', location: '实验室' },
    ],
  },
  皮特: {
    job: '社区服务者',
    workplace: '社区中心',
    output: '社区服务',
    quantity: 2,
    plans: [
      { period: '早晨', activity: '准备社区服务和祈祷', location: '社区中心' },
      { period: '下午', activity: '探访居民并协调互助', location: '镇中心' },
      { period: '晚上', activity: '记录社区需求', location: '社区中心' },
    ],
  },
  林岚: {
    job: '医生',
    workplace: '诊所',
    output: '医疗服务',
    quantity: 3,
    plans: [
      { period: '早晨', activity: '巡诊并整理药品', location: '诊所' },
      { period: '下午', activity: '接诊居民并宣传公共健康', location: '诊所' },
      { period: '晚上', activity: '记录病例和研究健康风险', location: '诊所' },
    ],
  },
  周石: {
    job: '工匠与建筑师',
    workplace: '工坊',
    output: '建筑材料',
    quantity: 3,
    plans: [
      { period: '早晨', activity: '制作工具和建筑材料', location: '工坊' },
      { period: '下午', activity: '检修公共建筑并洽谈订单', location: '镇中心' },
      { period: '晚上', activity: '核算材料和劳动成本', location: '工坊' },
    ],
  },
  苏菲: {
    job: '教师与社区组织者',
    workplace: '学校',
    output: '教育服务',
    quantity: 2,
    plans: [
      { period: '早晨', activity: '备课并整理公共议题', location: '学校' },
      { period: '下午', activity: '授课并走访居民', location: '学校' },
      { period: '晚上', activity: '组织公开讨论和公民课堂', location: '社区中心' },
    ],
  },
};

const fallbackProfile = {
  job: '自由居民',
  workplace: '镇中心',
  output: '劳务',
  quantity: 1,
  plans: [
    { period: '早晨', activity: '处理日常事务', location: '家' },
    { period: '下午', activity: '工作和社交', location: '镇中心' },
    { period: '晚上', activity: '休息并回顾一天', location: '家' },
  ],
};

const positiveWords = [
  '愉快',
  '喜欢',
  '期待',
  '合作',
  '帮助',
  '赞同',
  '开心',
  '朋友',
  '信任',
  '共同',
  '温暖',
  '满意',
];
const negativeWords = [
  '不愉快',
  '不喜欢',
  '拒绝',
  '冷淡',
  '厌烦',
  '失望',
  '生气',
  '不信任',
  '烦躁',
  '警惕',
  '不悦',
  '质疑',
  '争吵',
  '指责',
  '不满',
  '反对',
  '否认',
  '怀疑',
  '嫉妒',
  '欠款',
  '偷窃',
  '拒诊',
  '不公平',
  '被忽视',
  '冲突',
  '争议',
  '无法接受',
];
const cooperationWords = ['合作', '一起', '共同', '计划', '约定', '帮助'];

function canonicalPair(a: string, b: string) {
  return a.localeCompare(b) < 0 ? ([a, b] as const) : ([b, a] as const);
}

function countWords(text: string, words: string[]) {
  return words.reduce((total, word) => total + (text.includes(word) ? 1 : 0), 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function relationshipStage(values: {
  familiarity: number;
  trust: number;
  affection: number;
  conflict: number;
  conversations: number;
  partnered: boolean;
  canPartner: boolean;
  former: boolean;
  breakupRisk: number;
}) {
  if (values.conflict >= 7 && values.trust <= 5) return '对立' as const;
  if (
    values.partnered &&
    values.conversations >= 20 &&
    values.affection >= 35 &&
    values.trust >= 25
  )
    return '夫妻' as const;
  if (values.partnered) return '伴侣' as const;
  if (
    values.canPartner &&
    values.conversations >= 10 &&
    values.affection >= (values.former ? 35 : 24) &&
    values.trust >= (values.former ? 25 : 14) &&
    values.breakupRisk === 0
  )
    return '伴侣' as const;
  if (values.former) return '前伴侣' as const;
  if (values.familiarity >= 12 && values.affection >= 15) return '亲密朋友' as const;
  if (values.familiarity >= 6 && values.trust >= 5) return '朋友' as const;
  if (values.familiarity >= 3) return '熟悉' as const;
  if (values.familiarity >= 1) return '认识' as const;
  return '陌生' as const;
}

async function ensureSociety(ctx: MutationCtx, worldId: Id<'worlds'>) {
  const world = await ctx.db.get(worldId);
  if (!world) throw new Error(`World ${worldId} not found`);
  let state = await ctx.db
    .query('societyWorlds')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .unique();
  if (!state) {
    const now = Date.now();
    const stateId = await ctx.db.insert('societyWorlds', {
      worldId,
      simStartedAt: world._creationTime,
      simulatedDay: 1,
      lastEconomyDay: 0,
      lastElectionDay: -7,
      lastTick: now,
      treasury: 250,
      taxRate: 0.05,
    });
    state = (await ctx.db.get(stateId))!;
  }

  const descriptions = await ctx.db
    .query('playerDescriptions')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .collect();
  const agentPlayerIds = new Set(world.agents.map((agent) => agent.playerId));
  for (const description of descriptions.filter((item) => agentPlayerIds.has(item.playerId))) {
    const existing = await ctx.db
      .query('societyResidents')
      .withIndex('resident', (q) => q.eq('worldId', worldId).eq('playerId', description.playerId))
      .unique();
    const civic = civicProfiles[description.name] ?? fallbackCivicProfile;
    if (existing) {
      const patch: Record<string, unknown> = {};
      if (existing.health === undefined) patch.health = 100;
      if (existing.alive === undefined) patch.alive = true;
      if (!FACTIONS.includes(existing.faction as (typeof FACTIONS)[number])) {
        patch.faction = civic.faction;
        patch.lastFactionChangeDay = state.simulatedDay;
      }
      if (existing.values === undefined) patch.values = civic.values;
      if (Object.keys(patch).length > 0) await ctx.db.patch(existing._id, patch);
      continue;
    }
    const profile = jobProfiles[description.name] ?? fallbackProfile;
    await ctx.db.insert('societyResidents', {
      worldId,
      playerId: description.playerId,
      name: description.name,
      job: profile.job,
      workplace: profile.workplace,
      coins: 100,
      reputation: 50,
      hunger: 10,
      energy: 80,
      inventory: [],
      dailyPlan: profile.plans,
      currentPlan: profile.plans[0].activity,
      children: [],
      faction: civic.faction,
      lastFactionChangeDay: state.simulatedDay,
      values: civic.values,
      health: 100,
      alive: true,
      lastUpdated: Date.now(),
    });
  }
  return state;
}

async function recordDeath(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  resident: Doc<'societyResidents'>,
  cause: string,
  day: number,
) {
  if (resident.alive === false) return;
  const now = Date.now();
  await ctx.db.patch(resident._id, {
    health: 0,
    alive: false,
    diedAt: now,
    causeOfDeath: cause,
    partnerId: undefined,
    householdId: undefined,
    currentPlan: '已故，保留于小镇史册',
    lastUpdated: now,
  });
  if (resident.partnerId) {
    const partner = await ctx.db
      .query('societyResidents')
      .withIndex('resident', (q) => q.eq('worldId', worldId).eq('playerId', resident.partnerId!))
      .unique();
    if (partner) {
      await ctx.db.patch(partner._id, {
        partnerId: undefined,
        householdId: undefined,
        currentPlan: `悼念${resident.name}并整理家庭事务`,
      });
    }
  }
  await ctx.db.insert('societyEvents', {
    worldId,
    title: `${resident.name}去世`,
    description: `${resident.name}因${cause}离开了小镇。其关系、财产与生平记录被永久保留。`,
    kind: 'death',
    status: 'active',
    simulatedDay: day,
    startedAt: now,
    endsAt: now + SIMULATED_DAY_MS * 2,
    effects: ['从实时地图与后续活动中退出', '历史关系与财产记录永久保留', '亲友进入悼念期'],
  });
  await insertInput(ctx, worldId, 'removeAgent', { playerId: resident.playerId });
}

export async function processConversation(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  conversation: Doc<'archivedConversations'>,
) {
  const alreadyProcessed = await ctx.db
    .query('societyProcessedConversations')
    .withIndex('conversation', (q) =>
      q.eq('worldId', worldId).eq('conversationId', conversation.id),
    )
    .unique();
  if (alreadyProcessed || conversation.participants.length !== 2 || conversation.numMessages === 0)
    return;

  const [rawA, rawB] = conversation.participants;
  const residents = await Promise.all(
    [rawA, rawB].map((id) =>
      ctx.db
        .query('societyResidents')
        .withIndex('resident', (q) => q.eq('worldId', worldId).eq('playerId', id))
        .unique(),
    ),
  );
  if (!residents[0] || !residents[1]) {
    await ctx.db.insert('societyProcessedConversations', {
      worldId,
      conversationId: conversation.id,
      processedAt: Date.now(),
    });
    return;
  }
  if (residents[0].alive === false || residents[1].alive === false) {
    await ctx.db.insert('societyProcessedConversations', {
      worldId,
      conversationId: conversation.id,
      processedAt: Date.now(),
    });
    return;
  }

  const conversationMessages = await ctx.db
    .query('messages')
    .withIndex('conversationId', (q) =>
      q.eq('worldId', worldId).eq('conversationId', conversation.id),
    )
    .collect();
  const attackers = explicitAttackers(conversationMessages, [residents[0], residents[1]]);

  const summaries: string[] = [];
  for (const playerId of [rawA, rawB]) {
    const memories = await ctx.db
      .query('memories')
      .withIndex('playerId', (q) => q.eq('playerId', playerId))
      .order('desc')
      .take(120);
    const memory = memories.find(
      (item) => item.data.type === 'conversation' && item.data.conversationId === conversation.id,
    );
    if (memory) summaries.push(memory.description);
  }
  const text = summaries.join('\n');
  const positive = countWords(text, positiveWords);
  const negative = countWords(text, negativeWords);
  const cooperation = countWords(text, cooperationWords);
  const [player1, player2] = canonicalPair(rawA, rawB);
  const existing = await ctx.db
    .query('societyRelationships')
    .withIndex('pair', (q) =>
      q.eq('worldId', worldId).eq('player1', player1).eq('player2', player2),
    )
    .unique();
  const familiarity = (existing?.familiarity ?? 0) + 1;
  const conversations = (existing?.conversations ?? 0) + 1;
  const sentiment = clamp(positive - negative * 2, -3, 3);
  const ideologicalTension = residents[0].faction !== residents[1].faction;
  const trust = clamp(
    (existing?.trust ?? 0) +
      sentiment +
      Math.min(cooperation, 2) -
      (ideologicalTension && negative > 0 ? 1 : 0),
    -30,
    50,
  );
  const affection = clamp((existing?.affection ?? 0) + sentiment + (positive > 0 ? 1 : 0), -30, 50);
  const conflict = clamp(
    (existing?.conflict ?? 0) +
      negative +
      (ideologicalTension && negative > 0 ? 2 : 0) -
      Math.min(positive, 2),
    0,
    50,
  );
  const partnered = residents[0].partnerId === rawB && residents[1].partnerId === rawA;
  const canPartner = partnered || (!residents[0].partnerId && !residents[1].partnerId);
  const severeConflict = trust <= 20 && conflict >= 4 && sentiment <= 0;
  const repaired = sentiment > 0 || cooperation > 0;
  const breakupRisk = clamp(
    (existing?.breakupRisk ?? 0) + (severeConflict ? 1 : repaired ? -1 : 0),
    0,
    6,
  );
  const previousFightRisk = existing?.fightRisk ?? 0;
  const fightRisk = clamp(
    previousFightRisk +
      (severeConflict ? 2 : sentiment < 0 && conflict >= 5 ? 1 : repaired ? -1 : 0),
    0,
    5,
  );
  const fightOccurred = attackers.size > 0;
  const shouldSeparate = partnered && breakupRisk >= 3;
  const former = shouldSeparate || existing?.divorcedAt !== undefined;
  let stage = relationshipStage({
    familiarity,
    trust,
    affection,
    conflict,
    conversations,
    partnered: partnered && !shouldSeparate,
    canPartner: canPartner && !shouldSeparate,
    former,
    breakupRisk,
  });
  if (shouldSeparate) stage = '前伴侣';
  const becameMarried = stage === '夫妻' && existing?.marriedAt === undefined;
  const relationship = {
    worldId,
    player1,
    player2,
    familiarity,
    trust,
    affection,
    conflict,
    stage,
    conversations,
    breakupRisk,
    marriedAt: stage === '夫妻' ? (existing?.marriedAt ?? conversation.ended) : existing?.marriedAt,
    divorcedAt: shouldSeparate ? conversation.ended : existing?.divorcedAt,
    divorceCount: (existing?.divorceCount ?? 0) + (shouldSeparate ? 1 : 0),
    fightRisk: fightOccurred ? 0 : fightRisk,
    fights: (existing?.fights ?? 0) + (fightOccurred ? 1 : 0),
    lastFightAt: fightOccurred ? conversation.ended : existing?.lastFightAt,
    lastInteractionAt: conversation.ended,
  };
  if (existing) await ctx.db.replace(existing._id, relationship);
  else await ctx.db.insert('societyRelationships', relationship);

  for (const resident of residents as [Doc<'societyResidents'>, Doc<'societyResidents'>]) {
    await ctx.db.patch(resident._id, {
      reputation: clamp(resident.reputation + (sentiment > 0 ? 1 : sentiment < 0 ? -1 : 0), 0, 100),
      lastUpdated: Date.now(),
    });
  }

  if (fightOccurred) {
    const state = await ctx.db
      .query('societyWorlds')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .unique();
    const baseDamage = clamp(10 + Math.floor(conflict / 3), 10, 25);
    const firstAttacks = attackers.has(rawA);
    const secondAttacks = attackers.has(rawB);
    const damages: [number, number] = [
      secondAttacks ? baseDamage : 0,
      firstAttacks ? baseDamage : 0,
    ];
    const healthAfter: [number, number] = [
      clamp((residents[0].health ?? 100) - damages[0], 0, 100),
      clamp((residents[1].health ?? 100) - damages[1], 0, 100),
    ];
    for (let index = 0; index < residents.length; index += 1) {
      if (damages[index] <= 0) continue;
      await ctx.db.patch(residents[index]!._id, {
        health: healthAfter[index],
        injuredAt: conversation.ended,
        currentPlan: healthAfter[index] > 0 ? '因冲突受伤，考虑是否前往诊所' : '生命垂危',
        lastUpdated: Date.now(),
      });
    }
    const now = Date.now();
    await ctx.db.insert('societyEvents', {
      worldId,
      title: `${[firstAttacks ? residents[0].name : null, secondAttacks ? residents[1].name : null].filter(Boolean).join('、')}选择发动攻击`,
      description: `${ideologicalTension ? '派系分歧与' : ''}现实矛盾提供了动手机会，但攻击来自居民自己的明确选择。${residents[0].name}损失${damages[0]}点、${residents[1].name}损失${damages[1]}点生命值。`,
      kind: 'conflict',
      status: 'active',
      simulatedDay: state?.simulatedDay ?? 1,
      startedAt: now,
      endsAt: now + SIMULATED_DAY_MS,
      effects: ['居民自主选择攻击或克制', '冲突风险暂时清零', '伤者可以自行决定是否求医'],
    });
    for (let index = 0; index < residents.length; index += 1) {
      if (healthAfter[index] <= 0) {
        await recordDeath(
          ctx,
          worldId,
          residents[index]!,
          `与${residents[index === 0 ? 1 : 0]!.name}的严重冲突`,
          state?.simulatedDay ?? 1,
        );
      }
    }
  }

  if (shouldSeparate) {
    const wasMarried = existing?.marriedAt !== undefined || existing?.stage === '夫妻';
    await ctx.db.patch(residents[0]._id, { partnerId: undefined, householdId: undefined });
    await ctx.db.patch(residents[1]._id, { partnerId: undefined, householdId: undefined });
    const state = await ctx.db
      .query('societyWorlds')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .unique();
    const now = Date.now();
    await ctx.db.insert('societyEvents', {
      worldId,
      title: `${residents[0].name}与${residents[1].name}${wasMarried ? '离婚' : '分手'}`,
      description: `双方连续多次互动都处于低信任和高冲突状态，关系无法继续维持。`,
      kind: 'relationship',
      status: 'active',
      simulatedDay: state?.simulatedDay ?? 1,
      startedAt: now,
      endsAt: now + SIMULATED_DAY_MS,
      effects: ['解除伴侣与共同家庭状态', '保留共同经历与子女记录', '未来需要更高信任才能复合'],
    });
  }

  if (becameMarried) {
    const state = await ctx.db
      .query('societyWorlds')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .unique();
    const now = Date.now();
    await ctx.db.insert('societyEvents', {
      worldId,
      title: `${residents[0].name}与${residents[1].name}结婚`,
      description: '双方在长期高信任和高亲近度的关系中决定建立正式家庭。',
      kind: 'relationship',
      status: 'active',
      simulatedDay: state?.simulatedDay ?? 1,
      startedAt: now,
      endsAt: now + SIMULATED_DAY_MS,
      effects: ['伴侣关系升级为夫妻', '建立长期共同家庭', '未来可以形成子女记录'],
    });
  }

  if (
    (stage === '伴侣' || stage === '夫妻') &&
    !residents[0].partnerId &&
    !residents[1].partnerId
  ) {
    const householdId = `家庭-${residents[0].name}-${residents[1].name}`;
    await ctx.db.patch(residents[0]._id, { partnerId: rawB, householdId });
    await ctx.db.patch(residents[1]._id, { partnerId: rawA, householdId });
  }
  if (stage === '夫妻' && conversations >= 35 && residents[0].children.length === 0) {
    const childName = `${residents[0].name.slice(0, 1)}${residents[1].name.slice(0, 1)}家的孩子`;
    await ctx.db.patch(residents[0]._id, { children: [childName] });
    await ctx.db.patch(residents[1]._id, { children: [childName] });
  }

  await civicConversation(ctx, worldId, conversationMessages, [rawA, rawB]);
  await ctx.db.insert('societyProcessedConversations', {
    worldId,
    conversationId: conversation.id,
    processedAt: Date.now(),
  });
}

function inventoryQuantity(resident: Doc<'societyResidents'>, item: string) {
  return resident.inventory.find((entry) => entry.item === item)?.quantity ?? 0;
}

function changeInventory(resident: Doc<'societyResidents'>, item: string, delta: number) {
  const inventory = resident.inventory.map((entry) => ({ ...entry }));
  const existing = inventory.find((entry) => entry.item === item);
  if (existing) existing.quantity = Math.max(0, existing.quantity + delta);
  else if (delta > 0) inventory.push({ item, quantity: delta });
  resident.inventory = inventory.filter((entry) => entry.quantity > 0);
}

async function reconcileRelationshipStages(ctx: MutationCtx, worldId: Id<'worlds'>) {
  const [residents, relationships] = await Promise.all([
    ctx.db
      .query('societyResidents')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect(),
    ctx.db
      .query('societyRelationships')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect(),
  ]);
  const byPlayer = new Map(residents.map((resident) => [resident.playerId, resident]));
  for (const relationship of relationships) {
    const first = byPlayer.get(relationship.player1);
    const second = byPlayer.get(relationship.player2);
    if (!first || !second) continue;
    const partnered = first.partnerId === second.playerId && second.partnerId === first.playerId;
    const canPartner = partnered || (!first.partnerId && !second.partnerId);
    const stage = relationshipStage({
      ...relationship,
      partnered,
      canPartner,
      former: relationship.divorcedAt !== undefined,
      breakupRisk: relationship.breakupRisk ?? 0,
    });
    if (stage !== relationship.stage) await ctx.db.patch(relationship._id, { stage });
  }
}

async function maybeSwitchFactions(
  ctx: MutationCtx,
  state: Doc<'societyWorlds'>,
  residents: Doc<'societyResidents'>[],
  day: number,
) {
  const relationships = await ctx.db
    .query('societyRelationships')
    .withIndex('worldId', (q) => q.eq('worldId', state.worldId))
    .collect();
  const byPlayer = new Map(residents.map((resident) => [resident.playerId, resident]));
  for (const resident of residents.filter((item) => item.alive !== false)) {
    if (day - (resident.lastFactionChangeDay ?? 0) < 3) continue;
    let publicScore = 0;
    let autonomyScore = 0;
    if (resident.coins < 80) publicScore += 2;
    if ((resident.health ?? 100) < 70) publicScore += 3;
    if (['医生', '社区服务者', '教师与社区组织者', '科学研究员'].includes(resident.job)) {
      publicScore += 1;
    }
    if (resident.coins > 150) autonomyScore += 2;
    if (['园丁与农夫', '商人与活动策划人', '工匠与建筑师'].includes(resident.job)) {
      autonomyScore += 1;
    }
    if ((resident.values ?? []).some((value) => ['低税', '市场', '自治'].includes(value))) {
      autonomyScore += 2;
    }
    if ((resident.values ?? []).some((value) => ['公共投入', '基本保障', '互助'].includes(value))) {
      publicScore += 2;
    }
    for (const relationship of relationships.filter((item) =>
      [item.player1, item.player2].includes(resident.playerId),
    )) {
      const otherId =
        relationship.player1 === resident.playerId ? relationship.player2 : relationship.player1;
      const other = byPlayer.get(otherId);
      if (!other || relationship.trust <= 0) continue;
      const influence = clamp(Math.floor(relationship.trust / 15), 0, 3);
      if (other.faction === '公共协作派') publicScore += influence;
      if (other.faction === '自由自治派') autonomyScore += influence;
    }
    if (resident.faction === '公共协作派') publicScore += 2;
    if (resident.faction === '自由自治派') autonomyScore += 2;
    const mood = [...`${resident.name}${day}`].reduce(
      (sum, character) => sum + character.charCodeAt(0),
      0,
    );
    if (mood % 5 === 0) publicScore += 1;
    if (mood % 5 === 1) autonomyScore += 1;
    const target = publicScore > autonomyScore ? '公共协作派' : '自由自治派';
    if (target === resident.faction || Math.abs(publicScore - autonomyScore) < 3) continue;
    const oldFaction = resident.faction ?? '无党派';
    await ctx.db.patch(resident._id, { faction: target, lastFactionChangeDay: day });
    const now = Date.now();
    await ctx.db.insert('societyEvents', {
      worldId: state.worldId,
      title: `${resident.name}改变派系`,
      description: `${resident.name}根据自身经济状况、健康需求和信任的人际网络，从“${oldFaction}”转向“${target}”。`,
      kind: 'faction',
      status: 'active',
      simulatedDay: day,
      startedAt: now,
      endsAt: now + SIMULATED_DAY_MS,
      effects: ['改变未来投票倾向', '影响跨派系互动', '至少三日内不会再次转派'],
    });
  }
}

async function applySocialTension(
  ctx: MutationCtx,
  state: Doc<'societyWorlds'>,
  first: Doc<'societyResidents'>,
  second: Doc<'societyResidents'>,
  changes: { conflict: number; trust: number; fightRisk: number },
) {
  const [player1, player2] = canonicalPair(first.playerId, second.playerId);
  const existing = await ctx.db
    .query('societyRelationships')
    .withIndex('pair', (q) =>
      q.eq('worldId', state.worldId).eq('player1', player1).eq('player2', player2),
    )
    .unique();
  const conflict = clamp((existing?.conflict ?? 0) + changes.conflict, 0, 50);
  const trust = clamp((existing?.trust ?? 0) + changes.trust, -30, 50);
  const affection = existing?.affection ?? 0;
  const familiarity = existing?.familiarity ?? 0;
  const conversations = existing?.conversations ?? 0;
  const breakupRisk = clamp((existing?.breakupRisk ?? 0) + (changes.conflict >= 4 ? 1 : 0), 0, 6);
  const partnered = first.partnerId === second.playerId && second.partnerId === first.playerId;
  const stage = relationshipStage({
    familiarity,
    trust,
    affection,
    conflict,
    conversations,
    partnered,
    canPartner: partnered || (!first.partnerId && !second.partnerId),
    former: existing?.divorcedAt !== undefined,
    breakupRisk,
  });
  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, {
      trust,
      conflict,
      stage,
      breakupRisk,
      fightRisk: clamp((existing.fightRisk ?? 0) + changes.fightRisk, 0, 5),
      lastInteractionAt: now,
    });
  } else {
    await ctx.db.insert('societyRelationships', {
      worldId: state.worldId,
      player1,
      player2,
      familiarity,
      trust,
      affection,
      conflict,
      stage,
      conversations,
      breakupRisk,
      fightRisk: clamp(changes.fightRisk, 0, 5),
      fights: 0,
      divorceCount: 0,
      lastInteractionAt: now,
    });
  }
  return {
    conflict,
    trust,
    fightRisk: clamp((existing?.fightRisk ?? 0) + changes.fightRisk, 0, 5),
  };
}

export async function createDailyTension(
  ctx: MutationCtx,
  state: Doc<'societyWorlds'>,
  residents: Doc<'societyResidents'>[],
  day: number,
) {
  if (residents.length < 2) return;
  const tensionKinds = ['tension-food', 'tension-election', 'tension-medical', 'tension-debt',
    'tension-jealousy', 'tension-property', 'tension-faction'];
  const currentTension = await ctx.db
    .query('societyEvents')
    .withIndex('worldId', (q) => q.eq('worldId', state.worldId))
    .order('desc')
    .filter(q => q.and(q.eq(q.field('simulatedDay'), day),
      q.or(...tensionKinds.map(kind => q.eq(q.field('kind'), kind)))))
    .first();
  // Historical event prose is not an action queue. Never replay or rewrite it.
  if (currentTension) return;
  const relationships = await ctx.db
    .query('societyRelationships')
    .withIndex('worldId', (q) => q.eq('worldId', state.worldId))
    .collect();
  const byName = new Map(residents.map((resident) => [resident.name, resident]));
  const residentById = new Map(residents.map((resident) => [resident.playerId, resident]));
  const crossFactionPairs = relationships
    .map((relationship) => ({
      relationship,
      first: residentById.get(relationship.player1),
      second: residentById.get(relationship.player2),
    }))
    .filter((pair) => pair.first && pair.second && pair.first.faction !== pair.second.faction)
    .sort(
      (a, b) =>
        b.relationship.conflict - a.relationship.conflict ||
        a.relationship.trust - b.relationship.trust,
    );
  const fallbackPair =
    crossFactionPairs[0] ??
    ({
      first: residents[day % residents.length],
      second: residents[(day + 1) % residents.length],
    } as const);
  let first = fallbackPair.first!;
  let second = fallbackPair.second!;
  let title = '';
  let description = '';
  let kind = '';
  let changes = { conflict: 5, trust: -4, fightRisk: 2 };

  switch (day % 7) {
    case 0: {
      first = byName.get('鲍勃') ?? first;
      second = residents
        .filter((resident) => resident.playerId !== first.playerId)
        .sort((a, b) => a.coins - b.coins || b.hunger - a.hunger)[0]!;
      title = `${first.name}与${second.name}爆发食物价格争议`;
      description = `${second.name}认为基本食物价格和供应不公平，${first.name}则坚持劳动与经营成本必须得到尊重。`;
      kind = 'tension-food';
      changes = { conflict: 5, trust: -4, fightRisk: 2 };
      break;
    }
    case 1: {
      first = residents.find((resident) => resident.playerId === state.mayorId) ?? first;
      second =
        residents
          .filter(
            (resident) =>
              resident.playerId !== first.playerId &&
              resident.playerId !== first.partnerId &&
              resident.faction !== first.faction,
          )
          .sort((a, b) => {
            const trustWithMayor = (resident: Doc<'societyResidents'>) =>
              relationships.find(
                (relationship) =>
                  [relationship.player1, relationship.player2].includes(first.playerId) &&
                  [relationship.player1, relationship.player2].includes(resident.playerId),
              )?.trust ?? 0;
            return trustWithMayor(a) - trustWithMayor(b) || b.reputation - a.reputation;
          })[0] ?? second;
      title = `${second.name}质疑${first.name}的选举与执政`;
      description = `${second.name}认为本派利益在选举后被忽视，并公开要求${first.name}解释预算和政策选择。`;
      kind = 'tension-election';
      changes = { conflict: 5, trust: -4, fightRisk: 2 };
      break;
    }
    case 2: {
      first = byName.get('林岚') ?? first;
      second = residents
        .filter((resident) => resident.playerId !== first.playerId)
        .sort((a, b) => (a.health ?? 100) - (b.health ?? 100) || a.coins - b.coins)[0]!;
      title = `${first.name}与${second.name}发生医疗费用争议`;
      description = `${second.name}质疑诊所的费用和接诊次序，${first.name}则强调医疗资源、精力和药品都有限。`;
      kind = 'tension-medical';
      changes = { conflict: 5, trust: -4, fightRisk: 2 };
      break;
    }
    case 3: {
      first = byName.get('斯黛拉') ?? first;
      second = residents
        .filter((resident) => resident.playerId !== first.playerId)
        .sort((a, b) => a.coins - b.coins)[0]!;
      title = `${first.name}追讨${second.name}的交易欠款`;
      description = `${first.name}指责${second.name}没有按约定结清市场服务费用，${second.name}则否认账目公平。`;
      kind = 'tension-debt';
      changes = { conflict: 5, trust: -5, fightRisk: 2 };
      break;
    }
    case 4: {
      const partnered = residents.find((resident) => resident.partnerId);
      if (partnered) {
        first = partnered;
        second = residentById.get(partnered.partnerId!) ?? second;
        const third = residents.find(
          (resident) =>
            resident.playerId !== first.playerId && resident.playerId !== second.playerId,
        );
        title = `${first.name}与${second.name}因亲密传闻争吵`;
        description = `关于${second.name}和${third?.name ?? '另一位居民'}过度亲密的传闻传开，${first.name}要求对方作出解释。`;
      } else {
        title = `${first.name}散布关于${second.name}的传闻`;
        description = `一则未经证实的私人传闻损害了${second.name}的名誉，双方互相指责。`;
      }
      kind = 'tension-jealousy';
      changes = { conflict: 5, trust: -4, fightRisk: 2 };
      break;
    }
    case 5: {
      first = residents.slice().sort((a, b) => b.coins - a.coins)[0]!;
      second = residents
        .filter((resident) => resident.playerId !== first.playerId)
        .sort((a, b) => a.coins - b.coins)[0]!;
      title = `${first.name}指控${second.name}偷窃财物`;
      description = `${first.name}发现个人财物失踪并公开怀疑${second.name}，但目前没有足够证据，双方拒绝退让。`;
      kind = 'tension-property';
      changes = { conflict: 6, trust: -5, fightRisk: 2 };
      break;
    }
    default: {
      title = `${first.name}与${second.name}发生派系路线冲突`;
      description = `公共协作与自由自治的路线争议从政策讨论升级为针对彼此动机的公开指责。`;
      kind = 'tension-faction';
      changes = { conflict: 5, trust: -4, fightRisk: 2 };
    }
  }

  if (first.playerId === second.playerId) return;
  const result = await applySocialTension(ctx, state, first, second, changes);
  const now = Date.now();
  await ctx.db.insert('societyEvents', {
    worldId: state.worldId,
    title,
    description: `${description}是否攻击由居民明确选择，争执本身不扣除生命值。`,
    kind,
    status: 'active',
    simulatedDay: day,
    startedAt: now,
    endsAt: now + SIMULATED_DAY_MS,
    effects: [
      `${first.name}与${second.name}的信任降至${result.trust}`,
      `冲突升至${result.conflict}`,
      `打斗风险升至${result.fightRisk}/5，仅影响居民决策，不自动执行攻击`,
      '争执不扣血；只有居民明确选择攻击才会结算伤害',
    ],
  });
}

async function recordTransaction(
  ctx: MutationCtx,
  args: Omit<Doc<'societyTransactions'>, '_id' | '_creationTime'>,
) {
  await ctx.db.insert('societyTransactions', args);
}

async function runEconomy(
  ctx: MutationCtx,
  state: Doc<'societyWorlds'>,
  residentsInput: Doc<'societyResidents'>[],
  day: number,
) {
  const livingInput = residentsInput.filter((resident) => resident.alive !== false);
  const residents = livingInput.map((resident) => ({
    ...resident,
    inventory: resident.inventory.map((i) => ({ ...i })),
  }));
  const byName = new Map(residents.map((resident) => [resident.name, resident]));
  let treasury = state.treasury;
  const now = Date.now();

  const construction = await ctx.db.query('civicProjects').withIndex('worldId',q=>q.eq('worldId',state.worldId)).collect();
  const built = new Set(construction.filter(p=>p.status==='completed').map(p=>p.key));
  for (const resident of residents) {
    const profile = jobProfiles[resident.name] ?? fallbackProfile;
    let quantity =
      resident.name === '鲍勃'
        ? Math.max(profile.quantity, residents.length + 1)
        : profile.quantity;
    if (resident.name === '鲍勃') quantity = Math.max(2,quantity-(day%6===0?3:0)+(built.has('market')?2:0));
    if (resident.job === '医生' && built.has('hospital')) quantity += 1;
    const stockCap = profile.output === '食物' ? 30 : profile.output === '建筑材料' ? 24 : 10;
    changeInventory(resident, profile.output, Math.max(0,Math.min(quantity,stockCap-inventoryQuantity(resident,profile.output))));
    resident.hunger = clamp(resident.hunger + 28, 0, 100);
    resident.energy = clamp(resident.energy - (built.has('bridge') ? 5 : 8), 20, 100);
    if (resident.reputation > 55) resident.reputation -= 1;
  }

  // A small, broad civic contribution makes recurring services sustainable and
  // prevents one profession from carrying the entire tax base.
  for (const resident of residents) {
    if (resident.coins <= 20) continue;
    resident.coins -= 1;
    treasury += 1;
    await recordTransaction(ctx, {
      worldId: state.worldId,
      simulatedDay: day,
      fromPlayerId: resident.playerId,
      item: '居民税',
      quantity: 1,
      total: 1,
      tax: 1,
      createdAt: now,
    });
  }

  const activeLaws = await ctx.db
    .query('societyLaws')
    .withIndex('worldId', (q) => q.eq('worldId', state.worldId))
    .order('desc')
    .take(20);
  const foodPrice = Math.max(2,(activeLaws.some((law) => law.active && law.title === '基本食物保障法') ? 3 : 5)-(built.has('market')?1:0));
  const farmer = byName.get('鲍勃');
  const merchant = byName.get('斯黛拉');
  if (farmer) {
    for (const buyer of residents) {
      if (buyer.hunger < 30 || inventoryQuantity(farmer, '食物') <= 0) continue;
      if (buyer.playerId === farmer.playerId) {
        changeInventory(farmer, '食物', -1);
        buyer.hunger = clamp(buyer.hunger - 45, 0, 100);
        continue;
      }
      if (buyer.coins < foodPrice) continue;
      const tax = Math.max(1, Math.round(foodPrice * state.taxRate));
      buyer.coins -= foodPrice;
      farmer.coins += foodPrice - tax;
      treasury += tax;
      changeInventory(farmer, '食物', -1);
      buyer.hunger = clamp(buyer.hunger - 45, 0, 100);
      await recordTransaction(ctx, {
        worldId: state.worldId,
        simulatedDay: day,
        fromPlayerId: buyer.playerId,
        toPlayerId: farmer.playerId,
        item: '食物',
        quantity: 1,
        total: foodPrice,
        tax,
        createdAt: now,
      });
      if (merchant && merchant.playerId !== buyer.playerId && farmer.coins > 0) {
        farmer.coins -= 1;
        merchant.coins += 1;
        await recordTransaction(ctx, {
          worldId: state.worldId,
          simulatedDay: day,
          fromPlayerId: farmer.playerId,
          toPlayerId: merchant.playerId,
          item: '市场服务',
          quantity: 1,
          total: 1,
          tax: 0,
          createdAt: now,
        });
      }
    }
  }

  const publicPurchases = [
    day % 2 === 0
      ? { name: '乐乐', item: '小镇新闻', price: 5 }
      : { name: '皮特', item: '社区服务', price: 5 },
    ...(activeLaws.some((law) => law.active && law.title === '公共研究资助法')
      ? [{ name: '爱丽丝', item: '研究成果', price: 8 }]
      : []),
    [
      { name: '林岚', item: '医疗服务', price: 6 },
      { name: '周石', item: '建筑材料', price: 7 },
      { name: '苏菲', item: '教育服务', price: 6 },
    ][day % 3],
  ];
  for (const purchase of publicPurchases) {
    const seller = byName.get(purchase.name);
    if (!seller || inventoryQuantity(seller, purchase.item) <= 0 || treasury - purchase.price < 40)
      continue;
    changeInventory(seller, purchase.item, -1);
    seller.coins += purchase.price;
    treasury -= purchase.price;
    await recordTransaction(ctx, {
      worldId: state.worldId,
      simulatedDay: day,
      toPlayerId: seller.playerId,
      item: purchase.item,
      quantity: 1,
      total: purchase.price,
      tax: 0,
      createdAt: now,
    });
  }

  const doctor = byName.get('林岚');
  const healthcareLaw = activeLaws.some((law) => law.active && law.title === '基本医疗保障法');
  if (doctor) {
    const relationships = await ctx.db
      .query('societyRelationships')
      .withIndex('worldId', (q) => q.eq('worldId', state.worldId))
      .collect();
    for (const patient of residents.filter((resident) => (resident.health ?? 100) < 85)) {
      const price = 8;
      const selfTreatment = patient.playerId === doctor.playerId;
      const publiclyFunded = !selfTreatment && healthcareLaw && treasury - price >= 30;
      const health = patient.health ?? 100;
      const relationship = relationships.find(
        (item) =>
          [item.player1, item.player2].includes(patient.playerId) &&
          [item.player1, item.player2].includes(doctor.playerId),
      );
      const decisionSeed = [...`${patient.name}${day}求医`].reduce(
        (sum, character) => sum + character.charCodeAt(0),
        0,
      );
      const patientScore =
        (85 - health) / 10 +
        (patient.faction === '公共协作派' ? 2 : 0) +
        (health <= 35 ? 5 : 0) +
        (publiclyFunded ? 1 : 0) +
        ((decisionSeed % 5) - 2) -
        (!publiclyFunded && patient.coins < price ? 5 : 0);
      const seeksTreatment = patient.playerId === doctor.playerId ? health < 70 : patientScore >= 3;
      if (!seeksTreatment) {
        patient.currentPlan = '选择暂不去医院，自行休养并承担伤势风险';
        await ctx.db.insert('societyEvents', {
          worldId: state.worldId,
          title: `${patient.name}决定不去医院`,
          description: `${patient.name}综合伤势、费用、派系观念与个人判断后，选择暂时不接受治疗。`,
          kind: 'health-choice',
          status: 'active',
          simulatedDay: day,
          startedAt: now,
          endsAt: now + SIMULATED_DAY_MS,
          effects: ['生命值不恢复', '保留下一日重新选择的机会'],
        });
        continue;
      }
      if (!selfTreatment && !publiclyFunded && patient.coins < price) {
        patient.currentPlan = '希望就医，但暂时无法承担治疗费';
        await applySocialTension(ctx, state, doctor, patient, {
          conflict: 2,
          trust: -1,
          fightRisk: 0,
        });
        continue;
      }
      if (patient.playerId !== doctor.playerId && inventoryQuantity(doctor, '医疗服务') <= 0) {
        patient.currentPlan = '希望就医，但诊所暂时缺少医疗资源';
        continue;
      }
      const doctorSeed = [...`${doctor.name}${patient.name}${day}接诊`].reduce(
        (sum, character) => sum + character.charCodeAt(0),
        0,
      );
      const doctorScore =
        2 +
        (70 - health) / 12 +
        (relationship?.trust ?? 0) / 12 -
        (relationship?.conflict ?? 0) / 6 +
        (doctor.faction === patient.faction ? 1 : 0) +
        (doctor.energy > 35 ? 1 : -2) +
        (publiclyFunded || patient.coins >= price ? 1 : 0) +
        ((doctorSeed % 5) - 2);
      const doctorAccepts =
        patient.playerId === doctor.playerId || health <= 30 || doctorScore >= 2;
      if (!doctorAccepts) {
        patient.currentPlan = '求医遭到拒绝，寻找其他恢复办法';
        const refusalTension = await applySocialTension(ctx, state, doctor, patient, {
          conflict: 5,
          trust: -4,
          fightRisk: 2,
        });
        await ctx.db.insert('societyEvents', {
          worldId: state.worldId,
          title: `林岚拒绝为${patient.name}治疗`,
          description: `林岚综合精力、医疗资源、双方关系与伤势后，没有接受${patient.name}的治疗请求。`,
          kind: 'health-choice',
          status: 'active',
          simulatedDay: day,
          startedAt: now,
          endsAt: now + SIMULATED_DAY_MS,
          effects: [
            '患者未获得治疗',
            `双方冲突升至${refusalTension.conflict}`,
            `打斗风险升至${refusalTension.fightRisk}/5`,
          ],
        });
        continue;
      }
      if (!selfTreatment) {
        changeInventory(doctor, '医疗服务', -1);
        doctor.coins += price;
        doctor.energy = clamp(doctor.energy - 6, 10, 100);
      }
      if (publiclyFunded) treasury -= price;
      else if (!selfTreatment) patient.coins -= price;
      const before = health;
      patient.health = clamp(before + 25, 0, 100);
      if (!selfTreatment) {
        await recordTransaction(ctx, {
          worldId: state.worldId,
          simulatedDay: day,
          fromPlayerId: publiclyFunded ? undefined : patient.playerId,
          toPlayerId: doctor.playerId,
          item: '伤病治疗',
          quantity: 1,
          total: price,
          tax: 0,
          createdAt: now,
        });
      }
      await ctx.db.insert('societyEvents', {
        worldId: state.worldId,
        title: `${patient.name}接受林岚治疗`,
        description: `${patient.name}的生命值由${before}恢复到${patient.health}。${selfTreatment ? '医生进行了自我处置。' : publiclyFunded ? '费用由小镇财政承担。' : '费用由本人支付。'}`,
        kind: 'health',
        status: 'active',
        simulatedDay: day,
        startedAt: now,
        endsAt: now + SIMULATED_DAY_MS,
        effects: [
          '恢复25点生命值',
          selfTreatment ? '医生自我处置' : publiclyFunded ? '财政支付医疗费' : '患者支付医疗费',
        ],
      });
    }
  }

  for (const resident of residents) {
    const original = livingInput.find((item) => item._id === resident._id)!;
    await ctx.db.patch(original._id, {
      coins: resident.coins,
      hunger: resident.hunger,
      energy: resident.energy,
      health: resident.health ?? 100,
      reputation: resident.reputation,
      inventory: resident.inventory,
      lastUpdated: now,
    });
  }
  return treasury;
}

async function createDailyEvent(
  ctx: MutationCtx,
  state: Doc<'societyWorlds'>,
  residents: Doc<'societyResidents'>[],
  day: number,
) {
  const existing = await ctx.db
    .query('societyEvents')
    .withIndex('worldId', (q) => q.eq('worldId', state.worldId))
    .order('desc')
    .take(10);
  if (existing.some((event) => event.simulatedDay === day)) return;
  const now = Date.now();
  for (const event of existing.filter((item) => item.status === 'active')) {
    await ctx.db.patch(event._id, { status: 'completed' });
  }
  const templates = [
    {
      title: '镇民大会',
      description: '居民围绕公共预算、食物供应和社区秩序交换意见。',
      kind: 'governance',
      effects: ['提高公共议题的讨论概率', '为新法律提供表决机会'],
    },
    {
      title: '丰收集市',
      description: '果园迎来集中采收，集市开放额外摊位，食物供应增加。',
      kind: 'economy',
      effects: ['鲍勃额外获得3份食物', '斯黛拉的市场声誉提高'],
    },
    {
      title: '科学开放日',
      description: '爱丽丝公开展示研究成果，居民可以讨论科学发现及其用途。',
      kind: 'science',
      effects: ['爱丽丝声誉提高', '公共研究投入增加'],
    },
    {
      title: '社区互助日',
      description: '皮特组织居民检查彼此的生活需求，并鼓励冲突双方寻找共同点。',
      kind: 'community',
      effects: ['社区服务需求提高', '高冲突关系获得缓和机会'],
    },
    {
      title: '公共健康日',
      description: '林岚开放诊所并向居民说明公共卫生和疾病预防。',
      kind: 'health',
      effects: ['林岚声誉提高', '小镇财政采购医疗服务'],
    },
    {
      title: '公共维修日',
      description: '周石带领居民检修道路、住宅与公共设施。',
      kind: 'infrastructure',
      effects: ['周石声誉提高', '小镇消耗建筑材料'],
    },
    {
      title: '公民课堂',
      description: '苏菲组织居民学习法律、预算和选举制度，并公开讨论政策。',
      kind: 'education',
      effects: ['苏菲声誉提高', '公共议题参与度提升'],
    },
  ];
  const template = templates[day % templates.length];
  await ctx.db.insert('societyEvents', {
    worldId: state.worldId,
    ...template,
    status: 'active',
    simulatedDay: day,
    startedAt: now,
    endsAt: now + SIMULATED_DAY_MS,
  });
  if (template.kind === 'economy') {
    const bob = residents.find((resident) => resident.name === '鲍勃');
    const stella = residents.find((resident) => resident.name === '斯黛拉');
    if (bob) {
      const inventory = bob.inventory.map((entry) => ({ ...entry }));
      const food = inventory.find((entry) => entry.item === '食物');
      if (food) food.quantity += 3;
      else inventory.push({ item: '食物', quantity: 3 });
      await ctx.db.patch(bob._id, { inventory });
    }
    if (stella)
      await ctx.db.patch(stella._id, { reputation: clamp(stella.reputation + 2, 0, 100) });
  }
  if (template.kind === 'science') {
    const alice = residents.find((resident) => resident.name === '爱丽丝');
    if (alice) await ctx.db.patch(alice._id, { reputation: clamp(alice.reputation + 2, 0, 100) });
  }
  if (
    template.kind === 'health' ||
    template.kind === 'infrastructure' ||
    template.kind === 'education'
  ) {
    const featuredName =
      template.kind === 'health' ? '林岚' : template.kind === 'infrastructure' ? '周石' : '苏菲';
    const featured = residents.find((resident) => resident.name === featuredName);
    if (featured)
      await ctx.db.patch(featured._id, {
        reputation: clamp(featured.reputation + 2, 0, 100),
      });
  }
  if (template.kind === 'community') {
    const relationships = await ctx.db
      .query('societyRelationships')
      .withIndex('worldId', (q) => q.eq('worldId', state.worldId))
      .collect();
    for (const relationship of relationships.filter((item) => item.conflict > 0)) {
      await ctx.db.patch(relationship._id, { conflict: Math.max(0, relationship.conflict - 1) });
    }
  }
}

async function maybeEnactLaw(
  ctx: MutationCtx,
  state: Doc<'societyWorlds'>,
  residents: Doc<'societyResidents'>[],
  day: number,
) {
  if (day < 2) return state.taxRate;
  const recent = await ctx.db
    .query('societyLaws')
    .withIndex('worldId', (q) => q.eq('worldId', state.worldId))
    .order('desc')
    .take(20);
  if (recent.some((law) => law.simulatedDay === day)) return state.taxRate;
  if (recent.length > 0 && day % 3 !== 0) return state.taxRate;
  const proposals = [
    {
      title: '基本食物保障法',
      description: '用公共资金降低居民购买基本食物的价格。',
      category: '民生',
    },
    {
      title: '公共研究资助法',
      description: '每天由小镇财政购买一份研究成果并公开分享。',
      category: '科研',
    },
    {
      title: '公平集市税法',
      description: '将交易税调整为10%，用于公共活动与食物保障。',
      category: '经济',
    },
    {
      title: '基本医疗保障法',
      description: '受伤居民无力支付治疗费时，由公共财政提供基本医疗保障。',
      category: '医疗',
    },
    {
      title: '冲突调解条例',
      description: '资助社区调解，但不禁止居民表达反对意见。',
      category: '秩序',
    },
    {
      title: '公共建设预算案',
      description: '在保留财政安全线的前提下采购道路与住房维修材料。',
      category: '建设',
    },
  ];
  const activeTitles = new Set(recent.filter((law) => law.active).map((law) => law.title));
  const candidates = proposals.filter((proposal) => !activeTitles.has(proposal.title));
  if (candidates.length === 0) return state.taxRate;
  const proposal = candidates[Math.floor(day / 3) % candidates.length];
  const sponsor =
    state.mayorId ?? residents.slice().sort((a, b) => b.reputation - a.reputation)[0]?.playerId;
  const policyPreferences: Record<string, Record<string, number>> = {
    民生: { 基本保障: 3, 互助: 2, 市场: -2, 低税: -2, 农业: -1 },
    科研: { 科研: 4, 公共投入: 1, 低税: -2, 财政稳健: -1 },
    经济: { 公平: 2, 公共投入: 1, 低税: -4, 市场: -2, 财政稳健: -1 },
    医疗: { 医疗: 5, 基本保障: 3, 互助: 1, 低税: -2, 财政稳健: -1 },
    秩序: { 秩序: 4, 互助: 2, 自治: -2, 开放: -1 },
    建设: { 建设: 5, 劳动: 2, 公共投入: 1, 低税: -1, 财政稳健: 1 },
  };
  const votesFor = residents.filter((resident) => {
    const preferences = policyPreferences[proposal.category] ?? {};
    let score = (resident.values ?? []).reduce(
      (total, value) => total + (preferences[value] ?? 0),
      0,
    );
    const publicPolicy = ['民生', '科研', '医疗', '秩序', '建设'].includes(proposal.category);
    if (resident.faction === '公共协作派') score += publicPolicy ? 2 : -1;
    if (resident.faction === '自由自治派') score += publicPolicy ? -2 : 2;
    if (resident.playerId === sponsor) score += 2;
    if (proposal.category === '民生' && (resident.coins < 70 || resident.hunger > 45)) score += 2;
    if (proposal.category === '医疗' && (resident.health ?? 100) < 80) score += 3;
    if (state.treasury < 60 && ['科研', '医疗', '建设'].includes(proposal.category)) score -= 2;
    const deterministic = [...`${resident.name}${proposal.title}`].reduce(
      (sum, character) => sum + character.charCodeAt(0),
      0,
    );
    score += deterministic % 3 === 0 ? -1 : deterministic % 3 === 1 ? 0 : 1;
    return score > 0;
  }).length;
  const votesAgainst = residents.length - votesFor;
  const active = votesFor > votesAgainst;
  await ctx.db.insert('societyLaws', {
    worldId: state.worldId,
    ...proposal,
    enactedAt: Date.now(),
    simulatedDay: day,
    sponsorId: sponsor,
    votesFor,
    votesAgainst,
    active,
  });
  return active && proposal.title === '公平集市税法' ? 0.1 : state.taxRate;
}

async function maybeHoldElection(
  ctx: MutationCtx,
  state: Doc<'societyWorlds'>,
  residents: Doc<'societyResidents'>[],
  day: number,
) {
  if (day < 2 || day - state.lastElectionDay < 7) return null;
  const relationships = await ctx.db
    .query('societyRelationships')
    .withIndex('worldId', (q) => q.eq('worldId', state.worldId))
    .collect();
  const factionCounts = new Map<string, number>();
  for (const resident of residents) {
    factionCounts.set(
      resident.faction ?? '独立居民',
      (factionCounts.get(resident.faction ?? '独立居民') ?? 0) + 1,
    );
  }
  const scored = residents.map((resident) => ({
    resident,
    score:
      resident.reputation * 0.45 +
      resident.coins * 0.025 +
      (factionCounts.get(resident.faction ?? '独立居民') ?? 1) * 1.5 +
      (state.mayorId === resident.playerId ? -6 : 0) +
      relationships
        .filter((relationship) =>
          [relationship.player1, relationship.player2].includes(resident.playerId),
        )
        .reduce((sum, relationship) => sum + relationship.trust - relationship.conflict, 0),
  }));
  scored.sort(
    (a, b) => b.score - a.score || a.resident.name.localeCompare(b.resident.name, 'zh-CN'),
  );
  const winner = scored[0]?.resident;
  if (!winner) return null;
  await ctx.db.patch(winner._id, { reputation: clamp(winner.reputation + 5, 0, 100) });
  await ctx.db.insert('societyEvents', {
    worldId: state.worldId,
    title: `${winner.name}当选小镇市长`,
    description: `居民根据声誉、社会信任和经济表现完成了第${day}日选举。`,
    kind: 'election',
    status: 'active',
    simulatedDay: day,
    startedAt: Date.now(),
    endsAt: Date.now() + SIMULATED_DAY_MS,
    effects: [`${winner.name}获得市长身份`, '市长可以发起下一轮公共法律提案'],
  });
  return winner.playerId;
}

async function runSocietyTick(ctx: MutationCtx, worldId: Id<'worlds'>, processLimit = 80) {
  let state = await ensureSociety(ctx, worldId);
  const status = await ctx.db.query('worldStatus').withIndex('worldId', q => q.eq('worldId', worldId)).unique();
  const engine = status ? await ctx.db.get(status.engineId) : null;
  // A stopped or stale engine must not advance society using wall-clock time.
  // restartDeadWorlds rebases the clock before simulation may proceed.
  if (!engine?.running || status?.status !== 'running' ||
      !engine.currentTime || Date.now() - engine.currentTime > 60_000) return state;
  const archived = await ctx.db
    .query('archivedConversations')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .order('desc')
    .take(processLimit);
  for (const conversation of archived.slice().reverse()) {
    await processConversation(ctx, worldId, conversation);
  }
  await reconcileRelationshipStages(ctx, worldId);

  const now = engine.currentTime;
  const day = Math.max(state.simulatedDay, Math.floor((now - state.simStartedAt) / SIMULATED_DAY_MS) + 1);
  await ensureSeason(ctx,worldId,day);
  const phaseIndex = Math.floor(
    ((now - state.simStartedAt) % SIMULATED_DAY_MS) / (SIMULATED_DAY_MS / 3),
  );
  let residents = await ctx.db
    .query('societyResidents')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .collect();
  for (const resident of residents) {
    if (resident.alive === false) continue;
    const plan = resident.dailyPlan[Math.min(phaseIndex, resident.dailyPlan.length - 1)];
    await ctx.db.patch(resident._id, {
      currentPlan: `${plan.activity}（${plan.location}）`,
      energy: phaseIndex === 0 ? Math.max(resident.energy, 75) : resident.energy,
      lastUpdated: now,
    });
  }
  residents = await ctx.db
    .query('societyResidents')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .collect();
  let livingResidents = residents.filter((resident) => resident.alive !== false);

  let treasury = state.treasury;
  if (day > state.lastEconomyDay) {
    await maybeSwitchFactions(ctx, state, livingResidents, day);
    residents = await ctx.db
      .query('societyResidents')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    livingResidents = residents.filter((resident) => resident.alive !== false);
    treasury = await runEconomy(ctx, state, livingResidents, day);
    await createDailyEvent(ctx, state, livingResidents, day);
  }
  await createDailyTension(ctx, state, livingResidents, day);
  const taxRate = await maybeEnactLaw(ctx, state, livingResidents, day);
  await ctx.db.patch(state._id, {
    simulatedDay: day,
    lastEconomyDay: Math.max(state.lastEconomyDay, day),
    treasury,
    taxRate,
    lastTick: now,
  });
  await advanceCivic(ctx,worldId,day);
  state = (await ctx.db.get(state._id))!;
  return state;
}

export const bootstrap = mutation({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, { worldId }) => runSocietyTick(ctx, worldId, 500),
});

export const tickNow = mutation({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, { worldId }) => runSocietyTick(ctx, worldId),
});

export const addRecommendedResidents = mutation({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, { worldId }) => {
    const state = await ctx.db
      .query('societyWorlds')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .unique();
    if (!state) throw new Error('请先初始化社会系统');
    if (state.recommendedResidentsQueuedAt) {
      return { queued: false, reason: '三位推荐居民已经迁入或正在迁入' };
    }
    const descriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    const existingNames = new Set(descriptions.map((description) => description.name));
    const recommended = [
      { name: '林岚', descriptionIndex: 5 },
      { name: '周石', descriptionIndex: 6 },
      { name: '苏菲', descriptionIndex: 7 },
    ];
    const queuedNames: string[] = [];
    for (const resident of recommended) {
      if (existingNames.has(resident.name)) continue;
      await insertInput(ctx, worldId, 'createAgent', {
        descriptionIndex: resident.descriptionIndex,
      });
      queuedNames.push(resident.name);
    }
    const now = Date.now();
    await ctx.db.patch(state._id, { recommendedResidentsQueuedAt: now });
    if (queuedNames.length > 0) {
      await ctx.db.insert('societyEvents', {
        worldId,
        title: '三位新居民迁入小镇',
        description: `${queuedNames.join('、')}带着新的职业、观念和社会目标抵达小镇。`,
        kind: 'migration',
        status: 'active',
        simulatedDay: state.simulatedDay,
        startedAt: now,
        endsAt: now + SIMULATED_DAY_MS,
        effects: ['人口增加', '新增医疗、建筑和教育部门', '选举与社会关系更加多元'],
      });
    }
    return { queued: true, names: queuedNames };
  },
});

export const tick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const statuses = await ctx.db.query('worldStatus').collect();
    for (const status of statuses.filter((item) => item.isDefault && item.status === 'running')) {
      await runSocietyTick(ctx, status.worldId);
    }
  },
});

export const conversationContext = internalQuery({
  args: { worldId: v.id('worlds'), playerId, otherPlayerId: playerId },
  handler: async (ctx, args) => {
    const [resident, otherResident] = await Promise.all(
      [args.playerId, args.otherPlayerId].map((id) =>
        ctx.db
          .query('societyResidents')
          .withIndex('resident', (q) => q.eq('worldId', args.worldId).eq('playerId', id))
          .unique(),
      ),
    );
    const [player1, player2] = canonicalPair(args.playerId, args.otherPlayerId);
    const relationship = await ctx.db
      .query('societyRelationships')
      .withIndex('pair', (q) =>
        q.eq('worldId', args.worldId).eq('player1', player1).eq('player2', player2),
      )
      .unique();
    const event = await ctx.db
      .query('societyEvents')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .order('desc')
      .filter((q) => q.eq(q.field('status'), 'active'))
      .first();
    const laws = await ctx.db
      .query('societyLaws')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .order('desc')
      .filter((q) => q.eq(q.field('active'), true))
      .take(5);
    const state = await ctx.db
      .query('societyWorlds')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .unique();
    const civic = await civicContext(ctx,args.worldId,args.playerId);
    return { resident, otherResident, relationship, event, laws, state, civic };
  },
});

export const relationshipForCandidate = internalQuery({
  args: { worldId: v.id('worlds'), playerId, otherPlayerId: playerId },
  handler: async (ctx, args) => {
    const [player1, player2] = canonicalPair(args.playerId, args.otherPlayerId);
    return await ctx.db
      .query('societyRelationships')
      .withIndex('pair', (q) =>
        q.eq('worldId', args.worldId).eq('player1', player1).eq('player2', player2),
      )
      .unique();
  },
});
