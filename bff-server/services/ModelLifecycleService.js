/**
 * Model Lifecycle Service
 * 使っているClaudeのモデルの提供状況と引退予定日(=使える期限)を調べる
 *
 * Models APIには引退日が無いので、Anthropicの「Model deprecations」ページ(Markdown版)の
 * 「Model status」表を読む。表の形が変わったら読めなくなるが、そのときは null を返し
 * 画面はページへのリンクだけ出す。
 */

const axios = require('axios');
const logger = require('../utils/logger');

const SOURCE_URL = 'https://platform.claude.com/docs/en/about-claude/model-deprecations';
const CACHE_MS = 24 * 60 * 60 * 1000;
// 引退予定日がこれより近ければ画面で注意を出す
const WARN_DAYS = 90;

const STATE_LABELS = {
  active: '提供中',
  legacy: '更新終了(いずれ非推奨になる見込み)',
  deprecated: '非推奨(引退日が決まっています)',
  retired: '提供終了',
};

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

/** "Not sooner than October 15, 2026" → { date: '2026-10-15', notSoonerThan: true } */
function parseDate(text) {
  const m = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(text || '');
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  if (month < 0) return null;
  const date = `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return { date, notSoonerThan: /not sooner than/i.test(text) };
}

/** ページのMarkdownから { モデル名: { state, deprecated, retirement } } を作る */
function parseStatusTable(markdown) {
  const rows = {};
  for (const line of markdown.split('\n')) {
    const cells = line.split('|').map((c) => c.trim().replace(/`/g, ''));
    // | claude-xxx | Active | N/A | Not sooner than ... |
    if (cells.length < 6 || !/^claude-/.test(cells[1])) continue;
    rows[cells[1]] = {
      state: cells[2].toLowerCase(),
      deprecated: parseDate(cells[3]),
      retirement: parseDate(cells[4]),
      retirementText: cells[4],
    };
  }
  return rows;
}

/** 表の名前と使っているIDが別名(日付の有無)でも同じモデルとみなす */
function findRow(rows, modelId) {
  if (rows[modelId]) return rows[modelId];
  const name = Object.keys(rows).find((n) => n.startsWith(`${modelId}-`) || modelId.startsWith(`${n}-`));
  return name ? rows[name] : null;
}

class ModelLifecycleService {
  constructor() {
    this._cache = { at: 0, rows: null };
  }

  async _rows() {
    if (this._cache.rows && Date.now() - this._cache.at < CACHE_MS) return this._cache.rows;
    const res = await axios.get(`${SOURCE_URL}.md`, { timeout: 5000, responseType: 'text' });
    const rows = parseStatusTable(String(res.data));
    if (Object.keys(rows).length === 0) throw new Error('Model status表が見つかりません');
    this._cache = { at: Date.now(), rows };
    return rows;
  }

  /** 画面用: 取れなければ lifecycle は null(リンクだけ出す) */
  async describe(modelId, now = new Date()) {
    const result = { id: modelId, sourceUrl: SOURCE_URL, lifecycle: null };
    if (!modelId) return result;
    try {
      const row = findRow(await this._rows(), modelId);
      if (!row) return result;
      const days = row.retirement
        ? Math.floor((Date.parse(`${row.retirement.date}T00:00:00+09:00`) - now.getTime()) / 86400000)
        : null;
      result.lifecycle = {
        state: row.state,
        stateLabel: STATE_LABELS[row.state] || row.state,
        deprecatedOn: row.deprecated ? row.deprecated.date : null,
        retirementOn: row.retirement ? row.retirement.date : null,
        // 「この日より前には引退しない」という目安の日付か(Activeのモデル)
        retirementNotSoonerThan: row.retirement ? row.retirement.notSoonerThan : false,
        retirementText: row.retirementText,
        daysUntilRetirement: days,
        warning: row.state !== 'active' || (days !== null && days <= WARN_DAYS),
      };
    } catch (error) {
      logger.error('[ModelLifecycle] モデルの提供状況を取得できませんでした:', error.message);
    }
    return result;
  }
}

module.exports = new ModelLifecycleService();
module.exports.parseStatusTable = parseStatusTable;
