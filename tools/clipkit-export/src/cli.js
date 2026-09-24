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

  node src/cli.js snapshot --config <path> [options]
      教材ページを「元ページのフルHTML」として materials/handoff 配下に保存する。
      export と違い <head> もテーマCSSも込みで、見た目が再現できる形にする（受け渡し用）。
      画像は取得済みの materials/source から流用するので、取りに行くのは HTML と CSS だけ。

      --course <slug>       指定コースのみ処理する
      --url <部分文字列>    URL がこれを含むページだけ処理する（1ページだけ試す／取り直す）
      --limit <n>           各コースの先頭 n 件だけ処理する（動作確認用）
      --concurrency <n>     並列取得数（既定 2）
      --delay <ms>          ページ間の待機（既定 500）
      --page-timeout <秒>   1ページに掛ける上限（既定 300）
      --force               取得済みのページも取り直す
      --skip-seed           既存画像の取り込み（Pass 1）を飛ばす
      --max-width <px>      画像の横幅上限（既定 1600）
      --quality <n>         WebP の品質（既定 80）
      --screenshot          ライブのスクリーンショットも保存する（目視確認用）
      --headed              ブラウザを表示して実行する
      --out <dir>           出力先（既定 materials/handoff）
      --build               終わったら README・一覧・ZIP まで作る
      --no-media            ZIP に動画を含めず、別 ZIP に分ける

  node src/cli.js fetch-missing --config <path> [--out <dir>] [--probe]
      snapshot が絶対URLのまま残した参照（動画・外部CDNの画像など）を回収し、
      HTML の参照をローカルへ差し替える。--probe は取得せずに大きさだけ測る。

  node src/cli.js handoff --out <dir> [--no-media] [--no-zip] [--prune]
      snapshot の出力に README.md と index.html を足して ZIP にまとめる。
      --prune はどのページからも参照されていない資産を消す。
      **全コースを取り切ったあとにだけ**使うこと（部分実行のあとに掛けると必要な資産まで消える）。

  node src/cli.js check --out <dir> [--course <slug>] [--limit <n>]
      出力した HTML を file:// で開き、ローカル参照の 404 と、
      残っていると事故る属性（base / integrity / srcset / blob / script）を数える。

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

  if (command === 'snapshot') {
    if (typeof options.config !== 'string') {
      throw new Error('--config <path> が必要です。');
    }
    const { runSnapshot } = require('./snapshot');
    const result = await runSnapshot({
      toolDir: TOOL_DIR,
      config: options.config,
      courseFilter: typeof options.course === 'string' ? options.course : null,
      urlFilter: typeof options.url === 'string' ? options.url : null,
      storageState: typeof options.state === 'string' ? path.resolve(options.state) : null,
      outDir: typeof options.out === 'string' ? options.out : null,
      limit: toNonNegativeInt(options.limit, 0),
      concurrency: toPositiveInt(options.concurrency, 2),
      delayMs: toNonNegativeInt(options.delay, 500),
      pageDeadlineMs: toPositiveInt(options['page-timeout'], 300) * 1000,
      force: Boolean(options.force),
      skipSeed: Boolean(options['skip-seed']),
      maxWidth: toPositiveInt(options['max-width'], 1600),
      quality: toPositiveInt(options.quality, 80),
      screenshot: Boolean(options.screenshot),
      headed: Boolean(options.headed),
    });

    if (options.build) {
      const { runBuild } = require('./handoff');
      await runBuild({
        outDir: result.outDir,
        includeMedia: !options['no-media'],
        log: (message) => process.stdout.write(`${message}\n`),
      });
    }

    return result.failureCount > 0 ? 1 : 0;
  }

  if (command === 'fetch-missing') {
    if (typeof options.config !== 'string') {
      throw new Error('--config <path> が必要です。');
    }
    const { runFetchMissing } = require('./fetch-missing');
    const result = await runFetchMissing({
      toolDir: TOOL_DIR,
      config: options.config,
      storageState: typeof options.state === 'string' ? path.resolve(options.state) : null,
      outDir: typeof options.out === 'string' ? options.out : null,
      probe: Boolean(options.probe),
      maxWidth: toPositiveInt(options['max-width'], 1600),
      quality: toPositiveInt(options.quality, 80),
    });
    return result.failed > 0 ? 1 : 0;
  }

  if (command === 'handoff') {
    if (typeof options.out !== 'string') {
      throw new Error('--out <dir> が必要です（snapshot の出力先）。');
    }
    const { runBuild } = require('./handoff');
    await runBuild({
      outDir: path.resolve(options.out),
      includeMedia: !options['no-media'],
      zip: !options['no-zip'],
      prune: Boolean(options.prune),
      log: (message) => process.stdout.write(`${message}\n`),
    });
    return 0;
  }

  if (command === 'check') {
    if (typeof options.out !== 'string') {
      throw new Error('--out <dir> が必要です（snapshot の出力先）。');
    }
    const { runCheck } = require('./handoff');
    const { broken } = await runCheck({
      outDir: path.resolve(options.out),
      courseFilter: typeof options.course === 'string' ? options.course : null,
      limit: toNonNegativeInt(options.limit, 0),
      log: (message) => process.stdout.write(`${message}\n`),
    });
    return broken.length > 0 ? 1 : 0;
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
