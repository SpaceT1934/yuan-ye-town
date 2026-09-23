import ReactModal from 'react-modal';
import { useQuery } from 'convex/react';
import { ReactNode } from 'react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

export function Observatory({
  isOpen,
  onClose,
  worldId,
}: {
  isOpen: boolean;
  onClose: () => void;
  worldId?: Id<'worlds'>;
}) {
  const overview = useQuery(api.observatory.overview, worldId ? { worldId } : 'skip');

  return (
    <ReactModal
      isOpen={isOpen}
      onRequestClose={onClose}
      style={modalStyles}
      contentLabel="小镇观察站"
      ariaHideApp={false}
    >
      <div className="font-system observatory-shell">
        <header className="flex items-start justify-between gap-4 border-b border-slate-600 pb-4">
          <div>
            <p className="text-xs tracking-[0.28em] text-amber-300">AI TOWN OBSERVATORY</p>
            <h1 className="mt-1 text-3xl font-bold text-white sm:text-4xl">小镇观察站</h1>
            <p className="mt-2 text-sm text-slate-300">查看居民关系、长期记忆与小镇演化进度</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-500 bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600"
          >
            关闭
          </button>
        </header>

        {!overview ? (
          <div className="flex min-h-[360px] items-center justify-center text-slate-300">
            正在整理小镇档案……
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            <section className="rounded-xl border border-amber-400/40 bg-amber-300/10 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-amber-200">当前发展阶段</p>
                  <h2 className="mt-1 text-3xl font-bold text-amber-300">{overview.stage.name}</h2>
                  <p className="mt-1 text-sm text-slate-200">{overview.stage.description}</p>
                </div>
                <div className="text-right text-sm text-slate-300">
                  <p>已持续 {formatDuration(overview.generatedAt - overview.startedAt)}</p>
                  <p className="mt-1">
                    引擎 {overview.engineRunning ? '持续运行中' : '当前未运行'} · 世代{' '}
                    {overview.generationNumber.toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300"
                  style={{ width: `${stageProgress(overview.stage, overview.totals.memories)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {overview.stage.nextAt
                  ? `再积累 ${Math.max(overview.stage.nextAt - overview.totals.memories, 0)} 条记忆，将进入“${overview.stage.nextName}”`
                  : '已进入长期世界演化阶段'}
              </p>
            </section>

            <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Metric
                label="在世居民"
                value={overview.totals.residents}
                suffix={
                  overview.totals.deceasedResidents > 0
                    ? `位 · 史册 ${overview.totals.deceasedResidents} 位`
                    : '位'
                }
              />
              <Metric label="累计对话" value={overview.totals.conversations} suffix="次" />
              <Metric label="累计消息" value={overview.totals.messages} suffix="条" />
              <Metric label="长期记忆" value={overview.totals.memories} suffix="条" />
              <Metric label="反思记忆" value={overview.totals.reflections} suffix="条" />
              <Metric
                label="近 24 小时"
                value={overview.totals.messagesLast24Hours}
                suffix="条消息"
              />
            </section>

            {overview.society && (
              <section className="space-y-5 rounded-xl border border-cyan-400/30 bg-cyan-950/20 p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <SectionTitle
                    title="社会运行系统"
                    subtitle="职业、经济、关系、公共事件与法律均由引擎真实记录"
                  />
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-cyan-400/15 px-3 py-1.5 text-cyan-200">
                      模拟第 {overview.society.simulatedDay} 日
                    </span>
                    <span className="rounded bg-amber-400/15 px-3 py-1.5 text-amber-200">
                      市长：{overview.society.mayorName ?? '尚未选举'}
                    </span>
                    <span className="rounded bg-emerald-400/15 px-3 py-1.5 text-emerald-200">
                      财政 {overview.society.treasury} 金币
                    </span>
                    <span className="rounded bg-violet-400/15 px-3 py-1.5 text-violet-200">
                      税率 {Math.round(overview.society.taxRate * 100)}%
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-sky-400/15 px-3 py-1.5 text-sky-200">
                    公共协作派{' '}
                    {
                      overview.society.residents.filter(
                        (resident) => resident.alive && resident.faction === '公共协作派',
                      ).length
                    }
                    人
                  </span>
                  <span className="rounded bg-orange-400/15 px-3 py-1.5 text-orange-200">
                    自由自治派{' '}
                    {
                      overview.society.residents.filter(
                        (resident) => resident.alive && resident.faction === '自由自治派',
                      ).length
                    }
                    人
                  </span>
                  <span className="text-slate-400">居民会依据经济、健康和信任关系自主改变派系</span>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {overview.society.residents.map((resident) => (
                    <article
                      key={resident.playerId}
                      className={`rounded-lg border p-4 ${
                        resident.alive
                          ? 'border-slate-700 bg-slate-900/70'
                          : 'border-slate-700/50 bg-slate-950/70 opacity-70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-white">{resident.name}</h3>
                          <p className="mt-1 text-xs text-cyan-300">
                            {resident.alive ? resident.job : '已故居民'}
                          </p>
                          <p className="mt-1 text-[11px] text-violet-300">
                            {resident.faction} · {resident.values.join('、')}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-amber-300">
                          🪙 {resident.coins}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-300">
                        {resident.currentPlan}
                      </p>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>生命值</span>
                          <span className={healthColor(resident.health)}>
                            {resident.health}/100
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-700">
                          <div
                            className={`h-full rounded-full ${healthBarColor(resident.health)}`}
                            style={{ width: `${resident.health}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                        <span>声誉 {resident.reputation}</span>
                        <span>饥饿 {resident.hunger}</span>
                        <span>精力 {resident.energy}</span>
                        <span>
                          {resident.partnerName ? `伴侣 ${resident.partnerName}` : '暂无伴侣'}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-400">
                        库存：
                        {resident.inventory.length
                          ? resident.inventory
                              .map((item) => `${item.item}×${item.quantity}`)
                              .join('、')
                          : '空'}
                      </p>
                      {resident.children.length > 0 && (
                        <p className="mt-2 text-xs text-pink-300">
                          家庭成员：{resident.children.join('、')}
                        </p>
                      )}
                      {!resident.alive && (
                        <p className="mt-2 text-xs text-slate-400">
                          死因：{resident.causeOfDeath ?? '未记录'}
                          {resident.diedAt ? ` · ${formatDate(resident.diedAt)}` : ''}
                        </p>
                      )}
                    </article>
                  ))}
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <SectionTitle
                      title="结构化关系"
                      subtitle="这些数值会影响居民选择交谈对象和说话方式"
                    />
                    <div className="mt-3 space-y-2">
                      {overview.society.relationships.slice(0, 10).map((relationship) => (
                        <article
                          key={relationship.id}
                          className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-white">
                              {relationship.names[0]} ↔ {relationship.names[1]}
                            </span>
                            <span
                              className={`rounded px-2 py-0.5 text-xs ${relationStageColor(relationship.stage)}`}
                            >
                              {relationship.stage}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-5 gap-2 text-xs text-slate-400">
                            <span>熟悉 {relationship.familiarity}</span>
                            <span>信任 {relationship.trust}</span>
                            <span>亲近 {relationship.affection}</span>
                            <span>冲突 {relationship.conflict}</span>
                            <span>
                              风险 {relationship.fightRisk}/5
                              {relationship.fights > 0 ? ` · 已打${relationship.fights}次` : ''}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <SectionTitle
                        title="公共事件"
                        subtitle="事件会改变库存、声誉、关系或公共决策"
                      />
                      <div className="mt-3 space-y-2">
                        {overview.society.events.slice(0, 4).map((event) => (
                          <article
                            key={event.id}
                            className="rounded-lg border border-slate-700 bg-slate-900/70 p-4"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-semibold text-white">{event.title}</h3>
                              <span
                                className={
                                  event.status === 'active'
                                    ? 'text-xs text-emerald-300'
                                    : 'text-xs text-slate-500'
                                }
                              >
                                {event.status === 'active' ? '进行中' : '已结束'} · 第
                                {event.simulatedDay}日
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-5 text-slate-300">
                              {event.description}
                            </p>
                            <p className="mt-2 text-xs text-cyan-300">{event.effects.join('；')}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                    <div>
                      <SectionTitle
                        title="法律与表决"
                        subtitle="法律通过后会实际改变税率、食物价格或公共投入"
                      />
                      <div className="mt-3 space-y-2">
                        {overview.society.laws.length === 0 ? (
                          <EmptyState>镇民大会还没有通过法律。</EmptyState>
                        ) : (
                          overview.society.laws.slice(0, 5).map((law) => (
                            <article
                              key={law.id}
                              className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-white">{law.title}</span>
                                <span
                                  className={
                                    law.active
                                      ? 'text-xs text-emerald-300'
                                      : 'text-xs text-rose-300'
                                  }
                                >
                                  {law.active ? '已通过' : '未通过'} · {law.votesFor}:
                                  {law.votesAgainst}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-400">{law.description}</p>
                            </article>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <SectionTitle
                    title="最近交易"
                    subtitle="金币、商品与税收均会改变居民和小镇财政余额"
                  />
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {overview.society.transactions.slice(0, 8).map((transaction) => (
                      <article
                        key={transaction.id}
                        className="rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs"
                      >
                        <p className="text-slate-200">
                          {transaction.fromName} → {transaction.toName}
                        </p>
                        <p className="mt-1 text-amber-300">
                          {transaction.item} × {transaction.quantity} · {transaction.total} 金币
                          {transaction.tax > 0 ? `（税 ${transaction.tax}）` : ''}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            )}

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <section>
                <SectionTitle title="居民档案" subtitle="记忆积累与当前状态" />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {overview.residents.map((resident) => (
                    <article
                      key={resident.playerId}
                      className="rounded-lg border border-slate-700 bg-slate-800/80 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{resident.name}</h3>
                          <p className="mt-1 text-xs text-emerald-300">{resident.status}</p>
                        </div>
                        <span className="rounded bg-indigo-500/20 px-2 py-1 text-xs text-indigo-200">
                          {resident.memoryCount} 条记忆
                        </span>
                      </div>
                      <div className="mt-4 flex gap-5 text-sm text-slate-300">
                        <span>对话 {resident.conversationCount}</span>
                        <span>反思 {resident.reflectionCount}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section>
                <SectionTitle title="互动关系" subtitle="按历史对话次数排列，不代表好感度" />
                <div className="mt-3 space-y-2">
                  {overview.relationships.length === 0 ? (
                    <EmptyState>还没有形成可统计的互动关系。</EmptyState>
                  ) : (
                    overview.relationships.map((relationship) => {
                      const maxCount = overview.relationships[0]?.conversationCount || 1;
                      return (
                        <article
                          key={relationship.names.join('-')}
                          className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-white">
                              {relationship.names[0]} ↔ {relationship.names[1]}
                            </span>
                            <span className="text-xs text-slate-300">
                              {relationship.conversationCount} 次 · {relationship.messageCount}{' '}
                              条消息
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700">
                            <div
                              className="h-full rounded-full bg-indigo-400"
                              style={{
                                width: `${Math.max(12, (relationship.conversationCount / maxCount) * 100)}%`,
                              }}
                            />
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            </div>

            <section>
              <SectionTitle title="最近纪事" subtitle="由居民在对话结束后形成的第一人称长期记忆" />
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {overview.recentChronicle.length === 0 ? (
                  <EmptyState>居民还没有留下长期记忆。</EmptyState>
                ) : (
                  overview.recentChronicle.map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-lg border border-slate-700 bg-slate-800/80 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-amber-300">{entry.residentName}</span>
                          <span className="rounded bg-slate-700 px-2 py-0.5 text-slate-300">
                            {memoryType(entry.type)}
                          </span>
                          <span className="text-rose-300">重要度 {entry.importance}/9</span>
                        </div>
                        <time className="text-slate-400">{formatDate(entry.createdAt)}</time>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-200">{entry.description}</p>
                    </article>
                  ))
                )}
              </div>
            </section>

            <p className="pb-2 text-center text-xs text-slate-500">
              数据会随小镇运行自动更新 · 最近整理于 {formatDate(overview.generatedAt)}
            </p>
          </div>
        )}
      </div>
    </ReactModal>
  );
}

function Metric({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/90 p-4 text-center">
      <div className="text-2xl font-bold text-white">{value.toLocaleString('zh-CN')}</div>
      <div className="mt-1 text-xs text-slate-400">
        {label} · {suffix}
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-600 p-6 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

function stageProgress(stage: { min: number; nextAt: number | null }, memoryCount?: number) {
  const total = memoryCount ?? 0;
  if (!stage.nextAt) return 100;
  return Math.min(100, Math.max(4, ((total - stage.min) / (stage.nextAt - stage.min)) * 100));
}

function formatDuration(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remainderHours = hours % 24;
  if (days > 0) return `${days} 天 ${remainderHours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`;
  return `${minutes} 分钟`;
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function memoryType(type: string) {
  if (type === 'reflection') return '反思';
  if (type === 'relationship') return '关系';
  return '对话记忆';
}

function relationStageColor(stage: string) {
  if (stage === '夫妻' || stage === '伴侣') return 'bg-pink-400/20 text-pink-200';
  if (stage === '前伴侣') return 'bg-amber-400/20 text-amber-200';
  if (stage === '朋友' || stage === '亲密朋友') return 'bg-emerald-400/20 text-emerald-200';
  if (stage === '对立') return 'bg-rose-400/20 text-rose-200';
  return 'bg-slate-700 text-slate-300';
}

function healthColor(health: number) {
  if (health <= 0) return 'text-slate-400';
  if (health < 35) return 'text-rose-300';
  if (health < 70) return 'text-amber-300';
  return 'text-emerald-300';
}

function healthBarColor(health: number) {
  if (health <= 0) return 'bg-slate-600';
  if (health < 35) return 'bg-rose-500';
  if (health < 70) return 'bg-amber-400';
  return 'bg-emerald-400';
}

const modalStyles = {
  overlay: {
    backgroundColor: 'rgba(3, 7, 18, 0.88)',
    zIndex: 20,
  },
  content: {
    inset: '5vh 4vw',
    border: '1px solid rgb(71, 85, 105)',
    borderRadius: '14px',
    background: 'linear-gradient(160deg, rgb(30, 41, 59), rgb(15, 23, 42))',
    color: 'white',
    padding: '24px',
    overflow: 'auto',
  },
};
