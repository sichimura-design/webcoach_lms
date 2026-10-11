const test = require('node:test');
const assert = require('node:assert');

const apiServerAdapter = require('../adapters/ApiServerAdapter');
const expiryMonitorService = require('./ExpiryMonitorService');
const modelLifecycleService = require('./ModelLifecycleService');
const { DailyReportService, jstDateHour } = require('./DailyReportService');

test('JSTの日付と時刻に直す', () => {
  // 2026-10-10 23:30 UTC = 2026-10-11 08:30 JST
  assert.deepStrictEqual(jstDateHour(new Date('2026-10-10T23:30:00Z')), { date: '2026-10-11', hour: 8 });
});

test('8時台に1日1回だけ書く', async (t) => {
  t.mock.method(apiServerAdapter, 'getDailyKpi', async () => ({ date: '2026-10-10', active_users: 3 }));
  t.mock.method(apiServerAdapter, 'getRuntimeSettings', async () => ({ ANTHROPIC_MODEL: 'claude-haiku-4-5' }));
  t.mock.method(expiryMonitorService, 'getExpiryStatus', async () => ({
    certificates: [{ host: 'study.webcoach.jp', status: 'ok', daysLeft: 120, validTo: '2027-02-09T00:00:00.000Z' }],
    google: { configured: false, status: 'none' },
  }));
  t.mock.method(modelLifecycleService, 'describe', async (id) => ({
    id, lifecycle: { state: 'active', retirementOn: '2026-10-15', retirementNotSoonerThan: true, daysUntilRetirement: 4, warning: true },
  }));
  const written = [];
  t.mock.method(process.stdout, 'write', (s) => { written.push(s); return true; });

  const svc = new DailyReportService();
  assert.strictEqual(await svc.runIfDue(new Date('2026-10-10T22:00:00Z')), false); // 7時台
  assert.strictEqual(await svc.runIfDue(new Date('2026-10-10T23:05:00Z')), true); // 8時台
  assert.strictEqual(await svc.runIfDue(new Date('2026-10-10T23:50:00Z')), false); // 書き済み
  assert.strictEqual(await svc.runIfDue(new Date('2026-10-11T23:05:00Z')), true); // 翌日

  const report = JSON.parse(written.find((s) => s.startsWith('{')));
  assert.strictEqual(report.event, 'daily_report');
  assert.strictEqual(report.kpi.active_users, 3);
  assert.strictEqual(report.certificates[0].daysLeft, 120);
  assert.strictEqual(report.model.id, 'claude-haiku-4-5');
  assert.strictEqual(report.model.daysUntilRetirement, 4);
});

test('取れなかった項目はerrorにしてほかは出す', async (t) => {
  t.mock.method(apiServerAdapter, 'getDailyKpi', async () => { throw new Error('timeout'); });
  t.mock.method(apiServerAdapter, 'getRuntimeSettings', async () => { throw new Error('down'); });
  t.mock.method(expiryMonitorService, 'getExpiryStatus', async () => ({
    certificates: [], google: { configured: true, status: 'danger', refreshError: 'invalid_grant' },
  }));
  const { buildReport } = require('./DailyReportService');
  const report = await buildReport();
  assert.deepStrictEqual(report.kpi, { error: 'timeout' });
  assert.deepStrictEqual(report.model, { error: 'down' });
  assert.strictEqual(report.google.error, 'invalid_grant');
});
