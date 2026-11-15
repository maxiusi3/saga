import type { G4DecisionReport, RatioMetric } from './pilot-cohort-analytics'

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
const ratio = (metric: RatioMetric) => metric.proportion === null ? '暂无样本' : `${metric.numerator} / ${metric.denominator} (${(metric.proportion * 100).toFixed(1)}%)`
const money = (cents: number | null) => cents === null ? '资料未齐' : `US$ ${(cents / 100).toFixed(2)}`

/** No scripts, credentials, individual household evidence or external dependencies. */
export function renderPilotReportHtml(r: G4DecisionReport, legacyCount: number): string {
  const rows = Object.entries(r.perPricingTier).map(([tier, s]) => `<tr><th scope="row">${escape(tier)}</th><td>${s.households}</td><td>${ratio(s.effectiveActivationAll)}</td><td>${ratio(s.firstOutcomeWithin7d)}</td><td>${ratio(s.completionWithin28dAllPaid)}</td><td>${ratio(s.replayWithin14dPostDelivery)}</td><td>${money(s.unitEconomics.totalContributionCents)}</td></tr>`).join('')
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>G4 试点报告</title><style>body{margin:0;background:#f7f7f4;color:#192920;font:16px/1.6 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:28px}h1{font-size:30px}h2{font-size:21px;margin-top:32px}.notice{border-left:4px solid #a85800;background:#fff1d7;padding:16px}.table{overflow:auto}table{border-collapse:collapse;min-width:750px;width:100%;background:white}th,td{padding:12px;text-align:left;border-bottom:1px solid #d8dfd9}dt{font-weight:600}dd{margin:0 0 12px}code{overflow-wrap:anywhere}.quiet{color:#526159}</style><main>
  <h1>G4 试点报告</h1><p>批次 <strong>${escape(r.cohortKey ?? '未选择')}</strong> · 截止 ${escape(r.evaluatedAt)}</p>
  <p class="notice">${r.observationKind === 'synthetic' ? '合成演练数据：不代表真实家庭、真实付费或真实 G4 通过。' : '运营核对的实际观察记录：须结合证据索引和负责人复核，不自动执行商业决策。'}</p>
  <dl><dt>真实 G4</dt><dd>${r.g4GateReady ? '证据条件满足，等待负责人决定' : '未通过'}</dd><dt>本批合成演练</dt><dd>${r.simulationReady ? '分析条件满足' : '条件未齐'}</dd><dt>家庭样本</dt><dd>${r.uniqueLongitudinalHouseholds} 户；全价付款字段合格：${r.paid59Households} 户</dd><dt>观察窗口</dt><dd>28 天：${r.maturity.enrolled28d.mature}/${r.maturity.enrolled28d.eligible}；邀请后 7 天：${r.maturity.invited7d.mature}/${r.maturity.invited7d.eligible}；交付后 14 天：${r.maturity.delivered14d.mature}/${r.maturity.delivered14d.eligible}</dd></dl>
  <h2>未满足的条件</h2>${r.blockingReasons.length ? `<ul>${r.blockingReasons.map(reason => `<li><code>${escape(reason)}</code></li>`).join('')}</ul>` : '<p>所选数据的分析条件已满足；合成来源仍不会通过真实 G4。</p>'}
  <h2>按价格分组</h2><div class="table"><table><thead><tr><th>价格</th><th>家庭</th><th>启动</th><th>7天成果</th><th>28天完成/付费</th><th>14天回听</th><th>贡献</th></tr></thead><tbody>${rows}</tbody></table></div>
  <h2>全批经济与劳动</h2><p>获客前贡献：${money(r.unitEconomicsAllCohort.contributionBeforeAcquisitionCents)}；含获客成本：${money(r.unitEconomicsAllCohort.contributionAfterAcquisitionCents)}；含固定分摊：${money(r.unitEconomicsAllCohort.totalContributionCents)}。</p><p>运营支持 P50 / P90：${r.opsSupportLabor.medianMinutes ?? '未知'} / ${r.opsSupportLabor.p90Minutes ?? '未知'} 分钟；每篇家庭修订 P50 / P90：${r.familyRevisionPerStoryLabor.medianMinutes ?? '未知'} / ${r.familyRevisionPerStoryLabor.p90Minutes ?? '未知'} 分钟。</p>
  <p>系统回听：${ratio(r.replayWithin14dPostDelivery)}；访谈自报回听：${ratio(r.selfReportedReplayWithin14dPostDelivery)}。下载不计为回听。</p>
  <h2>供负责人判断的建议</h2><p><code>${escape(r.recommendation.code)}</code></p><p>${escape(r.recommendation.rationale)}</p><p class="quiet">删除造成的样本损失：${r.erasedHouseholds} 户；未分类旧台账：${legacyCount} 条（未混入本批）。退出、退款与未完成家庭保留在原批次。JSON 报告另含质量、推荐、版本、渠道、国家及支持方式分组。</p></main></html>`
}
