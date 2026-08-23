import { color, font } from '../../theme/webcoachTheme';

/**
 * ページ見出し（小見出し＋タイトル＋右端の操作＋下罫）。
 *
 * もとは `studyRoom/StudyRoomHeader` で、集中ブース・学習記録・ノートの3面を
 * タブで束ねる「自習室」の共通ヘッダだった。
 *
 * 🔴 自習室という括りは廃止した。マイノートはメインナビの1本柱になり、
 *    学習記録はトップの下層、集中ブースは学習するの下層と、3面の帰属先が
 *    別々になったため。タブで結んだままだと、隣のタブへ移動した瞬間に
 *    サイドバーの点灯箇所が変わって現在地を見失う。
 *    タブだけを外し、見出しの体裁（サイズ・右スロット・下罫）は引き継いでいる。
 *
 * right には各ページ固有の操作（環境設定・期間切替など）を渡す。
 */

interface PageTitleBarProps {
  title: string;
  /** タイトルの上に出す小さな行（集中ブースの日付など） */
  eyebrow?: React.ReactNode;
  /** タイトル行の右端に出すページ固有の操作 */
  right?: React.ReactNode;
}

function PageTitleBar({ title, eyebrow, right }: PageTitleBarProps) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          paddingBottom: 14,
          borderBottom: `1px solid ${color.border}`,
        }}
      >
        <div>
          {eyebrow && (
            <div style={{ fontSize: 13, fontWeight: 500, color: color.textSubtle, letterSpacing: '.2px' }}>
              {eyebrow}
            </div>
          )}
          <h1 style={{ ...font.pageTitle, color: color.text, margin: 0, marginTop: eyebrow ? 10 : 0 }}>
            {title}
          </h1>
        </div>
        {right && <div style={{ paddingBottom: 2 }}>{right}</div>}
      </div>
    </div>
  );
}

export default PageTitleBar;
