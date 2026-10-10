/**
 * 期限管理(管理画面「期限管理」)
 *
 * - SSL/TLS証明書: 公開ドメインへ実際にTLS接続し、いま配っている証明書の有効期限を読む。
 *   ACMの証明書はDNS検証なら期限の60日前から自動更新されるので、残りが
 *   WARN_DAYS を切っている = 自動更新が止まっている疑い、として目立たせる。
 *   ACMのAPIを使わないのは、CloudFront用(us-east-1)とALB用でリージョンが違う上、
 *   タスクロールへの権限追加が要らず、dev/uat/prodで同じように動くため。
 * - Google(会社共有Organizerアカウント): refresh_tokenに期限日は無いので、
 *   実際に取り直せるかを確かめる(IntegrationService.checkOrganizerRefresh)。
 */

const tls = require('tls');
const { config } = require('../config/environment');
const integrationService = require('./IntegrationService');
const logger = require('../utils/logger');

const WARN_DAYS = 30;
const DANGER_DAYS = 14;
const TLS_TIMEOUT_MS = 8000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 確かめるホスト名の一覧。CERT_MONITOR_HOSTS(カンマ区切り)があればそれを使い、
 * 無ければフロントのURLとOAuthコールバック先(=BFFの公開URL)のうちhttpsのものから作る。
 */
function resolveCertHosts(env = process.env, cfg = config) {
  if (env.CERT_MONITOR_HOSTS) {
    return [...new Set(env.CERT_MONITOR_HOSTS.split(',').map(h => h.trim()).filter(Boolean))];
  }
  const hosts = [];
  for (const url of [cfg.frontendBaseUrl, cfg.googleRedirectUri]) {
    try {
      const u = new URL(url);
      if (u.protocol === 'https:') hosts.push(u.hostname);
    } catch {
      // 未設定・不正なURLは対象外
    }
  }
  return [...new Set(hosts)];
}

/** 残り日数から表示の段階を決める(期限切れ/14日以内/30日以内/問題なし) */
function classifyDaysLeft(daysLeft) {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= DANGER_DAYS) return 'danger';
  if (daysLeft <= WARN_DAYS) return 'warning';
  return 'ok';
}

function daysUntil(date, now = Date.now()) {
  return Math.floor((date.getTime() - now) / DAY_MS);
}

/** 1ホストへTLS接続し、提示された証明書の期限を読む(証明書の検証エラーでも期限は読む) */
function fetchCertificate(host) {
  return new Promise((resolve) => {
    const socket = tls.connect({
      host,
      port: 443,
      servername: host,
      rejectUnauthorized: false,
      timeout: TLS_TIMEOUT_MS,
    });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      if (!cert || !cert.valid_to) {
        return done({ host, status: 'error', error: '証明書を取得できませんでした' });
      }
      const validTo = new Date(cert.valid_to);
      const daysLeft = daysUntil(validTo);
      done({
        host,
        status: socket.authorized ? classifyDaysLeft(daysLeft) : 'danger',
        validFrom: new Date(cert.valid_from).toISOString(),
        validTo: validTo.toISOString(),
        daysLeft,
        issuer: cert.issuer?.O || cert.issuer?.CN || null,
        subject: cert.subject?.CN || null,
        trusted: socket.authorized,
        error: socket.authorized ? null : `証明書を信頼できません(${socket.authorizationError})`,
      });
    });
    socket.once('timeout', () => done({ host, status: 'error', error: '接続がタイムアウトしました' }));
    socket.once('error', (err) => done({ host, status: 'error', error: `接続できませんでした(${err.code || err.message})` }));
  });
}

async function checkGoogleOrganizer() {
  if (!config.googleClientId) {
    return { configured: false, status: 'none' };
  }
  try {
    const result = await integrationService.checkOrganizerRefresh('google');
    if (!result.connected) return { configured: true, ...result, status: 'none' };
    return { configured: true, ...result, status: result.refreshOk ? 'ok' : 'danger' };
  } catch (err) {
    logger.error('[ExpiryMonitor] Google check failed:', err.message);
    return { configured: true, connected: null, status: 'error', refreshError: err.message };
  }
}

async function getExpiryStatus() {
  const hosts = resolveCertHosts();
  const [certificates, google] = await Promise.all([
    Promise.all(hosts.map(fetchCertificate)),
    checkGoogleOrganizer(),
  ]);
  return {
    checkedAt: new Date().toISOString(),
    thresholds: { warnDays: WARN_DAYS, dangerDays: DANGER_DAYS },
    certificates,
    google,
  };
}

module.exports = { getExpiryStatus, resolveCertHosts, classifyDaysLeft, daysUntil };
