/**
 * 画像を「配って回せる大きさ」に落とす。lesson-convert（LMSへの配置）と
 * clipkit-export（エンジニアへの受け渡し）の両方から使う。
 *
 * 元データが未最適化で、そのままでは数百MBになるため横幅を抑えて WebP にする。
 * SVG はベクタ、GIF はアニメーションが壊れるので触らない。
 * WebP のほうが大きくなることがまれにあり、その場合は元をそのまま採用する。
 *
 * sharp は遅延 require する。呼び出し側がこのモジュールを読み込むだけで
 * ネイティブモジュールの解決に失敗しないようにするため。
 */

const fs = require('fs');
const path = require('path');

/** 変換の必要が無い形式。 */
const PASSTHROUGH = new Set(['.svg', '.gif']);

const DEFAULT_OPTIONS = { maxWidth: 1600, quality: 80 };

/**
 * sharp の在りか。このモジュールは tools/shared にあるので、素の `require('sharp')` では
 * 各ツールの node_modules を見に行かない。どちらかのツールに入っていれば使う。
 */
const SHARP_CANDIDATES = [
  'sharp',
  path.join(__dirname, '..', 'clipkit-export', 'node_modules', 'sharp'),
  path.join(__dirname, '..', 'lesson-convert', 'node_modules', 'sharp'),
];

let cachedSharp = null;
function getSharp() {
  if (cachedSharp) return cachedSharp;
  const errors = [];
  for (const candidate of SHARP_CANDIDATES) {
    try {
      cachedSharp = require(candidate);
      return cachedSharp;
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }
  throw new Error(
    `sharp を読み込めません。どちらかのツールで npm install してください。\n  ${errors.join('\n  ')}`
  );
}

/** 同期の待ち。rename の再試行にだけ使う。 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** 置換先を誰かが掴んでいるときの Windows のエラー。少し待てば通る。 */
const LOCKED = new Set(['EPERM', 'EBUSY', 'EACCES']);

/**
 * 一時ファイル → rename の原子的書き込み。並行呼び出しでも壊れたファイルが残らない。
 * Windows では書いた直後のファイルをウイルス対策等が掴んで rename が EPERM になるので、
 * 数回だけ待って再試行する。
 */
function writeFileAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    fs.writeFileSync(tmp, data);

    const delays = [0, 50, 150, 400, 1000];
    for (let attempt = 0; attempt < delays.length; attempt += 1) {
      try {
        if (delays[attempt] > 0) sleepSync(delays[attempt]);
        fs.renameSync(tmp, filePath);
        return;
      } catch (error) {
        if (!LOCKED.has(error.code) || attempt === delays.length - 1) throw error;
      }
    }
  } catch (error) {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch (cleanupError) {
      /* 後片付けの失敗で本来のエラーを隠さない */
    }
    throw error;
  }
}

/**
 * バッファのまま最適化する。ファイル名を呼び出し側が決める場合（content hash など）に使う。
 * 変換しなかった場合は入力をそのまま返すので、返り値の ext を必ず見ること。
 */
async function optimizeBuffer(buffer, ext, options = {}) {
  const { maxWidth, quality } = { ...DEFAULT_OPTIONS, ...options };
  const normalizedExt = String(ext || '').toLowerCase();

  if (PASSTHROUGH.has(normalizedExt)) {
    return { buffer, ext: normalizedExt, converted: false };
  }

  let converted;
  try {
    converted = await getSharp()(buffer)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  } catch (error) {
    // sharp が読めない形式（ico・壊れた画像・実体は HTML だったなど）。元のまま通す。
    return { buffer, ext: normalizedExt, converted: false, error: error.message };
  }

  if (converted.length >= buffer.length) {
    return { buffer, ext: normalizedExt, converted: false };
  }
  return { buffer: converted, ext: '.webp', converted: true };
}

/**
 * ファイル単位の最適化。`<destDir>/<元の名前>.webp` に書き、結果のファイル名を返す。
 * lesson-convert の publish が使っている形。
 */
async function optimizeImageFile(srcFile, destDir, options = {}) {
  const ext = path.extname(srcFile).toLowerCase();
  const base = path.basename(srcFile, ext);
  const srcBytes = fs.statSync(srcFile).size;

  const result = await optimizeBuffer(fs.readFileSync(srcFile), ext, options);

  if (!result.converted) {
    const keep = path.join(destDir, path.basename(srcFile));
    writeFileAtomic(keep, result.buffer);
    return { name: path.basename(srcFile), srcBytes, outBytes: srcBytes, converted: false };
  }

  writeFileAtomic(path.join(destDir, `${base}.webp`), result.buffer);
  return { name: `${base}.webp`, srcBytes, outBytes: result.buffer.length, converted: true };
}

module.exports = {
  PASSTHROUGH,
  DEFAULT_OPTIONS,
  optimizeBuffer,
  optimizeImageFile,
  writeFileAtomic,
};
