import { MutationCtx } from '../_generated/server';
import { Id } from '../_generated/dataModel';

// Rebase only live timers. Historical messages, memories, relationships and
// financial records retain their original timestamps and contents.
export async function rebasePausedWorld(ctx: MutationCtx, worldId: Id<'worlds'>, previous: number, now: number) {
  const gap = Math.max(0, now - previous);
  if (!gap) return;
  const world = await ctx.db.get(worldId);
  if (!world) throw new Error('World missing during resume');
  const timers = new Set(['lastInput', 'until', 'started', 'invited', 'created',
    'lastConversation', 'lastInviteAttempt', 'timestamp', 'start', 'end', 'time', 'nextRetry']);
  const shift = (value: any): any => {
    if (Array.isArray(value)) return value.map(shift);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) =>
      [key, timers.has(key) && typeof item === 'number' && item > 1e12 ? item + gap : shift(item)]));
  };
  const players = shift(world.players);
  const agents = shift(world.agents);
  const conversations = shift(world.conversations);
  for (const player of players) {
    if (player.pathfinding?.state.kind === 'moving') {
      for (const point of player.pathfinding.state.path) point[4] += gap;
    }
  }
  for (const agent of agents) delete agent.inProgressOperation;
  for (const conversation of conversations) delete conversation.isTyping;
  await ctx.db.patch(worldId, { players, agents, conversations });
  const society = await ctx.db.query('societyWorlds').withIndex('worldId', q => q.eq('worldId', worldId)).unique();
  if (society) {
    await ctx.db.patch(society._id, { simStartedAt: society.simStartedAt + gap, lastTick: now });
    const events = await ctx.db.query('societyEvents').withIndex('worldId', q => q.eq('worldId', worldId)).collect();
    for (const event of events) {
      if (event.endsAt > previous) await ctx.db.patch(event._id, { endsAt: event.endsAt + gap });
    }
  }
}
