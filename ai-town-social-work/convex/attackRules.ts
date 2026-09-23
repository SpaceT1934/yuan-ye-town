// Action data must be explicit, addressed to the current counterpart, and stand alone.
// Ordinary dialogue (including threats, quotations and negation) is never executable.
export function attackDecision(text: string, targetName: string): boolean | undefined {
  const lastLine = text.trim().split(/\r?\n/).at(-1)?.trim();
  if (lastLine === `【行动：攻击${targetName}】`) return true;
  if (lastLine === '【行动：克制】') return false;
  return undefined;
}

export function explicitAttackers(
  messages: Array<{author: string; text: string; _creationTime: number}>,
  participants: Array<{playerId: string; name: string}>,
) {
  const decisions = new Map<string, boolean>();
  if (participants.length !== 2 || participants[0].playerId === participants[1].playerId)
    return new Set<string>();
  for (const message of [...messages].sort((a, b) => a._creationTime - b._creationTime)) {
    const actor = participants.find(p => p.playerId === message.author);
    if (!actor) continue;
    const target = participants.find(p => p.playerId !== actor.playerId)!;
    const decision = attackDecision(message.text, target.name);
    if (decision !== undefined) decisions.set(actor.playerId, decision);
  }
  // Until this conversation is settled, the resident may explicitly choose restraint.
  return new Set([...decisions].filter(([, attack]) => attack).map(([author]) => author));
}
