import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { agentTables } from './agent/schema';
import { aiTownTables } from './aiTown/schema';
import { conversationId, playerId } from './aiTown/ids';
import { engineTables } from './engine/schema';
import { civicTables } from './civicSchema';

export default defineSchema({
  ...civicTables,
  music: defineTable({
    storageId: v.string(),
    type: v.union(v.literal('background'), v.literal('player')),
  }),

  messages: defineTable({
    conversationId,
    messageUuid: v.string(),
    author: playerId,
    text: v.string(),
    worldId: v.optional(v.id('worlds')),
  })
    .index('conversationId', ['worldId', 'conversationId'])
    .index('messageUuid', ['conversationId', 'messageUuid']),

  societyWorlds: defineTable({
    worldId: v.id('worlds'),
    simStartedAt: v.number(),
    simulatedDay: v.number(),
    lastEconomyDay: v.number(),
    lastElectionDay: v.number(),
    lastTick: v.number(),
    treasury: v.number(),
    taxRate: v.number(),
    mayorId: v.optional(playerId),
    recommendedResidentsQueuedAt: v.optional(v.number()),
  }).index('worldId', ['worldId']),

  societyResidents: defineTable({
    worldId: v.id('worlds'),
    playerId,
    name: v.string(),
    job: v.string(),
    workplace: v.string(),
    coins: v.number(),
    reputation: v.number(),
    hunger: v.number(),
    energy: v.number(),
    inventory: v.array(v.object({ item: v.string(), quantity: v.number() })),
    dailyPlan: v.array(
      v.object({ period: v.string(), activity: v.string(), location: v.string() }),
    ),
    currentPlan: v.string(),
    partnerId: v.optional(playerId),
    householdId: v.optional(v.string()),
    children: v.array(v.string()),
    faction: v.optional(v.string()),
    lastFactionChangeDay: v.optional(v.number()),
    values: v.optional(v.array(v.string())),
    health: v.optional(v.number()),
    alive: v.optional(v.boolean()),
    injuredAt: v.optional(v.number()),
    diedAt: v.optional(v.number()),
    causeOfDeath: v.optional(v.string()),
    lastUpdated: v.number(),
  })
    .index('worldId', ['worldId'])
    .index('resident', ['worldId', 'playerId']),

  societyRelationships: defineTable({
    worldId: v.id('worlds'),
    player1: playerId,
    player2: playerId,
    familiarity: v.number(),
    trust: v.number(),
    affection: v.number(),
    conflict: v.number(),
    stage: v.union(
      v.literal('陌生'),
      v.literal('认识'),
      v.literal('熟悉'),
      v.literal('朋友'),
      v.literal('亲密朋友'),
      v.literal('伴侣'),
      v.literal('夫妻'),
      v.literal('前伴侣'),
      v.literal('对立'),
    ),
    conversations: v.number(),
    breakupRisk: v.optional(v.number()),
    marriedAt: v.optional(v.number()),
    divorcedAt: v.optional(v.number()),
    divorceCount: v.optional(v.number()),
    fightRisk: v.optional(v.number()),
    fights: v.optional(v.number()),
    lastFightAt: v.optional(v.number()),
    lastInteractionAt: v.number(),
  })
    .index('worldId', ['worldId'])
    .index('pair', ['worldId', 'player1', 'player2']),

  societyEvents: defineTable({
    worldId: v.id('worlds'),
    title: v.string(),
    description: v.string(),
    kind: v.string(),
    status: v.union(v.literal('active'), v.literal('completed')),
    simulatedDay: v.number(),
    startedAt: v.number(),
    endsAt: v.number(),
    effects: v.array(v.string()),
  }).index('worldId', ['worldId', 'startedAt']),

  societyLaws: defineTable({
    worldId: v.id('worlds'),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    enactedAt: v.number(),
    simulatedDay: v.number(),
    sponsorId: v.optional(playerId),
    votesFor: v.number(),
    votesAgainst: v.number(),
    active: v.boolean(),
  }).index('worldId', ['worldId', 'enactedAt']),

  societyTransactions: defineTable({
    worldId: v.id('worlds'),
    simulatedDay: v.number(),
    fromPlayerId: v.optional(playerId),
    toPlayerId: v.optional(playerId),
    item: v.string(),
    quantity: v.number(),
    total: v.number(),
    tax: v.number(),
    createdAt: v.number(),
  }).index('worldId', ['worldId', 'createdAt']),

  societyProcessedConversations: defineTable({
    worldId: v.id('worlds'),
    conversationId,
    processedAt: v.number(),
  }).index('conversation', ['worldId', 'conversationId']),

  ...agentTables,
  ...aiTownTables,
  ...engineTables,
});
