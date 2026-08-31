/**
 * docs/human-ui-ux-review-plan.md から、スプレッドシート用の CSV を生成する。
 *   - review-wbs.csv       : フェーズ1〜5の全レビュータスク
 *   - review-dayplan.csv   : 1日ごとの計画
 *   - review-findings.csv  : 指摘記録フォーマット（ヘッダ＋記入例）
 *   - review-progress.csv  : タスク進捗表（WBSのIDを転記済み）
 * Excel でそのまま開けるよう UTF-8 BOM 付きで出力する。
 *
 * 使い方: node docs/tools/md2csv.js
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, '..');           // docs/
const SRC = path.join(OUT_DIR, 'human-ui-ux-review-plan.md');

const md = fs.readFileSync(SRC, 'utf8');
const lines = md.split(/\r?\n/);

/** 「# 3.」のような見出しで本文を区切る */
function sectionLines(startPattern, endPattern) {
  const start = lines.findIndex((l) => startPattern.test(l));
  if (start < 0) throw new Error(`section not found: ${startPattern}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => endPattern.test(l));
  return end < 0 ? rest : rest.slice(0, end);
}

const isRow = (l) => /^\s*\|/.test(l);
const isSeparator = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l);

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) =>
      c
        .trim()
        .replace(/<br\s*\/?>/gi, '\n')   // セル内改行
        .replace(/\*\*/g, '')            // 太字マーク
        .replace(/`/g, '')               // コード記法
    );
}

/** 連続する表を [{header, rows}] で取り出す */
function extractTables(src) {
  const tables = [];
  let cur = null;
  for (let i = 0; i < src.length; i += 1) {
    const line = src[i];
    if (!isRow(line)) { cur = null; continue; }
    if (isSeparator(line)) continue;
    const cells = splitRow(line);
    if (!cur) {
      cur = { header: cells, rows: [] };
      tables.push(cur);
    } else {
      cur.rows.push(cells);
    }
  }
  return tables;
}

function toCsv(header, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}

function write(name, header, rows) {
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, '\uFEFF' + toCsv(header, rows) + '\r\n', 'utf8');
  console.log(`${name}: ${rows.length} rows x ${header.length} cols`);
  return rows;
}

// ---- 1. WBS（フェーズ1〜5の表をすべて連結）--------------------------------
const wbsSection = sectionLines(/^# 3\. /, /^# 4\. /);
const wbsTables = extractTables(wbsSection);
const wbsHeader = wbsTables[0].header;
const wbsRows = [];
for (const t of wbsTables) {
  if (t.header.length !== wbsHeader.length) {
    throw new Error(`column count mismatch: ${t.header.slice(0, 3).join('/')}`);
  }
  wbsRows.push(...t.rows);
}
write('review-wbs.csv', wbsHeader, wbsRows);

// ---- 2. 1日ごとの計画 -------------------------------------------------------
const dayTable = extractTables(sectionLines(/^# 4\. /, /^# 5\. /))[0];
write('review-dayplan.csv', dayTable.header, dayTable.rows);

// ---- 3. 指摘記録フォーマット -------------------------------------------------
const findingsTable = extractTables(sectionLines(/^## 5\.1 /, /^## 5\.2 /))[0];
const findingsRows = findingsTable.rows.filter((r) => r.some((c) => c !== ''));
write('review-findings.csv', findingsTable.header, findingsRows);

// ---- 4. タスク進捗表（WBSのIDを転記して空欄で用意）----------------------------
const progressHeader = [
  'タスクID', 'フェーズ', '優先度', '想定時間', 'レビュー対象', '予定日',
  '実施日', '所要時間', 'ステータス', '指摘(高)', '指摘(中)', '指摘(低)',
  '問題なしの項目数', '保存したスクリーンショット', 'メモ',
];
const col = (name) => wbsHeader.indexOf(name);
const dayOf = new Map();
for (const row of dayTable.rows) {
  const day = row[0];
  for (const id of (row[2] || '').split(/[,、]\s*/)) {
    if (id.trim()) dayOf.set(id.trim(), day);
  }
}
const progressRows = wbsRows.map((r) => [
  r[col('ID')],
  r[col('フェーズ')],
  r[col('優先度')],
  r[col('想定時間')],
  r[col('レビュー対象')],
  dayOf.get(r[col('ID')]) ? `${dayOf.get(r[col('ID')])}日目` : '',
  '', '',
  r[col('ステータス')],
  '', '', '', '', '', '',
]);
write('review-progress.csv', progressHeader, progressRows);

// ---- 検算 -------------------------------------------------------------------
const counts = {};
for (const r of wbsRows) {
  const prefix = r[0].split('-')[0];
  counts[prefix] = (counts[prefix] || 0) + 1;
}
console.log('内訳:', counts);
const unplanned = wbsRows.map((r) => r[0]).filter((id) => !dayOf.has(id));
console.log('日程未割当:', unplanned.length ? unplanned.join(', ') : 'なし');
