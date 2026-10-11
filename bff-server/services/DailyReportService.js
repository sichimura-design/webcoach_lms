/**
 * 毎朝の運用レポート(Slack通知の材料)
 *
 * 運用KPI(api-server)・証明書/Google連携の期限・AIモデルの引退予定を集め、
 * {"event":"daily_report",...} の1行JSONで標準出力へ書く。CloudWatch Logsに入ったこの行を
 * Slack通知Lambda(cdk/lambda/slack-notifier)が毎朝9時に読んで投稿する。
 * Lambdaから直接BFF/DBへ繋がずに済むよう、ログを受け渡しに使っている。
 *
 * JSTの REPORT_HOUR 時台に1日1回だけ書く(本番は定期処理の担当タスクだけが書く)。
 */

const apiServerAdapter = require('../adapters/ApiServerAdapter');
const expiryMonitorService = require('./ExpiryMonitorService');
const modelLifecycleService = require('./ModelLifecycleService');
const logger = require('../utils/logger');

// Lambdaの集計(9:00 JST)より前に書いておく
const REPORT_HOUR = 8;
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

function jstDateHour(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return { date: jst.toISOString().slice(0, 10), hour: jst.getUTCHours() };
}

/** 失敗した項目は {error} にして、ほかの項目は出す */
async function settle(fn) {
  try {
    return await fn();
  } catch (err) {
    return { error: err.message };
  }
}

async function buildReport() {
  const [kpi, expiry, model] = await Promise.all([
    settle(() => apiServerAdapter.getDailyKpi()),
    settle(() => expiryMonitorService.getExpiryStatus()),
    settle(async () => {
      const values = await apiServerAdapter.getRuntimeSettings();
      return modelLifecycleService.describe(values ? values.ANTHROPIC_MODEL : null);
    }),
  ]);

  return {
    event: 'daily_report',
    ts: new Date().toISOString(),
    kpi,
    certificates: expiry.error
      ? { error: expiry.error }
      : expiry.certificates.map((c) => ({
        host: c.host, status: c.status, daysLeft: c.daysLeft ?? null, validTo: c.validTo ?? null, error: c.error ?? null,
      })),
    google: expiry.error ? { error: expiry.error } : {
      status: expiry.google.status,
      configured: expiry.google.configured,
      connected: expiry.google.connected ?? null,
      error: expiry.google.refreshError ?? null,
    },
    model: model.error ? { error: model.error } : {
      id: model.id,
      state: model.lifecycle ? model.lifecycle.state : null,
      retirementOn: model.lifecycle ? model.lifecycle.retirementOn : null,
      retirementNotSoonerThan: model.lifecycle ? model.lifecycle.retirementNotSoonerThan : null,
      daysUntilRetirement: model.lifecycle ? model.lifecycle.daysUntilRetirement : null,
      warning: model.lifecycle ? model.lifecycle.warning : null,
    },
  };
}

class DailyReportService {
  constructor() {
    this.lastReportDate = null;
  }

  /** 今が書く時間帯で、今日まだ書いていなければ true */
  isDue(now = new Date()) {
    const { date, hour } = jstDateHour(now);
    return hour === REPORT_HOUR && this.lastReportDate !== date;
  }

  /** 定期的に呼ばれる。時間外・書き済みなら何もしない */
  async runIfDue(now = new Date()) {
    if (!this.isDue(now)) return false;
    this.lastReportDate = jstDateHour(now).date;
    const report = await buildReport();
    // loggerはキー名でマスクするので通さず、素の1行JSONを書く(Logs InsightsがJSONとして読める形)
    process.stdout.write(`${JSON.stringify(report)}\n`);
    logger.log('[DailyReport] 運用レポートを出力しました');
    return true;
  }
}

module.exports = new DailyReportService();
module.exports.DailyReportService = DailyReportService;
module.exports.buildReport = buildReport;
module.exports.jstDateHour = jstDateHour;
module.exports.CHECK_INTERVAL_MS = CHECK_INTERVAL_MS;
