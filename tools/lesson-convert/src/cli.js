#!/usr/bin/env node

/**
 * 取得済み教材HTML → LessonDoc JSON への変換ツール。
 *
 * 使い方:
 *   node src/cli.js convert [--course <slug>]   変換して materials/lessons へ書き出す
 *   node src/cli.js verify                      変換結果を機械検査する
 *
 * materials/source/ は読み取りのみ。書き込みは materials/lessons/ だけ。
 */

const fs = require('fs');
const path = require('path');

const TOOL_DIR = path.resolve(__dirname, '..');
const DEFAULT_CONFIG = path.join(TOOL_DIR, 'convert.config.json');

const USAGE = `
教材HTML → LessonDoc JSON 変換ツール

  node src/cli.js convert [--course <slug>] [--config <path>]
      materials/source/ の取得結果を読み、materials/lessons/ に構造化JSONを書き出す。
      内容が変わったファイルだけ書き込む（再実行しても結果が変わらない）。

  node src/cli.js preview [--config <path>]
      変換結果をブラウザで確認するための静的HTMLを materials/lessons/ に生成する。

  node src/cli.js publish --course <slug> [--max-width 1600] [--quality 80]
      指定コースを frontend に配置する。画像は縮小・WebP化して
      frontend/public/materials/<course>/ へ、レッスンJSONは
      frontend/src/mocks/materials/<course>.json へ書き出す。

  node src/cli.js verify [--config <path>]
      変換結果を検査する。本文の取りこぼし・クイズの抽出漏れ・ID重複などを一覧にする。

終了コード: 0=問題なし / 1=要確認あり / 2=引数・設定エラー
`;

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) options[key] = true;
    else { options[key] = next; i += 1; }
  }
  return options;
}

const log = (m) => process.stdout.write(`${m}\n`);
const pct = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(0)}%` : '-');

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const options = parseArgs(rest);
  const configPath = path.resolve(typeof options.config === 'string' ? options.config : DEFAULT_CONFIG);

  if (!command || command === 'help' || options.help) { log(USAGE); return 0; }
  if (!fs.existsSync(configPath)) throw new Error(`設定ファイルがありません: ${configPath}`);

  if (command === 'convert') {
    const { runConvert } = require('./convert');
    log('================ 変換 ================');
    const { issues } = runConvert({
      configPath,
      courseFilter: typeof options.course === 'string' ? options.course : null,
      log,
    });
    const quizIssues = issues.filter((i) => i.kind === 'quiz-unresolved');
    log(`\n変換で解決できなかったクイズ: ${quizIssues.length} 件`);
    quizIssues.slice(0, 20).forEach((i) =>
      log(`  ${i.course}/${i.slug} [${i.blockId}] ${i.reason}（${i.source}）`)
    );
    if (quizIssues.length > 20) log(`  … 他 ${quizIssues.length - 20} 件`);
    log('\n続けて検査するには: node src/cli.js verify');
    return 0;
  }

  if (command === 'preview') {
    const { runPreview } = require('./preview');
    log('================ プレビュー生成 ================');
    const { indexFile } = runPreview({ configPath, log });
    log(`\n入口: ${indexFile}`);
    log('ダブルクリックで開けます（サーバー不要）。');
    return 0;
  }

  if (command === 'publish') {
    if (typeof options.course !== 'string') throw new Error('--course <slug> が必要です。');
    const { runPublish } = require('./publish');
    log('================ frontend への配置 ================');
    return runPublish({
      configPath,
      courses: options.course.split(',').map((c) => c.trim()).filter(Boolean),
      options: {
        maxWidth: Number(options['max-width']) || 1600,
        quality: Number(options.quality) || 80,
        courseName: typeof options.name === 'string' ? options.name : null,
      },
      log,
    }).then(() => {
      log('\n配置しました。frontend のモックから読み込めます。');
      return 0;
    });
  }

  if (command === 'verify') {
    const { runVerify } = require('./verify');
    const { rows, kindTotals } = runVerify({ configPath, log });
    const ng = rows.filter((r) => r.problems.length > 0);

    log('================ 変換結果の検査 ================');
    log(`レッスン数 : ${rows.length}`);
    log(`問題なし   : ${rows.length - ng.length}`);
    log(`要確認     : ${ng.length}`);

    log('\n--- コース別 ---');
    log('コース            レッスン ブロック  本文カバー率  ゴール 所要時間 まとめ 前後 クイズ(構造化)');
    const courses = [...new Set(rows.map((r) => r.course))];
    for (const c of courses) {
      const list = rows.filter((r) => r.course === c);
      const sum = (k) => list.reduce((a, r) => a + r[k], 0);
      const cov = sum('sourceChars') > 0 ? sum('blockChars') / sum('sourceChars') : 0;
      log(
        `${c.padEnd(17)}${String(list.length).padStart(6)}${String(sum('blocks')).padStart(9)}` +
          `${(cov * 100).toFixed(1).padStart(12)}%` +
          `${pct(list.filter((r) => r.goals > 0).length, list.length).padStart(8)}` +
          `${pct(list.filter((r) => r.minutes > 0).length, list.length).padStart(9)}` +
          `${pct(sum('summary'), list.length).padStart(7)}` +
          `${pct(list.filter((r) => r.prev || r.next).length, list.length).padStart(5)}` +
          `${String(sum('quizStructured')).padStart(8)}/${sum('quizBlocks')}`
      );
    }
    const all = (k) => rows.reduce((a, r) => a + r[k], 0);
    log(
      `${'合計'.padEnd(16)}${String(rows.length).padStart(6)}${String(all('blocks')).padStart(9)}` +
        `${((all('blockChars') / all('sourceChars')) * 100).toFixed(1).padStart(12)}%` +
        `${pct(rows.filter((r) => r.goals > 0).length, rows.length).padStart(8)}` +
        `${pct(rows.filter((r) => r.minutes > 0).length, rows.length).padStart(9)}` +
        `${pct(all('summary'), rows.length).padStart(7)}` +
        `${pct(rows.filter((r) => r.prev || r.next).length, rows.length).padStart(5)}` +
        `${String(all('quizStructured')).padStart(8)}/${all('quizBlocks')}`
    );

    log('\n--- ブロック種別の内訳 ---');
    const totalBlocks = Object.values(kindTotals).reduce((a, b) => a + b, 0);
    Object.entries(kindTotals).sort((a, b) => b[1] - a[1])
      .forEach(([k, n]) => log(`  ${k.padEnd(10)} ${String(n).padStart(6)} (${pct(n, totalBlocks)})`));

    if (ng.length > 0) {
      const byKind = {};
      ng.forEach((r) => r.problems.forEach((p) => {
        const key = p.replace(/[0-9]+/g, 'N').replace(/:.*$/, '');
        (byKind[key] = byKind[key] || []).push(r);
      }));
      log('\n--- 問題の種類別 ---');
      Object.entries(byKind).sort((a, b) => b[1].length - a[1].length)
        .forEach(([k, v]) => log(`  ${String(v.length).padStart(4)} レッスン  ${k}`));

      log('\n--- 要確認レッスン（上位25） ---');
      ng.slice(0, 25).forEach((r) =>
        log(`  ${r.course.padEnd(15)} ${r.slug.padEnd(14)} ${(r.title || '').slice(0, 26).padEnd(28)} ${r.problems.join(' / ')}`)
      );
      if (ng.length > 25) log(`  … 他 ${ng.length - 25} 件`);
    }

    return ng.length > 0 ? 1 : 0;
  }

  process.stderr.write(`不明なコマンド: ${command}\n${USAGE}\n`);
  return 2;
}

Promise.resolve()
  .then(() => main())
  .then((code) => { process.exitCode = code; })
  .catch((error) => {
    process.stderr.write(`\nエラー: ${error.message}\n`);
    if (process.env.LESSON_CONVERT_DEBUG) process.stderr.write(`${error.stack}\n`);
    process.exitCode = 2;
  });
