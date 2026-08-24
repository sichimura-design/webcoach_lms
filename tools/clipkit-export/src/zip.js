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

module.exports = { createZip };
