import { v } from 'convex/values';
import { query } from './_generated/server';

const stages = [
  { min: 0, name: '萌芽期', description: '居民正在积累最初的经历。' },
  { min: 20, name: '关系形成期', description: '重复互动开始形成稳定印象。' },
  { min: 100, name: '社群成长期', description: '关系网络和共同话题正在成形。' },
  { min: 300, name: '世界演化期', description: '长期记忆、传闻和反思开始持续影响小镇。' },
] as const;

function stageFor(memoryCount: number) {
  let current: (typeof stages)[number] = stages[0];
  let next: (typeof stages)[number] | undefined;
  for (const stage of stages) {
    if (memoryCount >= stage.min) {
      current = stage;
    } else {
      next = stage;
      break;
    }
  }
  return {
    ...current,
    nextAt: next?.min ?? null,
    nextName: next?.name ?? null,
  };
}

export const overview = query({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, { worldId }) => {
    const world = await ctx.db.get(worldId);
    if (!world) throw new Error(`World ${worldId} not found`);

    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .unique();
    const engine = worldStatus ? await ctx.db.get(worldStatus.engineId) : null;
    const descriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    const archivedConversations = await ctx.db
      .query('archivedConversations')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    const messages = await ctx.db
      .query('messages')
      .withIndex('conversationId', (q) => q.eq('worldId', worldId))
      .collect();
    const societyState = await ctx.db
      .query('societyWorlds')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .unique();
    const societyResidents = await ctx.db
      .query('societyResidents')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    const societyRelationships = await ctx.db
      .query('societyRelationships')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    const societyEvents = await ctx.db
      .query('societyEvents')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .order('desc')
      .take(12);
    const societyLaws = await ctx.db
      .query('societyLaws')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .order('desc')
      .take(12);
    const societyTransactions = await ctx.db
      .query('societyTransactions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .order('desc')
      .take(20);

    const nameByPlayer = new Map(
      descriptions.map((description) => [description.playerId, description.name]),
    );
    const agentPlayerIds = world.agents.map((agent) => agent.playerId);
    const livePlayerIds = new Set(agentPlayerIds);
    const trackedPlayerIds = societyResidents.length
      ? societyResidents.map((resident) => resident.playerId)
      : agentPlayerIds;
    const memoriesByPlayer = await Promise.all(
      trackedPlayerIds.map(async (playerId) => ({
        playerId,
        memories: await ctx.db
          .query('memories')
          .withIndex('playerId', (q) => q.eq('playerId', playerId))
          .collect(),
      })),
    );
    const allMemories = memoriesByPlayer.flatMap(({ memories }) => memories);
    const now = Date.now();

    const residents = memoriesByPlayer.map(({ playerId, memories }) => {
      const player = world.players.find((candidate) => candidate.id === playerId);
      const conversation = world.conversations.find((candidate) =>
        candidate.participants.some((participant) => participant.playerId === playerId),
      );
      let status = '空闲中';
      const societyResident = societyResidents.find((resident) => resident.playerId === playerId);
      if (societyResident?.alive === false) {
        status = '已故（档案保留）';
      } else if (conversation) {
        status = '正在交谈';
      } else if (player?.activity && player.activity.until > now) {
        status = `${player.activity.emoji} ${player.activity.description}`;
      } else if (player?.pathfinding) {
        status = '正在散步';
      }
      const completedConversations = archivedConversations.filter((item) =>
        item.participants.includes(playerId),
      );
      return {
        playerId,
        name: nameByPlayer.get(playerId) ?? playerId,
        status,
        memoryCount: memories.length,
        reflectionCount: memories.filter((memory) => memory.data.type === 'reflection').length,
        conversationCount: completedConversations.length,
        lastInteractionAt:
          completedConversations.reduce((latest, item) => Math.max(latest, item.ended), 0) || null,
      };
    });

    const relationMap = new Map<
      string,
      {
        names: [string, string];
        conversationCount: number;
        messageCount: number;
        lastInteractionAt: number;
      }
    >();
    for (const conversation of archivedConversations) {
      if (conversation.participants.length !== 2 || conversation.numMessages === 0) continue;
      const names = conversation.participants
        .map((playerId) => nameByPlayer.get(playerId) ?? playerId)
        .sort((a, b) => a.localeCompare(b, 'zh-CN')) as [string, string];
      const key = names.join('\u0000');
      const relation = relationMap.get(key) ?? {
        names,
        conversationCount: 0,
        messageCount: 0,
        lastInteractionAt: 0,
      };
      relation.conversationCount += 1;
      relation.messageCount += conversation.numMessages;
      relation.lastInteractionAt = Math.max(relation.lastInteractionAt, conversation.ended);
      relationMap.set(key, relation);
    }
    const relationships = [...relationMap.values()]
      .sort(
        (a, b) =>
          b.conversationCount - a.conversationCount || b.lastInteractionAt - a.lastInteractionAt,
      )
      .slice(0, 12);

    const recentChronicle = allMemories
      .slice()
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 12)
      .map((memory) => ({
        id: memory._id,
        residentName: nameByPlayer.get(memory.playerId) ?? memory.playerId,
        description: memory.description,
        importance: memory.importance,
        type: memory.data.type,
        createdAt: memory._creationTime,
      }));

    const societyNameByPlayer = new Map(
      societyResidents.map((resident) => [resident.playerId, resident.name]),
    );
    const structuredRelationships = societyRelationships
      .map((relationship) => ({
        id: relationship._id,
        names: [
          societyNameByPlayer.get(relationship.player1) ?? relationship.player1,
          societyNameByPlayer.get(relationship.player2) ?? relationship.player2,
        ],
        stage: relationship.stage,
        familiarity: relationship.familiarity,
        trust: relationship.trust,
        affection: relationship.affection,
        conflict: relationship.conflict,
        fightRisk: relationship.fightRisk ?? 0,
        fights: relationship.fights ?? 0,
        conversations: relationship.conversations,
        lastInteractionAt: relationship.lastInteractionAt,
      }))
      .sort((a, b) => b.familiarity - a.familiarity || b.lastInteractionAt - a.lastInteractionAt);

    return {
      generatedAt: now,
      startedAt: world._creationTime,
      status: worldStatus?.status ?? 'inactive',
      engineRunning: engine?.running ?? false,
      generationNumber: engine?.generationNumber ?? 0,
      stage: stageFor(allMemories.length),
      totals: {
        residents: agentPlayerIds.length,
        deceasedResidents: societyResidents.filter((resident) => resident.alive === false).length,
        activeConversations: world.conversations.length,
        conversations: archivedConversations.length + world.conversations.length,
        messages: messages.length,
        memories: allMemories.length,
        reflections: allMemories.filter((memory) => memory.data.type === 'reflection').length,
        messagesLast24Hours: messages.filter((message) => message._creationTime >= now - 86_400_000)
          .length,
      },
      residents: residents.sort((a, b) => b.memoryCount - a.memoryCount),
      relationships,
      recentChronicle,
      society: societyState
        ? {
            simulatedDay: societyState.simulatedDay,
            treasury: societyState.treasury,
            taxRate: societyState.taxRate,
            mayorName: societyState.mayorId
              ? (societyNameByPlayer.get(societyState.mayorId) ?? societyState.mayorId)
              : null,
            lastTick: societyState.lastTick,
            residents: societyResidents
              .map((resident) => ({
                playerId: resident.playerId,
                name: resident.name,
                job: resident.job,
                workplace: resident.workplace,
                coins: resident.coins,
                reputation: resident.reputation,
                hunger: resident.hunger,
                energy: resident.energy,
                health: resident.health ?? 100,
                alive: resident.alive !== false && livePlayerIds.has(resident.playerId),
                faction: resident.faction ?? '独立居民',
                values: resident.values ?? [],
                diedAt: resident.diedAt ?? null,
                causeOfDeath: resident.causeOfDeath ?? null,
                inventory: resident.inventory,
                currentPlan: resident.currentPlan,
                partnerName: resident.partnerId
                  ? (societyNameByPlayer.get(resident.partnerId) ?? resident.partnerId)
                  : null,
                householdId: resident.householdId ?? null,
                children: resident.children,
              }))
              .sort((a, b) => Number(b.alive) - Number(a.alive) || b.reputation - a.reputation),
            relationships: structuredRelationships,
            events: societyEvents.map((event) => ({
              id: event._id,
              title: event.title,
              description: event.description,
              kind: event.kind,
              status: event.status,
              simulatedDay: event.simulatedDay,
              effects: event.effects,
              startedAt: event.startedAt,
            })),
            laws: societyLaws.map((law) => ({
              id: law._id,
              title: law.title,
              description: law.description,
              category: law.category,
              simulatedDay: law.simulatedDay,
              votesFor: law.votesFor,
              votesAgainst: law.votesAgainst,
              active: law.active,
            })),
            transactions: societyTransactions.map((transaction) => ({
              id: transaction._id,
              simulatedDay: transaction.simulatedDay,
              fromName: transaction.fromPlayerId
                ? (societyNameByPlayer.get(transaction.fromPlayerId) ?? transaction.fromPlayerId)
                : '小镇财政',
              toName: transaction.toPlayerId
                ? (societyNameByPlayer.get(transaction.toPlayerId) ?? transaction.toPlayerId)
                : '小镇财政',
              item: transaction.item,
              quantity: transaction.quantity,
              total: transaction.total,
              tax: transaction.tax,
              createdAt: transaction.createdAt,
            })),
          }
        : null,
    };
  },
});
