import { bffClient } from '../../services/bffClient';
import { useAsyncData } from '../../hooks/useAsyncData';
import { color, font, radius } from '../../theme/webcoachTheme';

export interface StudyCourseChoice {
  id: number;
  title: string;
}

/**
 * 学習時間の記録を始める前に「どの教材の学習か」を選ぶセレクト。
 * ============================================================
 * 🔴 教材は開始時にしか選べない。区間ごとの start/end が courseid 付きで
 *    Moodle ログに積まれる（useStudySession）ので、終了カードで後から
 *    差し替えても、すでに積んだ区間の教材は変わらない。
 * 🔴 選択肢は受講中のコース（GET /api/moodle/courses/{userid}）。
 *    学習記録ページの courseOptions（集計済み byCourse 由来）を使うと、
 *    まだ一度も記録していない教材が選べないため使わない。
 * 🔴 既定は「教材を指定しない」。アプリの外での学習も記録の対象なので必須にしない。
 *    教材ページから始めた場合は StudySessionHost が教材を自動で入れるので、これは出ない。
 * ============================================================
 */
interface StudyCourseSelectProps {
  userId: number | undefined;
  value: StudyCourseChoice | null;
  onChange: (value: StudyCourseChoice | null) => void;
}

export function StudyCourseSelect({ userId, value, onChange }: StudyCourseSelectProps) {
  const { data, loading, error } = useAsyncData<StudyCourseChoice[]>(
    () =>
      userId
        ? bffClient.getUserCourses(userId).then((rows) =>
            rows
              .filter((c) => typeof c?.id === 'number')
              .map((c) => ({ id: c.id as number, title: String(c.displayname || c.fullname || `コース${c.id}`) }))
          )
        : Promise.resolve([]),
    [userId]
  );
  const options = data ?? [];

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
      <span style={{ ...font.caption, color: color.textMuted, fontWeight: 700 }}>学習する教材（任意）</span>
      <select
        value={value?.id ?? ''}
        disabled={loading}
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
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title}
          </option>
        ))}
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
