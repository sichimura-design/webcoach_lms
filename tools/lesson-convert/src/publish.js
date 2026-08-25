/**
 * 変換済みの教材を、フロントエンドのモックが読める形で配置する。
 *
 *   画像・動画 → frontend/public/materials/<course>/…（デプロイでそのまま配信される）
 *   レッスンJSON → frontend/src/mocks/materials/<course>.json（バンドルに含める）
 *
 * 画像は横幅を抑えて WebP にする。元データが未最適化で、そのままでは
 * ビルド成果物として配れない大きさになるため。
 *
 * HTML 内の資産パスは `__ASSET__/images/…` というトークンにしておく。
 * 実際の URL はプレビューか本番かで変わる（PUBLIC_URL）ので、
 * 解決はフロント側の読み込み時に行う。
 */

const fs = require('fs');
const path = require('path');

const ASSET_TOKEN = '__ASSET__';

/** 変換の必要が無い形式。SVG はベクタなので触らない。 */
const PASSTHROUGH = new Set(['.svg', '.gif']);

async function optimizeImage(sharp, srcFile, destDir, { maxWidth, quality }) {
  const ext = path.extname(srcFile).toLowerCase();
  const base = path.basename(srcFile, ext);
  const srcBytes = fs.statSync(srcFile).size;

  if (PASSTHROUGH.has(ext)) {
    const dest = path.join(destDir, path.basename(srcFile));
    fs.copyFileSync(srcFile, dest);
    return { name: path.basename(srcFile), srcBytes, outBytes: srcBytes, converted: false };
  }

  const dest = path.join(destDir, `${base}.webp`);
  const buffer = await sharp(srcFile)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  // まれに WebP のほうが大きくなる。その場合は元をそのまま置く。
  if (buffer.length >= srcBytes) {
    const keep = path.join(destDir, path.basename(srcFile));
    fs.copyFileSync(srcFile, keep);
    return { name: path.basename(srcFile), srcBytes, outBytes: srcBytes, converted: false };
  }

  fs.writeFileSync(dest, buffer);
  return { name: `${base}.webp`, srcBytes, outBytes: buffer.length, converted: true };
}

/** ブロックHTML内の ../images/x.png を __ASSET__/images/x.webp に置き換える。 */
function rewriteAssets(html, imageMap, mediaNames) {
  let out = html.replace(/\.\.\/images\/([^"'）)\s]+)/g, (whole, name) => {
    const mapped = imageMap.get(name);
    return mapped ? `${ASSET_TOKEN}/images/${mapped}` : whole;
  });
  out = out.replace(/\.\.\/media\/([^"'）)\s]+)/g, (whole, name) =>
    (mediaNames.has(name) ? `${ASSET_TOKEN}/media/${name}` : whole));
  return out;
}

async function publishCourse({ course, lessonsDir, sourceDir, frontendDir, options, log }) {
  const sharp = require('sharp');

  const courseLessons = path.join(lessonsDir, course);
  const files = fs.readdirSync(courseLessons).filter((f) => f.endsWith('.json') && f !== 'index.json');
  const docs = files.map((f) => JSON.parse(fs.readFileSync(path.join(courseLessons, f), 'utf8')));

  // 実際に参照されている資産だけを配置する（未参照の画像を配りたくない）。
  // 画像・動画は本文HTMLだけでなく block.media にも入っている。
  // media にしたものは html から取り除いてあるので、両方を見ないと配置漏れになる。
  const usedImages = new Set();
  const usedMedia = new Set();
  const collect = (text) => {
    for (const m of (text || '').matchAll(/\.\.\/(images|media)\/([^"'）)\s]+)/g)) {
      (m[1] === 'images' ? usedImages : usedMedia).add(m[2]);
    }
  };
  for (const doc of docs) {
    for (const b of doc.blocks) {
      collect(b.html);
      if (b.media) collect(b.media.src);
    }
  }

  const publicDir = path.join(frontendDir, 'public', 'materials', course);
  const imagesOut = path.join(publicDir, 'images');
  const mediaOut = path.join(publicDir, 'media');
  fs.mkdirSync(imagesOut, { recursive: true });

  const imageMap = new Map();
  let srcTotal = 0;
  let outTotal = 0;
  for (const name of usedImages) {
    const srcFile = path.join(sourceDir, course, 'images', name);
    if (!fs.existsSync(srcFile)) { log(`  [warn] 画像が見つかりません: ${name}`); continue; }
    /* eslint-disable no-await-in-loop -- 直列で十分。メモリを使いすぎない */
    const r = await optimizeImage(sharp, srcFile, imagesOut, options);
    /* eslint-enable no-await-in-loop */
    imageMap.set(name, r.name);
    srcTotal += r.srcBytes;
    outTotal += r.outBytes;
  }

  if (usedMedia.size > 0) {
    fs.mkdirSync(mediaOut, { recursive: true });
    for (const name of usedMedia) {
      const srcFile = path.join(sourceDir, course, 'media', name);
      if (fs.existsSync(srcFile)) fs.copyFileSync(srcFile, path.join(mediaOut, name));
    }
  }

  // 前回の配置で置いたが今回は参照されなくなったファイルを消す。
  // 残しておくとビルド成果物に不要なものが混ざり続ける。
  const stale = [];
  const sweep = (dir, keep) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      if (keep.has(name)) continue;
      fs.unlinkSync(path.join(dir, name));
      stale.push(path.join(path.basename(dir), name));
    }
  };
  sweep(imagesOut, new Set(imageMap.values()));
  sweep(mediaOut, usedMedia);
  if (stale.length > 0) log(`    不要ファイルを削除: ${stale.length}件（${stale.slice(0, 3).join(', ')}${stale.length > 3 ? ' …' : ''}）`);

  // レッスンJSON（資産パスをトークンへ置換）
  const published = docs
    .sort((a, b) => a.lessonId - b.lessonId)
    .map((doc) => ({
      ...doc,
      blocks: doc.blocks.map((b) => ({
        ...b,
        html: rewriteAssets(b.html, imageMap, usedMedia),
        ...(b.media ? { media: { ...b.media, src: rewriteAssets(b.media.src, imageMap, usedMedia) } } : {}),
      })),
    }));

  const bundle = {
    courseSlug: course,
    courseName: options.courseName || course,
    assetBase: `materials/${course}`,
    lessonCount: published.length,
    lessons: published,
  };

  // 配置漏れの自己点検。JSON が指す資産が実ファイルとして置かれているかを確かめる。
  // 参照元（html / media）を1つでも見落とすと、画面で画像が壊れる。
  const referenced = new Set();
  for (const lesson of published) {
    for (const b of lesson.blocks) {
      for (const m of `${b.html || ''}${b.media ? b.media.src : ''}`.matchAll(/__ASSET__\/(images|media)\/([^"'）)\s]+)/g)) {
        referenced.add(path.join(m[1] === 'images' ? imagesOut : mediaOut, m[2]));
      }
    }
  }
  const brokenRefs = [...referenced].filter((f) => !fs.existsSync(f));
  const unresolved = published.flatMap((l) =>
    l.blocks.flatMap((b) => [...`${b.html || ''}${b.media ? b.media.src : ''}`.matchAll(/\.\.\/(images|media)\/[^"'）)\s]+/g)].map((m) => m[0]))
  );
  if (brokenRefs.length > 0 || unresolved.length > 0) {
    throw new Error(
      `配置に漏れがあります。実ファイルが無い参照 ${brokenRefs.length}件 / ` +
        `置換されなかったパス ${unresolved.length}件\n  ${[...brokenRefs, ...unresolved].slice(0, 3).join('\n  ')}`
    );
  }

  const mockDir = path.join(frontendDir, 'src', 'mocks', 'materials');
  fs.mkdirSync(mockDir, { recursive: true });
  const bundleFile = path.join(mockDir, `${course}.json`);
  fs.writeFileSync(bundleFile, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');

  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  log(`  ${course}`);
  log(`    画像   : ${imageMap.size}枚  ${mb(srcTotal)}MB → ${mb(outTotal)}MB（${Math.round((1 - outTotal / srcTotal) * 100)}%減）`);
  if (usedMedia.size) log(`    動画   : ${usedMedia.size}件（そのまま配置）`);
  log(`    レッスン: ${published.length}件  ${mb(Buffer.byteLength(JSON.stringify(bundle)))}MB`);
  log(`    配置先 : ${publicDir}`);
  log(`             ${bundleFile}`);

  return { course, images: imageMap.size, srcTotal, outTotal, lessons: published.length };
}

async function runPublish({ configPath, courses, options, log }) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const configDir = path.dirname(configPath);
  const lessonsDir = path.resolve(configDir, config.outDir);
  const sourceDir = path.resolve(configDir, config.sourceDir);
  const frontendDir = path.resolve(configDir, '../../frontend');

  if (!fs.existsSync(frontendDir)) throw new Error(`frontend が見つかりません: ${frontendDir}`);

  const results = [];
  for (const course of courses) {
    if (!fs.existsSync(path.join(lessonsDir, course))) {
      throw new Error(`変換済みデータがありません: ${course}（先に convert を実行してください）`);
    }
    /* eslint-disable no-await-in-loop -- コースは直列に処理する */
    results.push(await publishCourse({ course, lessonsDir, sourceDir, frontendDir, options, log }));
    /* eslint-enable no-await-in-loop */
  }
  return results;
}

module.exports = { runPublish, ASSET_TOKEN };
