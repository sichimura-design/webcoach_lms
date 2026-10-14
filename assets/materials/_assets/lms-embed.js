/* WEBCOACH LMS 埋め込み用（materials/_assets/lms-embed.js）
   ・自分の高さを親（LMS）へ知らせ、LMS 側で iframe を伸ばしてもらう（二重スクロールを無くす）
   ・外部リンクは別タブで開く（iframe の中で他サイトへ遷移させない）
   ・data-lms-route="/study-log" のリンクは LMS の画面へ同じタブで移る（親に遷移を頼む）。
     親が応答しない（古い LMS）ときは href を別タブで開く
   ・旧サイト（Clipkit = learn.webcoach.jp）の記事へのリンクは、同じフォルダの lesson-map.json を見て
     LMS のレッスンへの data-lms-route に付け替える。非公開コース行き（unlink）はリンクを外す。
     表に無いものは Clipkit のまま（別タブ）。教材 HTML は書き換えない（B-003）
   ・本文のテキストを親へ渡す（'wc-lesson:text'）。LMS の「AIに聞く」が教材を根拠に答えるため。
     iframe は別オリジンなので、親からは中身を読めない（2026-10 以前は AI にレッスン名しか届いていなかった）
   ・文章を選んだら、その文章・直前の見出し・前後300字・画面上の位置を親へ知らせる（'wc-lesson:selection'）。
     親（LMS）はそこに「AIに聞く／メモに引用」を出す。選択が外れたら text: '' を送る
   ・どちらも、受け取らない古い LMS では何も起きない
   ・確認クイズ・目次・コピーボタンなど、移行で消えた教材内の script の代わり（末尾の「教材内の操作」、2026-10-11） */
(function () {
  if (window.parent === window) return; // 単体で開いたときは何もしない（data-lms-route も href へそのまま飛ぶ）
  var SRC = document.currentScript ? document.currentScript.src : '';
  var last = 0, timer = 0, pending = 0;
  // learn.webcoach.jp の URL → 対応表のキー。記事は末尾5文字の ID、一覧ページはパス。画像・ファイル・RSS は対象外
  function keyOf(href) {
    var m = /^https?:\/\/learn\.webcoach\.jp(\/[^?#]*)/i.exec(href || '');
    if (!m) return null;
    var p = m[1].toLowerCase().replace(/\/+$/, '');
    try { p = decodeURI(p).toLowerCase(); } catch (e) { /* そのまま */ }
    if (/\/(theme|media)\/|\.(png|jpe?g|gif|svg|webp|pdf|rss)$/.test(p)) return null;
    var id = p.slice(p.lastIndexOf('/') + 1);
    return /^[a-z0-9]{5}$/.test(id) ? id : p.replace(/^\//, '');
  }
  function unlinkEl(a) {
    // ボタン型（「ロードマップに戻る」など）は行き先が無いので消す。文中のリンクは文字だけ残す
    var st = a.getAttribute('style') || '';
    if (/inline-block|padding/.test(st) || /btn|button/i.test(a.className || '')) { a.parentNode.removeChild(a); return; }
    var span = document.createElement('span');
    while (a.firstChild) span.appendChild(a.firstChild);
    a.parentNode.replaceChild(span, a);
  }
  function applyMap(map) {
    var links = document.querySelectorAll('a[href*="learn.webcoach.jp"]');
    var routes = map.routes || {}, unlink = {};
    for (var j = 0; j < (map.unlink || []).length; j++) unlink[map.unlink[j]] = 1;
    for (var i = 0; i < links.length; i++) {
      var a = links[i], k = keyOf(a.getAttribute('href'));
      if (!k || a.hasAttribute('data-lms-route')) continue;
      if (routes[k]) a.setAttribute('data-lms-route', routes[k]);
      else if (unlink[k]) unlinkEl(a);
    }
    schedule();
  }
  function loadMap() {
    if (!SRC || !window.fetch || !document.querySelector('a[href*="learn.webcoach.jp"]')) return;
    fetch(new URL('lesson-map.json', SRC).href).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (map) { if (map) applyMap(map); }).catch(function () { /* 表が無ければ Clipkit のまま */ });
  }
  function measure() {
    var b = document.body, h = document.documentElement;
    return Math.max(b ? b.scrollHeight : 0, h ? h.scrollHeight : 0);
  }
  function send() {
    timer = 0;
    var height = measure();
    if (Math.abs(height - last) < 2) return;
    last = height;
    window.parent.postMessage({ type: 'wc-lesson:height', height: height }, '*');
  }
  function schedule() { if (!timer) timer = setTimeout(send, 50); }
  function fixLinks() {
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], href = a.getAttribute('href') || '';
      if (href.charAt(0) === '#' || /^javascript:/i.test(href)) continue;
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  }
  function onRouteClick(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-lms-route]') : null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var path = a.getAttribute('data-lms-route') || '';
    if (path.charAt(0) !== '/' || path.indexOf('//') >= 0) return;
    e.preventDefault();
    var href = a.href;
    clearTimeout(pending);
    pending = setTimeout(function () { window.open(href, '_blank', 'noopener'); }, 600);
    window.parent.postMessage({ type: 'wc-lesson:navigate', path: path }, '*');
  }
  // ---- 本文テキスト（AI に渡す） ----
  var TEXT_MAX = 8000;
  function squash(s) { return String(s || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, ''); }
  function lessonText() {
    // innerText は display:none（lms-skin.css で隠した旧サイトの枠など）を含まない
    var root = document.querySelector('main') || document.body;
    return squash(root ? (root.innerText || root.textContent) : '').slice(0, TEXT_MAX);
  }
  function sendText() {
    window.parent.postMessage({ type: 'wc-lesson:text', text: lessonText(), title: document.title || '' }, '*');
  }
  // ---- 文章の選択（親に「AIに聞く／メモに引用」を出してもらう） ----
  var SEL_MIN = 2, SEL_MAX = 400, AROUND = 300, lastSel = '';
  function selectionInfo() {
    var sel = window.getSelection ? window.getSelection() : null;
    var text = sel ? squash(sel.toString()) : '';
    if (!sel || sel.rangeCount === 0 || text.length < SEL_MIN || text.length > SEL_MAX) return null;
    var range = sel.getRangeAt(0), root = document.body;
    var before = document.createRange(); before.selectNodeContents(root); before.setEnd(range.startContainer, range.startOffset);
    var after = document.createRange(); after.selectNodeContents(root); after.setStart(range.endContainer, range.endOffset);
    var heading = null, hs = root.querySelectorAll('h1, h2, h3, h4');
    for (var i = 0; i < hs.length; i++) {
      var hr = document.createRange(); hr.selectNode(hs[i]);
      if (hr.compareBoundaryPoints(Range.START_TO_START, range) > 0) break;
      var ht = squash(hs[i].textContent); if (ht) heading = ht;
    }
    var r = range.getBoundingClientRect();
    return { text: text, heading: heading, before: squash(before.toString()).slice(-AROUND), after: squash(after.toString()).slice(0, AROUND),
      rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
  }
  function onSelectEnd() {
    setTimeout(function () {
      var info = selectionInfo();
      var key = info ? info.text + '|' + Math.round(info.rect.top) : '';
      if (key === lastSel) return;
      lastSel = key;
      var msg = info || { text: '' }; msg.type = 'wc-lesson:selection';
      window.parent.postMessage(msg, '*');
    }, 0);
  }
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent || !e.data) return;
    if (e.data.type === 'wc-lesson:navigate-ack') clearTimeout(pending);
    if (e.data.type === 'wc-lesson:text-request') sendText();
    if (e.data.type === 'wc-lesson:clear-selection') { try { window.getSelection().removeAllRanges(); } catch (x) { /* 無視 */ } lastSel = ''; }
  });
  function start() {
    fixLinks();
    loadMap();
    send();
    sendText();
    document.addEventListener('mouseup', onSelectEnd);
    document.addEventListener('keyup', onSelectEnd);
    document.addEventListener('touchend', onSelectEnd);
    window.addEventListener('load', sendText);
    document.addEventListener('click', onRouteClick);
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
    window.addEventListener('load', schedule);
    window.addEventListener('resize', schedule);
    // 画像の遅延読み込み・details の開閉で高さが変わる
    document.addEventListener('load', schedule, true);
    document.addEventListener('toggle', schedule, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* ---- 教材内の操作（2026-10-11 追加）----
   Clipkit から移すとき、教材 HTML の <script> はすべて消した（tools/clipkit-export/src/snapshot-dom.js）。
   そのため確認クイズなどが押しても反応しなかった（LMS改善点C 相談1・3）。
   元の各ページの script（assets/materials/<領域>/raw/ に残っているもの）と同じ動きを、ここで全ページに付け直す。
   ・教材 HTML は書き換えない。クリックは document で受ける（イベント委譲）
   ・onclick="answer(...)" などで呼ばれる関数は、ページ側に無いときだけ window に置く
   ・LMS に埋め込まれていないとき（単体で開いたとき）も動かす
   ・教材内の目次（a[href="#..."]）は、LMS の画面（iframe の外）をスクロールして見出しへ移る */
(function () {
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function closest(el, sel) { return el && el.closest ? el.closest(sel) : null; }
  function isTrue(el) { return el.getAttribute('data-correct') === 'true'; }
  function show(el, how) { if (el) el.style.display = how || 'block'; }
  function define(name, fn) { if (typeof window[name] !== 'function') window[name] = fn; }

  // 1. .quiz-opt[data-q]（大半の教材）：同じ data-q の選択肢を締め、正解に .correct・他は .dim、#<q>-ok / -ng に .show
  function quizOpt(btn) {
    var q = btn.getAttribute('data-q');
    var opts = $all('.quiz-opt').filter(function (o) { return o.getAttribute('data-q') === q; });
    if (opts.some(function (o) { return o.disabled; })) return;
    var ok = isTrue(btn);
    opts.forEach(function (o) { o.disabled = true; });
    btn.classList.add(ok ? 'correct' : 'wrong');
    opts.forEach(function (o) {
      if (o === btn) return;
      o.classList.add(isTrue(o) ? 'correct' : 'dim');
    });
    var fb = document.getElementById(q + '-' + (ok ? 'ok' : 'ng'));
    if (fb) fb.classList.add('show');
  }

  // 2. .inline-quiz の .quiz-opt（data-q 無し・生成AI）：元は style を直接書き換えていた
  function inlineQuiz(quiz, opt) {
    if (quiz.getAttribute('data-wc-answered')) return;
    quiz.setAttribute('data-wc-answered', '1');
    var ok = isTrue(opt);
    $all('.quiz-opt', quiz).forEach(function (o) {
      o.style.pointerEvents = 'none'; o.style.opacity = '0.6'; o.classList.add('answered');
      if (isTrue(o)) { o.style.borderColor = '#4CAF50'; o.style.background = '#E8F5E9'; o.style.opacity = '1'; o.style.color = '#2E7D32'; }
    });
    if (!ok) { opt.style.borderColor = '#E85D4A'; opt.style.background = '#FFF3F0'; opt.style.color = '#C62828'; opt.style.opacity = '1'; }
    var fb = quiz.querySelector('.quiz-feedback');
    if (fb) {
      fb.style.display = 'block';
      fb.style.background = ok ? '#E8F5E9' : '#FFF3E0';
      fb.style.borderLeft = '4px solid ' + (ok ? '#4CAF50' : '#E85D4A');
    }
  }

  // 3. .quiz-block の .quiz-btn[data-correct]（onclick 無し・Web広告）：.correct / .wrong と .correct-fb / .wrong-fb
  function quizBlockBtn(block, btn) {
    var btns = $all('.quiz-btn', block);
    if (btns.some(function (b) { return b.disabled; })) return;
    var ok = isTrue(btn);
    btns.forEach(function (b) { b.disabled = true; if (b !== btn && isTrue(b)) b.classList.add('correct'); });
    btn.classList.add(ok ? 'correct' : 'wrong');
    show(block.querySelector(ok ? '.correct-fb' : '.wrong-fb'));
  }

  // 4. ケース問題 .case-opt（プロジェクト）：判断が #<case>-feedback の data-correct と合うか
  function caseOpt(btn) {
    var c = btn.getAttribute('data-case');
    var fb = document.getElementById(c + '-feedback');
    var opts = $all('.case-opt').filter(function (o) { return o.getAttribute('data-case') === c; });
    if (!fb || opts.some(function (o) { return o.disabled; })) return;
    var answer = fb.getAttribute('data-correct');
    var ok = btn.getAttribute('data-judge') === answer;
    opts.forEach(function (o) {
      o.disabled = true;
      if (o.getAttribute('data-judge') === answer) o.classList.add('correct');
      else if (o !== btn) o.classList.add('dim');
    });
    if (!ok) btn.classList.add('wrong');
    fb.classList.add('show');
    if (!ok) fb.classList.add('wrong-shown');
  }

  // 5. コピーボタン（プロンプト・Slack 文面・テンプレート）
  function copyText(btn, target) {
    if (!target) return;
    var text = target.innerText || target.textContent || '';
    var label = btn.querySelector('[class$="__copy-text"]') || btn;
    var original = label.textContent;
    function done() {
      btn.classList.add('copied'); label.textContent = 'コピーしました';
      setTimeout(function () { btn.classList.remove('copied'); label.textContent = original; }, 1800);
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) { /* 無視 */ }
      document.body.removeChild(ta); done();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  // 6. 用語ツールチップ .tt[data-tip]（タップで開閉。吹き出し .tt__pop は取得時の HTML にもう入っている）
  var openTip = null;
  function resetPop(el) {
    var op = el && el.querySelector('.tt__pop');
    if (op) { op.style.left = ''; op.style.right = ''; op.style.transform = ''; op.classList.remove('tt__pop--below'); }
  }
  function toggleTip(el) {
    var pop = el.querySelector('.tt__pop');
    if (!pop) {
      pop = document.createElement('span'); pop.className = 'tt__pop';
      var lbl = document.createElement('span'); lbl.className = 'tt__pop-label'; lbl.textContent = '用語解説';
      pop.appendChild(lbl); pop.appendChild(document.createTextNode(el.getAttribute('data-tip') || '')); el.appendChild(pop);
    }
    if (openTip && openTip !== el) { openTip.classList.remove('open'); resetPop(openTip); }
    el.classList.toggle('open'); openTip = el.classList.contains('open') ? el : null;
    if (!openTip) return;
    resetPop(el);
    requestAnimationFrame(function () {
      if (pop.getBoundingClientRect().top < 8) pop.classList.add('tt__pop--below');
      var r = pop.getBoundingClientRect();
      if (r.right > window.innerWidth - 8) { pop.style.left = 'auto'; pop.style.right = '0'; pop.style.transform = 'none'; }
      else if (r.left < 8) { pop.style.left = '0'; pop.style.transform = 'none'; }
    });
  }

  // 7. 教材内の目次：iframe は高さいっぱいまで伸ばしてあり（scrolling="no"）、スクロールするのは LMS 側。
  //    同じオリジン（本番は study.webcoach.jp/materials/）なら LMS のスクロール枠を直接動かす。
  //    別オリジン（devプレビュー→uat.webcoach.jp 等）では中から触れないので、位置を親へ知らせる（'wc-lesson:scroll'）
  function scrollParentOf(el) {
    for (var p = el.parentElement; p; p = p.parentElement) {
      var oy = p.ownerDocument.defaultView.getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
    }
    return el.ownerDocument.scrollingElement || el.ownerDocument.documentElement;
  }
  function jumpTo(a) {
    var id = decodeURIComponent((a.getAttribute('href') || '').slice(1));
    var target = id && (document.getElementById(id) || document.getElementsByName(id)[0]);
    if (!target) return false;
    var inner = document.scrollingElement || document.documentElement;
    if (window.parent === window || inner.scrollHeight > inner.clientHeight + 2) return false; // 自分でスクロールできるなら既定の動きに任せる
    var top = target.getBoundingClientRect().top;
    var frame = null;
    try { frame = window.frameElement; } catch (e) { frame = null; }
    if (frame) {
      var sc = scrollParentOf(frame);
      var isRoot = sc === frame.ownerDocument.scrollingElement || sc === frame.ownerDocument.documentElement;
      var base = isRoot ? 0 : sc.getBoundingClientRect().top;
      var y = sc.scrollTop + frame.getBoundingClientRect().top - base + top - 16;
      if (sc.scrollTo) sc.scrollTo({ top: Math.max(0, y), behavior: 'smooth' }); else sc.scrollTop = y;
    } else {
      window.parent.postMessage({ type: 'wc-lesson:scroll', top: Math.max(0, top + (window.pageYOffset || 0) - 16) }, '*');
    }
    return true;
  }

  // 8. 開閉（.toggle > .open-btn + .toggle-content。理解度チェックの Q&A・補足など 95 ページ）
  //    元の Clipkit の JS が消えて開かなかった（2026-10-14 教材不具合リスト）。見た目は lms-skin.css 12節
  function toggleTarget(btn) {
    var box = btn.parentNode;
    return box && box.classList && box.classList.contains('toggle') ? box.querySelector('.toggle-content') : null;
  }
  function setToggle(btn, open) {
    var body = toggleTarget(btn);
    if (!body) return;
    btn.classList.toggle('active', open);
    btn.parentNode.classList.toggle('wc-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    body.style.display = open ? 'block' : 'none';
  }
  function initToggles() {
    $all('.toggle > .open-btn').forEach(function (btn) {
      if (btn.hasAttribute('onclick') || !toggleTarget(btn)) return;
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-expanded', 'false');
      // 右上の「回答を見る」（質問のとき）／「詳しく見る」
      var text = (btn.textContent || '').replace(/\s+/g, '');
      btn.setAttribute('data-wc-hint', /^Q|[？?]$/.test(text) ? '回答を見る' : '詳しく見る');
      btn.parentNode.classList.add('wc-toggle');
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var btn = closest(e.target, '.wc-toggle > .open-btn');
    if (!btn) return;
    e.preventDefault();
    setToggle(btn, !btn.classList.contains('active'));
  });

  // 9. 旧サイトの「前の章に戻る」「次の章に進む」「前のレッスンに戻る」「次のレッスンに進む」ボタン（本文に直書き 800 か所超）
  //    LMS の「前のレッスンへ」「次のレッスンへ」と重複し、行き先も合わないので隠す。ボタンだけが入った枠も隠す
  var OLD_NAV = /^(前|次)の(章|レッスン)に(戻る|進む)$/;
  function squash(s) { return String(s || '').replace(/\s+/g, ''); }
  function hideOldNav() {
    $all('a, button').forEach(function (a) {
      if (!OLD_NAV.test(squash(a.textContent))) return;
      a.style.display = 'none';
      var p = a.parentElement;
      if (p && p !== document.body && !squash(p.textContent).replace(/(前|次)の(章|レッスン)に(戻る|進む)/g, '')) p.style.display = 'none';
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var el;
    if ((el = closest(t, 'a[href^="#"]')) && el.getAttribute('href').length > 1) {
      if (!e.defaultPrevented && e.button === 0 && jumpTo(el)) e.preventDefault();
      return;
    }
    if ((el = closest(t, '.wc-toggle > .open-btn'))) { setToggle(el, !el.classList.contains('active')); return; }
    if ((el = closest(t, '.tt[data-tip]'))) { toggleTip(el); return; }
    if (openTip) { openTip.classList.remove('open'); resetPop(openTip); openTip = null; }
    if ((el = closest(t, '.quiz-opt'))) {
      var iq = closest(el, '.inline-quiz');
      if (el.hasAttribute('data-q')) quizOpt(el);
      else if (iq) inlineQuiz(iq, el);
      return;
    }
    if ((el = closest(t, '.quiz-btn[data-correct]')) && !el.hasAttribute('onclick')) {
      var block = closest(el, '.quiz-block');
      if (block) quizBlockBtn(block, el);
      return;
    }
    if ((el = closest(t, '.case-opt[data-case]'))) { caseOpt(el); return; }
    if ((el = closest(t, '.prompt-copy-btn[data-target]'))) { copyText(el, document.getElementById(el.getAttribute('data-target'))); return; }
    if ((el = closest(t, '[data-copy-target]'))) { copyText(el, document.getElementById(el.getAttribute('data-copy-target'))); return; }
  });

  // ---- onclick="..." から呼ばれる関数（元の各ページにあったもの） ----

  // answer(btn, 'q1', true)（生成AI 約30ページ）と answer('q1', btn, true)（1ページ）の両方
  define('answer', function (a, b, correct) {
    var btn = typeof a === 'string' ? b : a;
    var qid = typeof a === 'string' ? a : b;
    var ok = !!correct;
    var block = document.getElementById(qid) || closest(btn, '.quiz-block');
    var btns = block ? $all('.quiz-btn', block) : [btn];
    if (btns.some(function (x) { return x.disabled; })) return;
    btns.forEach(function (x) { x.disabled = true; });
    btn.classList.add(ok ? 'correct' : 'wrong');
    show((block && block.querySelector(ok ? '.correct-fb' : '.wrong-fb')) || document.getElementById(qid + '-' + (ok ? 'ok' : 'ng')));
  });

  // handleQuiz(this)（Web広告 13ページ）：.correct-ans / .wrong-ans
  define('handleQuiz', function (btn) {
    var block = closest(btn, '.quiz-block') || btn.parentNode.parentNode;
    var btns = $all('.quiz-btn', block);
    if (btns.some(function (x) { return x.disabled; })) return;
    var ok = isTrue(btn);
    btns.forEach(function (x) { x.disabled = true; if (x !== btn && isTrue(x)) x.classList.add('correct-ans'); });
    btn.classList.add(ok ? 'correct-ans' : 'wrong-ans');
    show(block.querySelector(ok ? '.correct-fb' : '.wrong-fb'));
  });

  // answerQuiz(this)（生成AI 2ページ）
  define('answerQuiz', function (btn) {
    var opts = closest(btn, '.quiz-options');
    var qs = closest(btn, '.quiz-section');
    if (!opts || btn.classList.contains('answered')) return;
    var ok = isTrue(btn);
    $all('.quiz-btn', opts).forEach(function (b) {
      b.classList.add('answered');
      b.classList.add(b === btn ? (ok ? 'correct' : 'wrong') : 'faded');
    });
    var fb = qs && qs.querySelector(ok ? '#quiz-feedback-correct' : '#quiz-feedback-wrong');
    if (fb) fb.classList.add('show');
  });

  // 模擬試験（生成AI 3ページ・60問）：selectOp / toggleAns / showScore
  define('selectOp', function (el) {
    var list = closest(el, '.options-list');
    if (list) $all('li', list).forEach(function (li) { li.classList.remove('selected'); });
    el.classList.add('selected');
  });
  define('toggleAns', function (id) {
    var t = document.getElementById(id);
    if (t) t.style.display = t.style.display === 'block' ? 'none' : 'block';
  });
  function choiceNumber(text) {
    var m = String(text).trim().match(/^(\d+)\s*[:：]/);
    return m ? Number(m[1]) : NaN;
  }
  define('showScore', function () {
    var total = 0, correct = 0;
    for (var q = 1; q <= 500; q++) {
      var box = document.getElementById('q' + q), status = document.getElementById('status' + q);
      if (!box) break;
      if (!status) continue;
      total++;
      var sel = box.querySelector('.options-list li.selected');
      var n = sel ? choiceNumber(sel.textContent) : null;
      status.style.display = 'inline-block';
      status.classList.remove('correct', 'wrong', 'unanswered');
      if (n === null) { status.classList.add('unanswered'); status.textContent = '未回答'; }
      else if (n === Number(box.getAttribute('data-answer'))) { status.classList.add('correct'); status.textContent = '正解'; correct++; }
      else { status.classList.add('wrong'); status.textContent = '不正解'; }
    }
    show(document.getElementById('resultSummary'));
    var cc = document.getElementById('correctCount'), ac = document.getElementById('accuracy');
    if (cc) cc.textContent = correct;
    if (ac) ac.textContent = total ? ((correct / total) * 100).toFixed(1) : '0.0';
  });

  // チェックリスト（生成AI 1ページ）：全部付けたらお祝いの枠を出す
  define('toggleCheck', function (cb) {
    cb.classList.toggle('checked');
    var all = $all('.checklist__cb'), done = $all('.checklist__cb.checked');
    var banner = document.getElementById('completeBanner');
    if (!banner) return;
    if (all.length > 0 && all.length === done.length) {
      banner.style.display = 'block';
      banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else banner.style.display = 'none';
  });

  // タブ切り替え（生成AI 各1ページ）
  define('switchKpi', function (tab, panelId) {
    $all('.kpi-tab').forEach(function (t) { t.classList.remove('active'); });
    $all('.kpi-panel').forEach(function (p) { p.classList.remove('active'); });
    tab.classList.add('active');
    var p = document.getElementById('kpi-' + panelId);
    if (p) p.classList.add('active');
  });
  define('switchEval', function (tab, panelId) {
    var box = tab.parentNode && tab.parentNode.parentNode ? tab.parentNode.parentNode : document;
    $all('.eval-tab', box).forEach(function (t) { t.classList.remove('active'); });
    $all('.eval-panel', box).forEach(function (p) { p.classList.remove('active'); });
    tab.classList.add('active');
    var p = document.getElementById(panelId);
    if (p) p.classList.add('active');
  });

  // ---- ワークシートの記入欄（プロジェクト 約60ページ）：書いた内容をこのブラウザに残す ----
  function sheetKey(el) { return 'wc-sheet:' + location.pathname + ':' + el.getAttribute('data-sheet-key'); }
  function initSheets() {
    $all('.sheet-input[data-sheet-key]').forEach(function (el) {
      try { var v = localStorage.getItem(sheetKey(el)); if (v !== null && !el.value) el.value = v; } catch (e) { /* 保存できない環境 */ }
    });
  }
  document.addEventListener('input', function (e) {
    var el = closest(e.target, '.sheet-input[data-sheet-key]');
    if (!el) return;
    try { localStorage.setItem(sheetKey(el), el.value); } catch (x) { /* 保存できない環境 */ }
  });
  function init() { initSheets(); initToggles(); hideOldNav(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

