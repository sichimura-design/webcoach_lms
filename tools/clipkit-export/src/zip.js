/**
 * コースディレクトリを ZIP にまとめる。
 *
 * Node に ZIP コンテナを作る標準 API は無く、PowerShell の Compress-Archive に頼ると
 * Windows 専用になるため archiver を使う。
 */

const fs = require('fs');
const path = require('path');

/**
 * `<outDir>/<course-slug>/` の中身を `<outDir>/<course-slug>.zip` に格納する。
 * ZIP の中には `<course-slug>/html/...` のようにコース名のディレクトリを1段挟む。
 */
async function createZip({ courseDir, outPath }) {
  if (!fs.existsSync(courseDir)) {
    throw new Error(`コースディレクトリが見つかりません: ${courseDir}`);
  }

  const courseSlug = path.basename(courseDir);
  const target = outPath
    ? path.resolve(outPath)
    : path.join(path.dirname(courseDir), `${courseSlug}.zip`);

  fs.mkdirSync(path.dirname(target), { recursive: true });

  const archiver = require('archiver');
  const tmp = `${target}.tmp-${process.pid}`;

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(tmp);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', (warning) => {
      process.stderr.write(`[warn] zip: ${warning.message}\n`);
    });

    archive.pipe(output);
    // failures.* は取得作業のログなので ZIP には含めない。
    archive.glob('**/*', { cwd: courseDir, ignore: ['failures.json', 'failures.txt', '*.tmp-*'] }, {
      prefix: courseSlug,
    });
    archive.finalize();
  });

  fs.renameSync(tmp, target);
  return target;
}

/**
 * ディレクトリを丸ごと ZIP にする（コース単位ではなく納品物一式をまとめる用）。
 *
 * 既に圧縮済みのもの（WebP・mp4・woff2）に最大圧縮を掛けても CPU を使うだけなので、
 * 圧縮レベルは呼び出し側が決める。
 */
async function createArchive({ sourceDir, outPath, prefix = '', ignore = [], level = 9 }) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`ディレクトリが見つかりません: ${sourceDir}`);
  }

  const target = path.resolve(outPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });

  const archiver = require('archiver');
  const tmp = `${target}.tmp-${process.pid}`;

  const entries = await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(tmp);
    const archive = archiver('zip', { zlib: { level } });
    let count = 0;

    output.on('close', () => resolve(count));
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('entry', () => { count += 1; });
    archive.on('warning', (warning) => {
      process.stderr.write(`[warn] zip: ${warning.message}\n`);
    });

    archive.pipe(output);
    archive.glob('**/*', { cwd: sourceDir, ignore: ['*.tmp-*', '**/*.tmp-*', ...ignore] }, prefix ? { prefix } : {});
    archive.finalize();
  });

  fs.renameSync(tmp, target);
  return { path: target, entries, bytes: fs.statSync(target).size };
}

module.exports = { createZip, createArchive };
