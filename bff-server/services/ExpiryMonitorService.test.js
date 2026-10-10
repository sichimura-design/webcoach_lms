const test = require('node:test');
const assert = require('node:assert');
const { resolveCertHosts, classifyDaysLeft, daysUntil } = require('./ExpiryMonitorService');

test('CERT_MONITOR_HOSTSがあればそれを重複なしで使う', () => {
  const hosts = resolveCertHosts(
    { CERT_MONITOR_HOSTS: ' study.webcoach.jp, api.webcoach.jp,study.webcoach.jp,' },
    { frontendBaseUrl: 'https://other.example.com' }
  );
  assert.deepStrictEqual(hosts, ['study.webcoach.jp', 'api.webcoach.jp']);
});

test('未指定ならフロントURLとOAuthコールバック先のhttpsホストを使う', () => {
  const hosts = resolveCertHosts({}, {
    frontendBaseUrl: 'https://study.webcoach.jp',
    googleRedirectUri: 'https://api.webcoach.jp/api/integrations/organizer/google/callback',
  });
  assert.deepStrictEqual(hosts, ['study.webcoach.jp', 'api.webcoach.jp']);
});

test('httpや未設定のURLは対象外', () => {
  assert.deepStrictEqual(resolveCertHosts({}, { frontendBaseUrl: 'http://localhost:3000', googleRedirectUri: undefined }), []);
});

test('残り日数の段階分け', () => {
  assert.strictEqual(classifyDaysLeft(-1), 'expired');
  assert.strictEqual(classifyDaysLeft(0), 'danger');
  assert.strictEqual(classifyDaysLeft(14), 'danger');
  assert.strictEqual(classifyDaysLeft(15), 'warning');
  assert.strictEqual(classifyDaysLeft(30), 'warning');
  assert.strictEqual(classifyDaysLeft(31), 'ok');
});

test('daysUntilは切り捨てで数える', () => {
  const now = Date.UTC(2026, 9, 10, 12);
  assert.strictEqual(daysUntil(new Date(Date.UTC(2026, 9, 20, 11)), now), 9);
  assert.strictEqual(daysUntil(new Date(Date.UTC(2026, 9, 20, 12)), now), 10);
});
