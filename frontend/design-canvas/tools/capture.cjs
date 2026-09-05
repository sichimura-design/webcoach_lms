/**
 * 実装画面のキャプチャツール（design-canvas 用の「正解」を取るためのもの）
 *
 * Claude Design のアートボード（.dc.html）は手写しで作る。そのとき寸法・色・
 * フォントサイズを目分量にしないための材料を、動いている実装から機械的に吸い出す。
 *
 * 出力（frontend/design-canvas/_capture/<画面ID>/ ・git 管理外）:
 *   1440.png        フルページのスクリーンショット（375.png も対象画面のみ）
 *   1440.html       #root の outerHTML（構造の確認用。アートボードには貼らない）
 *   1440.styles.json  見た目に効く要素の getComputedStyle ダンプ
 *   1440.tokens.json  :root / body に解決された --dc-* の実値（clamp が数値になった状態）
 *
 * 使い方は同ディレクトリの README.md を参照。
 */
const fs = require('fs');
const path = require('path');

// Playwright は frontend の依存ではなく、既にある clipkit-export のものを借りる
// （新規 npm install をしないための逃げ道。chromium も導入済み）
const { chromium } = require(path.resolve(__dirname, '../../../tools/clipkit-export/node_modules/playwright'));

const BASE_URL = process.env.CAPTURE_BASE_URL || 'http://localhost:3000';
const OUT_ROOT = path.resolve(__dirname, '../_capture');

/** モック認証のログイン済みフラグ（src/mocks/mockAuth.ts の LOGGED_IN_KEY） */
const LOGGED_IN_KEY = 'webcoach-mock-logged-in';
/** 学習タイマーの永続ストア（src/store/studyTimerStore.ts の persist name）。打診の抑止に使う */
const STUDY_TIMER_KEY = 'webcoach-study-timer';

/**
 * 対象画面。id は frontend/docs/ui-review/screen-inventory.csv の画面ID に合わせる。
 * - loggedIn: false の画面は未ログイン状態で開く（/login が出てほしいので）
 * - widths: 撮るビューポート幅（既定 [1440]）。SP も見たい画面は 375 を足す
 * - settle: 非同期の描画が落ち着くまでの待ち（ms）。アニメーションが長い画面は伸ばす
 */
const DEFAULT_WIDTHS = [1440];

const SCREENS = [
  { id: 'PUB-01', route: '/login', loggedIn: false },
  { id: 'PUB-02', route: '/password-reset', loggedIn: false },
  // /connect/:token はトークンを先に発行しないと 404 になる（invitesStore は空で始まる）
  { id: 'PUB-03', route: '/connect/__ISSUE__', loggedIn: false, issueInvite: 903 },

  { id: 'STU-01', route: '/mypage', widths: [1440, 375], settle: 2000 },
  // 「動くアートボード」を書くための状態違い。押した後の見た目を撮る
  { id: 'STU-01-sidebar', route: '/mypage', settle: 2000, clicks: ['button[aria-label="サイドバーをひらく"]'] },
  { id: 'STU-01-aicoach', route: '/mypage', settle: 2000, clicks: ['button[aria-label="AIコーチに相談"]'] },
  { id: 'STU-01-account', route: '/mypage', settle: 2000, clicks: ['button[aria-label^="アカウント"]'] },
  { id: 'STU-02', route: '/study-log', settle: 2000 },
  // /courses だけ useScaleToFit(1440) を使う唯一の画面（MaterialsTopPage.tsx:25,57）。
  // 1440 ビューポートだとサイドバー 72px ぶん足りず scale 0.95 がかかり、
  // 測った px が 0.95 倍になって写経の値として使えない。1520 なら scale 1 のまま撮れる。
  // 縮尺が決まるのに数秒かかるので settle も長めにしている。
  { id: 'STU-03', route: '/courses', widths: [1520, 375], settle: 5000 },
  { id: 'STU-04', route: '/course/1/curriculum', settle: 1800 },
  { id: 'STU-05', route: '/course/1', widths: [1440, 375], settle: 2500 },
  { id: 'STU-06', route: '/notes', settle: 2500 },
  // ノートを開いた状態（編集UI）。ここの操作性を作り直したいので状態を押さえておく
  {
    id: 'STU-06-note', route: '/notes', settle: 2500,
    clicks: [
      'article[aria-label="8/19 コーチングまとめを開く"]',
    ],
  },
  // 新規作成の直後（空のノート）。文言は「新しいノートを作成」→「新しいノート」に変わった
  {
    id: 'STU-06-new', route: '/notes', settle: 2500,
    clicks: [
      'button:has-text("新しいノート")',
    ],
  },
  { id: 'STU-07', route: '/coaching', widths: [1440, 375], settle: 2000 },
  // コーチングの記録（公開済みセッションを開いた状態）。
  // 1002 は mocks/coachingHandlers.ts の seedAll で「第3回コーチング・published・反映済み」。
  {
    id: 'STU-07-session', route: '/coaching?session=1002', widths: [1440, 375], settle: 3000,
  },
  { id: 'STU-08', route: '/learning-plan', settle: 1500 },
  { id: 'STU-09', route: '/learning-plan/setup', settle: 1500 },
  // aa の fadeInUp で、カード一覧が 120ms 遅れて入る。settle が短いと撮り逃す
  { id: 'STU-10', route: '/ai-coach', settle: 5000 },
  // AIアプリの詳細（新ルート）。原稿が無いので本文は「準備中」1行
  { id: 'STU-10-app', route: '/ai-coach/apps/design-review', settle: 3000 },
  { id: 'STU-11', route: '/account-settings', settle: 1500 },
  { id: 'STU-12', route: '/profile', settle: 1500 },
  { id: 'STU-13a', route: '/help/manual', settle: 1200 },
  { id: 'STU-13b', route: '/help/faq', settle: 1200 },
  // /badges はモック環境では必ず ErrorBoundary になる。BadgesPage.tsx:21-32 が bffClient を
  // 通さず process.env.REACT_APP_BFF_URL を直接読んでいて、モックでは未設定のため throw する。
  // MSW にリクエストが届かないので、キャプチャからは実際の見た目を取れない。
  { id: 'STU-14', route: '/badges', settle: 1500, knownBroken: 'モックでは REACT_APP_BFF_URL 未設定で必ずエラー画面になる' },
];

/** 見た目に効く CSS プロパティだけを拾う（全部だと JSON が読めない大きさになる） */
const STYLE_PROPS = [
  'display', 'flexDirection', 'gridTemplateColumns', 'gap', 'alignItems', 'justifyContent',
  'width', 'height', 'maxWidth', 'minWidth',
  'padding', 'margin',
  'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'color', 'backgroundColor', 'backgroundImage',
  'border', 'borderRadius', 'boxShadow', 'opacity',
];

/**
 * ページ内で走らせる採取スクリプト。
 * 「文字を直接持つ要素」と「箱として見えている要素」だけに絞る。
 * それ以外（レイアウト用の透明な div）はアートボードを写すときに要らない。
 */
function collectStyles({ props, limit }) {
  const root = document.getElementById('root');
  if (!root) return { error: '#root not found' };

  const out = [];
  const transparent = new Set(['rgba(0, 0, 0, 0)', 'transparent']);

  /** その要素が直接持っているテキスト（子要素のぶんは含めない） */
  function ownText(el) {
    let t = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) t += n.nodeValue;
    }
    return t.trim();
  }

  /** 祖先をたどって「nth-of-type つきのタグ列」を作る。どの要素の話か特定するため */
  function pathOf(el) {
    const parts = [];
    let cur = el;
    while (cur && cur !== root && parts.length < 12) {
      const parent = cur.parentElement;
      if (!parent) break;
      const same = Array.from(parent.children).filter((c) => c.tagName === cur.tagName);
      const idx = same.indexOf(cur) + 1;
      parts.unshift(same.length > 1 ? `${cur.tagName.toLowerCase()}:nth-of-type(${idx})` : cur.tagName.toLowerCase());
      cur = parent;
    }
    return parts.join(' > ');
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = root;
  while (node && out.length < limit) {
    const cs = getComputedStyle(node);
    if (cs.display !== 'none' && cs.visibility !== 'hidden') {
      const text = ownText(node);
      const boxed =
        !transparent.has(cs.backgroundColor) ||
        cs.boxShadow !== 'none' ||
        cs.borderTopStyle !== 'none' ||
        cs.backgroundImage !== 'none';

      if (text || boxed) {
        const rect = node.getBoundingClientRect();
        const style = {};
        for (const p of props) style[p] = cs[p];
        out.push({
          path: pathOf(node),
          tag: node.tagName.toLowerCase(),
          cls: (node.getAttribute('class') || '').slice(0, 120),
          text: text.slice(0, 60),
          rect: { w: Math.round(rect.width), h: Math.round(rect.height), x: Math.round(rect.x), y: Math.round(rect.y) },
          style,
        });
      }
    }
    node = walker.nextNode();
  }
  return { count: out.length, truncated: out.length >= limit, elements: out };
}

/**
 * カスタムプロパティの採取。
 *
 * 注意: `--dc-*` は `:root` ではなく `.mypage-3d` のようなスコープクラスに置かれている。
 * また custom property の getPropertyValue は生の宣言（`clamp(...)` のまま）を返すので、
 * ここで clamp が数値に解決されることはない。**解決後の実値は styles.json のほうにある**
 * （font-size や padding が px で入っている）。こちらは「どの selector が何を定義しているか」を掴む用。
 */
function collectTokens() {
  const seen = new Set();
  const names = [];
  const declarations = [];

  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // クロスオリジンの CSS は読めない（Google Fonts など）
    }
    for (const rule of Array.from(rules || [])) {
      if (!rule.style || !rule.selectorText) continue;
      const own = {};
      for (const prop of Array.from(rule.style)) {
        if (!prop.startsWith('--')) continue;
        own[prop] = rule.style.getPropertyValue(prop).trim();
        if (!seen.has(prop)) {
          seen.add(prop);
          names.push(prop);
        }
      }
      if (Object.keys(own).length) declarations.push({ selector: rule.selectorText, props: own });
    }
  }
  names.sort();

  const readFrom = (el) => {
    const cs = getComputedStyle(el);
    const o = {};
    for (const n of names) {
      const v = cs.getPropertyValue(n).trim();
      if (v) o[n] = v;
    }
    return o;
  };

  const root = document.getElementById('root');

  // スコープクラスに置かれたトークンは :root からは見えないので、
  // 実際に --dc-* を持っている要素を先頭から拾って一緒に出す
  const scoped = [];
  const dcNames = names.filter((n) => n.startsWith('--dc-'));
  if (dcNames.length) {
    for (const el of Array.from(document.querySelectorAll('#root *')).slice(0, 4000)) {
      const cs = getComputedStyle(el);
      if (!cs.getPropertyValue(dcNames[0]).trim()) continue;
      scoped.push({
        selector: `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(/\s+/).filter(Boolean).join('.')}`,
        props: readFrom(el),
      });
      break; // 同じ値が延々続くので最初の 1 つで足りる
    }
  }

  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    bodyClass: document.body.className,
    ':root': readFrom(document.documentElement),
    body: readFrom(document.body),
    '#root': root ? readFrom(root) : null,
    scoped,
    declarations,
  };
}

/** 発行済みの招待トークンを 1 つ作る。MSW のストアはページ内メモリなので同じページで完結させる */
async function issueInviteToken(page, coachId) {
  return page.evaluate(async (id) => {
    const res = await fetch('/api/webcoach/meeting-connections/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachIds: [id], baseUrl: window.location.origin }),
    });
    if (!res.ok) throw new Error(`invite issue failed: ${res.status}`);
    const data = await res.json();
    return data.invites && data.invites[0] ? data.invites[0].token : null;
  }, coachId);
}

/** React Router を使ったページ内遷移。リロードしないので MSW のストアが消えない */
async function spaNavigate(page, to) {
  await page.evaluate((url) => {
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, to);
}

/**
 * MSW の Service Worker がページを制御下に置くまで待つ。
 * `networkidle` は worker.start() の完了より先に来るので、これを待たずに fetch すると
 * ハンドラを素通りして 404 になる（/connect のトークン発行がまさにそれで落ちていた）。
 */
async function waitForMockWorker(page, timeout = 8000) {
  try {
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout });
    return true;
  } catch {
    return false;
  }
}

/** CRA のコンパイルエラーオーバーレイが出ているか（消さずに見るだけ） */
function hasCompileOverlay(page) {
  return page.evaluate(
    () => !!document.querySelector('#webpack-dev-server-client-overlay, iframe[id^="webpack-dev-server"]'),
  );
}

/** 1 回ぶんの読み込み。オーバーレイ有無と最終パスを返す */
async function loadScreen(page, screen) {
  let route = screen.route;

  if (screen.issueInvite) {
    // トークン発行のために一度どこかを開く必要がある。未ログインでも /login は開ける
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await waitForMockWorker(page);
    // controller が付いた直後はまだ worker.start() が終わっておらず、ハンドラを
    // 素通りして 404 になる。ここは数秒待つのがいちばん確実だった。
    await page.waitForTimeout(2500);
    const token = await issueInviteToken(page, screen.issueInvite);
    if (!token) throw new Error(`${screen.id}: 招待トークンを発行できなかった`);
    route = screen.route.replace('__ISSUE__', token);
    await spaNavigate(page, route);
  } else {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
    await waitForMockWorker(page);
  }

  await page.waitForTimeout(screen.settle || 1200);

  // 状態違い（サイドバー展開・ドロワーが開いた状態など）を撮るためのクリック。
  // 押せなかったら黙って通り過ぎず、その場で落とす（撮れたことにするのがいちばん困る）。
  // 出たり出なかったりするもの（学習セッションの記録ダイアログなど）は optional にする。
  for (const step of screen.clicks || []) {
    const selector = typeof step === 'string' ? step : step.selector;
    const optional = typeof step === 'object' && step.optional;
    const target = page.locator(selector).first();
    try {
      await target.waitFor({ state: 'visible', timeout: optional ? 2500 : 5000 });
    } catch (e) {
      if (optional) continue;
      throw new Error(`クリック対象が出てこない: ${selector}`);
    }
    // force は「重なりの判定を飛ばして、その要素をそのまま押す」。
    // 学習セッションの打診ダイアログは背面レイヤーがクリックを吸うので、これが要る。
    await target.click({ force: typeof step === 'object' && !!step.force });
    // 開閉のアニメーション（framer-motion）が終わるまで待つ
    await page.waitForTimeout(900);
  }

  return {
    route,
    overlay: await hasCompileOverlay(page),
    finalPath: await page.evaluate(() => window.location.pathname),
  };
}

async function captureOne(context, screen, width) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height: 900 });

  await page.addInitScript(
    ({ key, loggedIn, timerKey }) => {
      try {
        if (loggedIn) localStorage.setItem(key, '1');
        else localStorage.removeItem(key);

        /*
         * 学習セッションの打診ダイアログ（StudySessionHost）を出さないようにする。
         * 学習ページを開くたびに「コーチングの時間を記録しますか？」が画面を覆い、
         * 「あとで」を押しても別カテゴリに移るとまた出るので、クリックで消すのは当てにならない。
         * 判定は「今日すでに PROMPT_DECLINE_LIMIT(3) 回断ったか」なので、
         * その状態を先に書いておく（studyTimerStore の persist 形式）。
         */
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const counts = { material: 3, ai: 3, coaching: 3, review: 3, other: 3 };
        const prev = JSON.parse(localStorage.getItem(timerKey) || '{}');
        localStorage.setItem(timerKey, JSON.stringify({
          ...prev,
          version: 3,
          state: { ...(prev.state || {}), promptDeclinedOn: today, promptDeclineCounts: counts },
        }));
      } catch {
        /* localStorage 不可の環境では何もしない */
      }
    },
    { key: LOGGED_IN_KEY, loggedIn: screen.loggedIn !== false, timerKey: STUDY_TIMER_KEY },
  );

  // 開発サーバは編集のたびに再コンパイルするので、たまたまエラー中／認証チェックが
  // 間に合わずリダイレクト、という当たりを引くことがある。数回やり直せばだいたい抜ける。
  // 既知の壊れている画面はやり直しても直らないので 1 回で切り上げる
  const MAX_ATTEMPTS = screen.knownBroken ? 1 : 3;
  let loaded;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    loaded = await loadScreen(page, screen);
    const pathOk = loaded.finalPath === loaded.route.split('?')[0];
    if (!loaded.overlay && pathOk) break;
    if (attempt < MAX_ATTEMPTS) await page.waitForTimeout(5000); // 再コンパイルの完了を待つ
  }
  const { route, finalPath } = loaded;

  // 最後まで残ったオーバーレイは画面を覆うので消してから撮る。ただし結果には必ず残す
  // （気づかずに壊れた PNG を「撮れたこと」にするのがいちばん困る）。
  const overlay = loaded.overlay;
  if (overlay) {
    await page.evaluate(() => {
      const el = document.querySelector('#webpack-dev-server-client-overlay, iframe[id^="webpack-dev-server"]');
      if (el) el.remove();
    });
  }

  const outDir = path.join(OUT_ROOT, screen.id);
  fs.mkdirSync(outDir, { recursive: true });
  // オーバーレイ入りの回で正常なキャプチャを潰さないよう、壊れた回は別名に逃がす。
  // 開発サーバが編集で再コンパイル中だと、正常に撮れた直後の実行がこれを踏むことがある。
  const stem = path.join(outDir, overlay && !screen.knownBroken ? `${width}.BROKEN` : String(width));

  /*
   * 🔴 採寸はスクリーンショットより先にやる。
   * fullPage スクショは撮るあいだビューポートをページ全体の高さに変えるので、
   * そのあとで測るとスクロールバーの有無が変わった状態の値を拾ってしまう
   * （実際、マイページの本文が x=72 ではなく x=66 で記録され、アートボードのほうが
   *   正しいのに 8px ズレていると誤検知した）。
   */
  const html = await page.evaluate(() => {
    const r = document.getElementById('root');
    return r ? r.outerHTML : '<!-- #root not found -->';
  });
  fs.writeFileSync(`${stem}.html`, html, 'utf8');

  const styles = await page.evaluate(collectStyles, { props: STYLE_PROPS, limit: 1500 });
  fs.writeFileSync(`${stem}.styles.json`, JSON.stringify(styles, null, 2), 'utf8');

  const tokens = await page.evaluate(collectTokens);
  fs.writeFileSync(`${stem}.tokens.json`, JSON.stringify(tokens, null, 2), 'utf8');

  await page.screenshot({ path: `${stem}.png`, fullPage: true });

  // 画面が本当に出ているかの自己チェック。未ログインへ弾かれた等をここで気づけるようにする
  const title = await page.evaluate(() => {
    const h = document.querySelector('#root h1, #root h2');
    return h ? h.textContent.trim().slice(0, 40) : '(見出しなし)';
  });

  await page.close();
  return { screen: screen.id, width, route, finalPath, title, elements: styles.count, compileOverlay: !!overlay };
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const targets = only.length ? SCREENS.filter((s) => only.includes(s.id)) : SCREENS;
  if (!targets.length) {
    console.error(`該当する画面IDがない: ${only.join(', ')}`);
    process.exit(1);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 1, locale: 'ja-JP' });

  const report = [];
  for (const screen of targets) {
    for (const width of screen.widths || DEFAULT_WIDTHS) {
      try {
        const r = await captureOne(context, screen, width);
        report.push(r);
        const warn = screen.knownBroken
          ? `  ℹ 既知: ${screen.knownBroken}`
          : (r.finalPath !== r.route.split('?')[0] ? '  ⚠ 遷移先がずれた' : '') +
            (r.compileOverlay ? '  ⚠ コンパイルエラーのオーバーレイが出ていた（このキャプチャは信用しない）' : '') +
            // /login のような単純な画面は 20 要素前後で正常なので、明らかに空のときだけ言う
            (r.elements < 8 ? '  ⚠ ほぼ空。描画待ちが足りないかデータ取得が失敗している' : '');
        console.log(`✓ ${r.screen} @${width}  ${r.finalPath}  「${r.title}」  ${r.elements}要素${warn}`);
      } catch (e) {
        report.push({ screen: screen.id, width, error: String(e && e.message) });
        console.log(`✗ ${screen.id} @${width}  ${e && e.message}`);
      }
    }
  }

  await browser.close();
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  fs.writeFileSync(path.join(OUT_ROOT, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

  const failed = report.filter((r) => r.error);
  console.log(`\n${report.length - failed.length}/${report.length} 件成功  → ${OUT_ROOT}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
