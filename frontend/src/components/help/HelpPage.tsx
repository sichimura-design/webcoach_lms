/**
 * frontend/src/components/help/HelpPage.tsx
 * 利用マニュアル / よくある質問を LMS 内で読むページ。
 *
 * 【なぜ作ったか】
 * これまでサイドバー下部の「利用マニュアル」「よくある質問」は外部の Notion を
 * 別タブで開いていた。学習中に別サービスへ飛ばされるとLMSに戻ってこられない、
 * というレビュー指摘があり、同じ内容をLMS内で読めるようにした。
 *
 * 🔴 本文は下の MANUAL_SECTIONS / FAQ_ITEMS が唯一の情報源。
 *    Notion 側を更新したらここも更新すること（現状は手動同期）。
 */
import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, HelpCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AppHeader } from '../shared';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';

/** Notion 版の原本。移行が終わるまでは参照先として残す。 */
const NOTION_MANUAL_URL =
  'https://slime-gruyere-92d.notion.site/WEBCOACH-6-0-7a07e36455e848c4b4d262ef3a1c1cd4';
const NOTION_FAQ_URL = 'https://slime-gruyere-92d.notion.site/1fddd266074f809e9f0cfdbdd8e60ffd';

interface Section {
  id: string;
  title: string;
  lead?: string;
  body: string[];
}

const MANUAL_SECTIONS: Section[] = [
  {
    id: 'start',
    title: '1. まずはここから',
    lead: 'ログインすると最初にマイページが開きます。今日やることはこの1画面で分かります。',
    body: [
      '画面の主役は「続きからはじめる」です。前回の続きのレッスンに、ここから1クリックで戻れます。',
      '上部の帯には、今週の学習時間・累計学習時間・修了レッスン数が出ます。「学習記録を見る」から詳しい内訳に進めます。',
      '右側には学習日数（連続で学習できている日数）と、次回コーチングの予定が並びます。',
    ],
  },
  {
    id: 'nav',
    title: '2. 画面の移動のしかた',
    lead: '左のサイドバーが全画面共通の入口です。',
    body: [
      'マイページ … 今日やることの起点。',
      '学習コンテンツ … 受講できるコースを探す。',
      '自習室 … タイマーで集中して学び、記録を残す。',
      'AIコーチ … 分からないことを相談する。',
      'コーチング … コーチとの面談の予定・記録・目標。',
      '学習ロードマップ … 目標から逆算した中長期の計画。',
      'サイドバーの左端のロゴを押すと、幅を折りたたんで本文を広くできます。',
    ],
  },
  {
    id: 'learn',
    title: '3. レッスンの進め方',
    body: [
      '「学習コンテンツ」からコースを選ぶと、コーストップ（カリキュラム）が開きます。',
      'STEPごとに単元がまとまっています。「はじめる」「続きから」「復習する」は、その単元の進み具合で自動的に切り替わります。',
      'レッスン画面は3ペイン構成です。左の目次、中央の本文、右のサポート（AI・メモ）をそれぞれ開閉できます。',
      '本文を読み終えたら完了操作をしてください。コーストップの進捗率に反映され、次のレッスンへ進めます。完了は後から取り消せます。',
    ],
  },
  {
    id: 'focus',
    title: '4. 集中して学ぶ（自習室）',
    body: [
      '「自習室」の集中ブースで、教材と今回の目標を決めてタイマーを開始します。',
      '終了すると終了カードが出ます。振り返りを記入すると学習記録に残ります。',
      '記録した時間は、学習記録・マイページの学習時間・学習日数すべてに同じ値で反映されます。',
    ],
  },
  {
    id: 'ai',
    title: '5. 分からないときは',
    body: [
      'レッスン本文をドラッグで選択すると、「解説」「AIに質問」「クリップ」が出ます。',
      '解説はその場で噛み砕いた説明を出します。AIに質問は右のパネルで会話できます。クリップは後で読み返すために本文を切り抜きます。',
      '保存した回答・メモ・クリップは「ノート」にまとまります。ノートからは元のレッスンの位置に戻れます。',
      '教材から離れて相談したいときは、サイドバーの「AIコーチ」を使ってください。',
    ],
  },
  {
    id: 'coaching',
    title: '6. コーチングを受ける',
    body: [
      '「コーチング」に次回の予定が出ます。会議リンクを登録してから参加してください。',
      '参加時に録画・文字起こしの同意を求められます。同意した場合のみ内容が記録されます。',
      '面談が終わると要約が生成されます。内容を確認して確定すると、決まった目標がマイページの「次回コーチングまでの目標」に入ります。',
      '目標の追加・修正・完了チェックもコーチングの画面で行います。',
    ],
  },
  {
    id: 'roadmap',
    title: '7. 学習ロードマップ',
    body: [
      '8つの質問に答えると、目標から逆算した中長期の計画ができます。所要は約3分です。',
      '作った計画はいつでも作り直せます。学習の実績に合わせて更新の候補が出ることもあります。',
      'ロードマップはあくまで目安です。予定どおりでなくても問題ありません。次回のコーチングでコーチと一緒に調整できます。',
    ],
  },
  {
    id: 'account',
    title: '8. アカウントの設定',
    body: [
      'サイドバー最下部の自分の名前を押すと、個人設定が開きます。',
      'メールアドレスとパスワードの変更ができます。',
      'ニックネーム・アイコン・自己紹介はプロフィールから変更します。',
    ],
  },
];

interface FaqItem {
  q: string;
  a: string[];
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'ログインできません',
    a: [
      'メールアドレスとパスワードをご確認ください。パスワードが分からない場合はログイン画面の「パスワードお忘れですか？」から再設定できます。',
      '初回ログイン時は仮パスワードの変更が必要です。仮パスワードの有効期限が切れている場合は運営にご連絡ください。',
    ],
  },
  {
    q: '前回の続きが分かりません',
    a: ['マイページの「続きからはじめる」を押してください。最後に学習していたコースの続きに戻れます。'],
  },
  {
    q: 'レッスンを完了にしたのに進捗が変わりません',
    a: [
      '進捗はコーストップ（カリキュラム）で集計されます。一度コーストップに戻ってご確認ください。',
      'それでも反映されない場合は、ページを再読み込みしてください。',
    ],
  },
  {
    q: '学習時間が記録されていません',
    a: [
      '学習時間は自習室の集中ブースでタイマーを使ったときに記録されます。教材を開いているだけでは記録されません。',
      'タイマーを終了して終了カードを保存するところまで進めてください。',
    ],
  },
  {
    q: '学習日数（連続日数）はどう数えていますか',
    a: [
      'ログインした日数ではなく、実際に学習した日数です。1日あたり一定時間以上の学習で「学習した日」になります。',
      '今日ぶんが未達成のときは、あと何分で成立するかがマイページに出ます。',
    ],
  },
  {
    q: 'AIコーチの回答は正しいですか',
    a: [
      'AIの回答は教材の内容をもとにした補助です。判断に迷う内容は、コーチングでコーチに確認してください。',
    ],
  },
  {
    q: 'コーチングの録画に同意したくありません',
    a: [
      '同意しないまま面談を受けられます。その場合は録画・文字起こし・自動要約が行われず、目標の自動取り込みも行われません。',
      '目標はコーチングの画面から手動で登録できます。',
    ],
  },
  {
    q: 'ロードマップの予定より遅れています',
    a: [
      'ロードマップは目安であって締切ではありません。遅れていても問題ありません。',
      '無理のない計画に直したいときは、ロードマップ画面から作り直すか、次回のコーチングでコーチに相談してください。',
    ],
  },
  {
    q: 'スマートフォンでも使えますか',
    a: ['使えます。画面幅に合わせてレイアウトが切り替わります。長い教材はPCのほうが読みやすい場合があります。'],
  },
  {
    q: 'ログアウトしたい',
    a: ['サイドバー最下部の自分の名前から個人設定を開いてください。'],
  },
];

const CARD: React.CSSProperties = {
  background: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: radius.card,
  boxShadow: shadow.card,
};

function TabLink({ to, active, icon: Icon, label }: { to: string; active: boolean; icon: any; label: string }) {
  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '9px 18px',
        borderRadius: radius.pill,
        textDecoration: 'none',
        fontSize: 13,
        fontWeight: 700,
        color: active ? color.textOnPrimary : color.textMuted,
        background: active ? color.primary : color.surface,
        border: `1px solid ${active ? color.primary : color.border}`,
      }}
    >
      <Icon size={14} />
      {label}
    </Link>
  );
}

function HelpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, nickName } = useAuth();

  const isFaq = location.pathname.startsWith('/help/faq');
  const sourceUrl = isFaq ? NOTION_FAQ_URL : NOTION_MANUAL_URL;

  // 目次はセクション定義から作る（本文を足したら自動で増える）
  const toc = useMemo(() => MANUAL_SECTIONS.map((s) => ({ id: s.id, title: s.title })), []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: color.pageBg }}>
      <AppHeader userName={nickName || user?.username || 'User'} />

      <main
        className="flex-1 w-full mx-auto px-4 sm:px-8 py-8"
        style={{ maxWidth: 980, fontFamily: font.family, color: color.text }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: 'none',
            background: 'transparent',
            color: color.textMuted,
            fontFamily: 'inherit',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0,
            marginBottom: 18,
          }}
        >
          <ArrowLeft size={15} />
          戻る
        </button>

        <h1 style={{ ...font.pageTitle, color: color.text, margin: 0 }}>
          {isFaq ? 'よくある質問' : '利用マニュアル'}
        </h1>
        <p style={{ fontSize: 13, color: color.textSubtle, marginTop: 8, lineHeight: 1.8 }}>
          {isFaq
            ? 'つまずきやすいところをまとめています。ここで解決しない場合はコーチにご相談ください。'
            : 'WEBCOACH 学習システムの使い方です。上から順に読めば一通り使えるようになります。'}
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <TabLink to="/help/manual" active={!isFaq} icon={FileText} label="利用マニュアル" />
          <TabLink to="/help/faq" active={isFaq} icon={HelpCircle} label="よくある質問" />
        </div>

        {isFaq ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 26 }}>
            {FAQ_ITEMS.map((item) => (
              <section key={item.q} style={{ ...CARD, padding: '20px 24px' }}>
                <h2 style={{ ...font.cardTitle, color: color.text, margin: 0 }}>{item.q}</h2>
                {item.a.map((line, i) => (
                  <p
                    key={i}
                    style={{ fontSize: 13.5, color: color.textBody, lineHeight: 1.9, margin: '10px 0 0' }}
                  >
                    {line}
                  </p>
                ))}
              </section>
            ))}
          </div>
        ) : (
          <>
            {/* 目次。長いページなので、読みたい場所へ直接飛べるようにする */}
            <nav style={{ ...CARD, padding: '18px 24px', marginTop: 26 }}>
              <div style={{ ...font.label, color: color.textSubtle, marginBottom: 12 }}>もくじ</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px' }}>
                {toc.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    style={{ fontSize: 13, fontWeight: 700, color: color.primary, textDecoration: 'none' }}
                  >
                    {s.title}
                  </a>
                ))}
              </div>
            </nav>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
              {MANUAL_SECTIONS.map((s) => (
                <section key={s.id} id={s.id} style={{ ...CARD, padding: '22px 24px', scrollMarginTop: 20 }}>
                  <h2 style={{ ...font.cardTitle, color: color.text, margin: 0 }}>{s.title}</h2>
                  {s.lead && (
                    <p style={{ fontSize: 13, color: color.textSubtle, lineHeight: 1.9, margin: '8px 0 0' }}>
                      {s.lead}
                    </p>
                  )}
                  <ul style={{ margin: '14px 0 0', paddingLeft: 20 }}>
                    {s.body.map((line, i) => (
                      <li
                        key={i}
                        style={{ fontSize: 13.5, color: color.textBody, lineHeight: 1.95, marginTop: i === 0 ? 0 : 8 }}
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}

        <p style={{ fontSize: 12, color: color.textFaint, lineHeight: 1.9, marginTop: 24 }}>
          最新版・詳細版は{' '}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: color.primary, fontWeight: 700 }}
          >
            Notion の原本
          </a>{' '}
          にもあります。内容が食い違う場合は運営にお知らせください。
        </p>
      </main>

      <footer className="h-10 flex items-center justify-center" style={{ background: '#2B2629' }}>
        <span className="text-[11.4px] font-bold text-white">2026 &copy; WEBCOACH</span>
      </footer>
    </div>
  );
}

export default HelpPage;
