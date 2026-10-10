import { bffClient } from '../../services/bffClient';
import { useAsyncData } from '../../hooks/useAsyncData';
import { color, font, radius } from '../../theme/webcoachTheme';
import { buildCatalog } from '../materials/catalogCourse';

export interface StudyCourseChoice {
  id: number;
  title: string;
}

/**
 * 学習時間の記録を始める前に「どの教材の学習か」を選ぶセレクト。
 * ============================================================
 * 🔴 開始時（マイページ）と終了カード（FinishSessionModal）の両方で使う。
 *    Moodle ログの start は書き換えられないので、終了カードで選び直した教材は
 *    補正イベントの courseid で上書きする（BFF の planCourseOverrides）。
 * 🔴 選択肢は「受講中の教材」（GET /api/moodle/courses/{userid}）を先頭に、
 *    その下に「その他の教材」（GET /api/moodle/courses の公開中コース）を並べる。
 *    受講登録は教材画面を開いたときにしか付かない（管理者・コーチは付かない）ので、
 *    受講中だけにすると本番で「HB添削しか選べない」状態になった。
 *    学習記録ページの courseOptions（集計済み byCourse 由来）を使うと、
 *    まだ一度も記録していない教材が選べないため使わない。
 * 🔴 既定は「教材を指定しない」。アプリの外での学習も記録の対象なので必須にしない。
 *    教材ページから始めた場合は StudySessionHost が教材を自動で入れるので、これは出ない。
 * ============================================================
 */
interface CourseOptions {
  enrolled: StudyCourseChoice[];
  others: StudyCourseChoice[];
}

interface StudyCourseSelectProps {
  userId: number | undefined;
  value: StudyCourseChoice | null;
  onChange: (value: StudyCourseChoice | null) => void;
  /** 見出し。null なら出さない（行ラベルが別にある終了カード用） */
  label?: string | null;
}

export function StudyCourseSelect({ userId, value, onChange, label = '学習する教材（任意）' }: StudyCourseSelectProps) {
  const { data, loading, error } = useAsyncData<CourseOptions>(
    async () => {
      if (!userId) return { enrolled: [], others: [] };
      // 片方が失敗しても、取れた方だけで選べるようにする（両方失敗したときだけエラー表示）
      const [enrolledRes, allRes] = await Promise.allSettled([
        bffClient.getUserCourses(userId),
        bffClient.getCourses(),
      ]);
      if (enrolledRes.status === 'rejected' && allRes.status === 'rejected') throw enrolledRes.reason;
      const enrolled: StudyCourseChoice[] = (enrolledRes.status === 'fulfilled' && Array.isArray(enrolledRes.value) ? enrolledRes.value : [])
        .filter((c) => typeof c?.id === 'number')
        .map((c) => ({ id: c.id as number, title: String(c.displayname || c.fullname || `コース${c.id}`) }));
      const enrolledIds = new Set(enrolled.map((c) => c.id));
      // 非公開コースの除外と並び順は教材一覧（buildCatalog）と揃える
      const others: StudyCourseChoice[] = (allRes.status === 'fulfilled' ? buildCatalog(allRes.value, [], null) : [])
        .filter((c) => !enrolledIds.has(c.id))
        .map((c) => ({ id: c.id, title: c.title || `コース${c.id}` }));
      return { enrolled, others };
    },
    [userId]
  );
  // 一覧に無い教材が既に付いていても（一覧の取得失敗・非公開化など）、選択が消えないようにする
  const enrolled = data?.enrolled ?? [];
  const others = data?.others ?? [];
  const listed = [...enrolled, ...others];
  const extra = value && !listed.some((o) => o.id === value.id) ? [value] : [];
  const options = [...extra, ...listed];

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
      {label && <span style={{ ...font.caption, color: color.textMuted, fontWeight: 700 }}>{label}</span>}
      <select
        value={value?.id ?? ''}
        disabled={loading}
        aria-label={label ?? '学習した教材'}
        onChange={(e) => {
          const id = Number(e.target.value);
          onChange(options.find((o) => o.id === id) ?? null);
        }}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          width: '100%',
          height: 40,
          padding: '0 10px',
          border: `1px solid ${color.border}`,
          borderRadius: radius.md,
          background: color.surface,
          color: color.text,
          fontFamily: 'inherit',
          fontSize: 14,
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        <option value="">{loading ? '教材を読み込み中…' : '教材を指定しない'}</option>
        {extra.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title}
          </option>
        ))}
        {enrolled.length > 0 && (
          <optgroup label="受講中の教材">
            {enrolled.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </optgroup>
        )}
        {others.length > 0 && (
          <optgroup label={enrolled.length > 0 ? 'その他の教材' : '教材'}>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {error && (
        <span style={{ ...font.caption, color: color.textSubtle }}>
          教材の一覧を取得できませんでした。教材を指定せずに記録できます。
        </span>
      )}
    </label>
  );
}

export default StudyCourseSelect;
