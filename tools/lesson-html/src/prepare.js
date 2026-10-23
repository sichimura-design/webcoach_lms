// 教材HTMLを LMS 用に整える（何度かけても同じ結果になる）
//   1. lms-skin.css / lms-embed.js の2行（と viewport）を <head> に入れる（無いときだけ）
//   2. 「前の章へ」「次のレッスンに進む」などのボタンと、ボタンだけの枠を消す
//   3. LMS の中で崩れる CSS（100vh＋overflow:auto の箱、html・body の height:100% など）を直す
//   4. <title> と同じ h1 を消す（LMS の上部バーと二重になる）。--keep-h1 で残す
const fs = require('fs');
const { load, hasSkin, hasEmbed, navButtons, removeNav, titleH1s, headTags } = require('./html');
const { fixTraps } = require('./css');

function prepare(file, opts = {}) {
  const { $ } = load(file);
  const changes = [];

  const [skinTag, embedTag] = headTags();
  const missing = [];
  if (!$('meta[name="viewport"]').length) missing.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  if (!hasSkin($)) missing.push(skinTag);
  if (!hasEmbed($)) missing.push(embedTag);
  if (missing.length) {
    if ($('head').length) $('head').append('\n' + missing.join('\n') + '\n');
    else if ($('html').length) $('html').prepend('<head>\n' + missing.join('\n') + '\n</head>');
    else $.root().prepend(missing.join('\n') + '\n');
    const names = missing.map((t) => (t.includes('viewport') ? 'viewport' : t.includes('.css') ? 'lms-skin.css' : 'lms-embed.js'));
    changes.push(`<head> に足した: ${names.join('・')}`);
  }

  const navs = navButtons($);
  if (navs.length) {
    const labels = navs.map((el) => $(el).text().replace(/\s+/g, ' ').trim());
    navs.forEach((el) => removeNav($, el));
    changes.push(`前後ボタンを ${navs.length} 個消した（${[...new Set(labels)].join('／')}）`);
  }

  $('style').each((_, el) => {
    const r = fixTraps($(el).html() || '');
    if (r.fixed.length) {
      $(el).html(r.css);
      r.fixed.forEach((why) => changes.push(`LMS の中で崩れる CSS を直した: ${why}`));
    }
  });
  $('[style]').each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const r = fixTraps(`${tag}{${$(el).attr('style')}}`);
    if (r.fixed.length) {
      $(el).attr('style', r.css.slice(tag.length + 1, -1));
      r.fixed.forEach((why) => changes.push(`LMS の中で崩れる CSS を直した（style 属性）: ${why}`));
    }
  });

  if (!opts.keepH1) {
    const h1s = titleH1s($);
    if (h1s.length) {
      h1s.forEach((el) => $(el).remove());
      changes.push(`レッスン名と同じ h1 を ${h1s.length} 個消した（LMS の上部バーに出るため）`);
    }
  }

  if (changes.length) fs.writeFileSync(opts.out || file, $.html(), 'utf8');
  else if (opts.out && opts.out !== file) fs.copyFileSync(file, opts.out);
  return changes;
}

module.exports = { prepare };
