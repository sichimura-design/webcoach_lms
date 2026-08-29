#!/usr/bin/env node

/**
 * Clipkit 教材エクスポートツール。
 *
 * 使い方:
 *   node src/cli.js login  --base-url https://<host>
 *   node src/cli.js export --config ./clipkit.config.json [options]
 *   node src/cli.js zip    --config ./clipkit.config.json --course <slug>
 *
 * 詳細は README.md を参照。ID・パスワードは一切受け取らない（login はブラウザで手入力）。
 */

const path = require('path');

const TOOL_DIR = path.resolve(__dirname, '..');

const USAGE = `
Clipkit 教材エクスポートツール

  node src/cli.js login  --base-url <url> [--verify-url <url>] [--state <path>]
                         [--keep-open] [--timeout <秒>]
      ブラウザを開いて手動ログインし、認証状態(storageState)を保存する。
      初回と、セッションが切れたときだけ実行する。
      対話ターミナルなら Enter で完了。非対話ならログイン成功を自動検知する
      （--verify-url に教材ページを渡すと、そこが開けるかで確実に判定する）。

  node src/cli.js export --config <path> [options]
      設定ファイルの URL 一覧から教材を取得し、materials/source 配下に保存する。

      --course <slug>       指定コースのみ処理する
      --limit <n>           各コースの先頭 n 件だけ処理する（動作確認用）
      --concurrency <n>     並列取得数（既定 2）
      --delay <ms>          ページ間の待機（既定 500）
      --page-timeout <秒>   1ページに掛ける上限（既定 300）。超えたら失敗にして次へ進む
      --force               内容が同じでも再取得・再書き込みする
      --allow-shrink        本文が前回より激減しても上書きする（既定では保護して失敗扱い）
      --debug               本文抽出の候補セレクタとスコアを表示する
      --headed              ブラウザを表示して実行する（デバッグ用）
      --state <path>        storageState のパスを上書きする
      --zip                 取得後に ZIP も作る
      --slug-source title   ファイル名をページタイトルから作る（既定は URL 由来）

  node src/cli.js zip --config <path> --course <slug> [--out <path>]
      既に取得済みのコースディレクトリを ZIP にまとめる。

終了コード: 0=全件成功 / 1=失敗ページあり / 2=設定・引数エラー
`;

/** `--key value` と `--flag` だけを解釈する最小のパーサ。 */
function parseArgs(argv) {
  const options = {};
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }

  return { options, positional };
}

function toPositiveInt(value, fallback) {
  if (value === undefined || value === true) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toNonNegativeInt(value, fallback) {
  if (value === undefined || value === true) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { options } = parseArgs(rest);

  if (!command || command === 'help' || options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  if (command === 'login') {
    const { runLogin } = require('./login');
    await runLogin({
      toolDir: TOOL_DIR,
      baseUrl: typeof options['base-url'] === 'string' ? options['base-url'] : null,
      statePath: typeof options.state === 'string' ? path.resolve(options.state) : null,
      keepOpen: Boolean(options['keep-open']),
      // 非対話実行のとき、この URL が開けるかどうかでログイン成功を確実に判定する。
      verifyUrl: typeof options['verify-url'] === 'string' ? options['verify-url'] : null,
      timeoutMs: toPositiveInt(options['timeout'], 0) * 1000 || null,
    });
    return 0;
  }

  if (command === 'export') {
    if (typeof options.config !== 'string') {
      throw new Error('--config <path> が必要です。');
    }
    const { runExport } = require('./export');
    const { failureCount } = await runExport({
      toolDir: TOOL_DIR,
      config: options.config,
      courseFilter: typeof options.course === 'string' ? options.course : null,
      storageState: typeof options.state === 'string' ? path.resolve(options.state) : null,
      limit: toNonNegativeInt(options.limit, 0),
      concurrency: toPositiveInt(options.concurrency, 2),
      delayMs: toNonNegativeInt(options.delay, 500),
      // 1ページに掛ける総時間の上限（秒）。超えたらそのページを失敗にして次へ進む。
      pageDeadlineMs: toPositiveInt(options['page-timeout'], 300) * 1000,
      force: Boolean(options.force),
      // 本文が前回より激減しても上書きを許す。教材が実際に短くなった場合だけ使う。
      allowShrink: Boolean(options['allow-shrink']),
      debug: Boolean(options.debug),
      headed: Boolean(options.headed),
      zip: Boolean(options.zip),
      zipOut: typeof options.out === 'string' ? options.out : null,
      // 既定は URL 由来。再実行やページ順の入れ替えでもファイル名が変わらない。
      // 'title' は英語タイトルのときだけ読みやすくなるが、並列取得だと決定的にならない。
      slugSource: options['slug-source'] === 'title' ? 'title' : 'url',
    });
    return failureCount > 0 ? 1 : 0;
  }

  if (command === 'zip') {
    if (typeof options.config !== 'string') {
      throw new Error('--config <path> が必要です。');
    }
    if (typeof options.course !== 'string') {
      throw new Error('--course <slug> が必要です。');
    }

    const { loadConfig } = require('./export');
    const { createZip } = require('./zip');

    const configPath = path.resolve(options.config);
    const config = loadConfig(configPath);
    const outDir = path.isAbsolute(config.outDir)
      ? config.outDir
      : path.resolve(path.dirname(configPath), config.outDir);

    const zipPath = await createZip({
      courseDir: path.join(outDir, options.course),
      outPath: typeof options.out === 'string' ? options.out : null,
    });
    process.stdout.write(`${zipPath}\n`);
    return 0;
  }

  process.stderr.write(`不明なコマンド: ${command}\n${USAGE}\n`);
  return 2;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`\nエラー: ${error.message}\n`);
    if (process.env.CLIPKIT_DEBUG_STACK) process.stderr.write(`${error.stack}\n`);
    process.exitCode = 2;
  });
