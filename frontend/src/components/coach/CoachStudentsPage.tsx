/**
 * コーチ向け 受講生一覧（/coach/students）。
 *
 * 色・角丸・影・文字は index.css の --dc-*（.wc-warm スコープ）を使う。
 * かつてこの画面はサーモン #E86D78 → アンバー #FA9262 のグラデーションを直書きしていて、
 * サイドバー（ブランド赤 #D60934・暖色クリーム地）と中身で別ブランドに見えていた。
 * 🔴 ルート要素の className に wc-warm が必要。--dc-* の色トークンは :root ではなく
 *    .mypage-3d, .wc-warm スコープの opt-in なので、外すと全部空振りする。
 *    （タイポグラフィ --dc-fs-* / --dc-lh-* だけは :root にあるのでどこでも効く）
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserRound, CalendarDays, AlertTriangle } from 'lucide-react';
import { AppHeader } from '../shared/AppHeader';
import { AppFooter } from '../shared/AppFooter';
import { useAuth } from '../../contexts/AuthContext';
import bffClient from '../../services/bffClient';

interface Student {
  id: number;
  username: string;
  fullname: string;
  lastaccess: number;
  lastaccess_formatted: string;
  inactive_over_month: boolean;
  new_user: boolean;
  suspended: boolean;
}

type FilterType = 'all' | 'alert' | 'new';

function isAlert(s: Student): boolean {
  return s.inactive_over_month || s.lastaccess === 0;
}

/* 列幅・縦積みへの落ち方は index.css の .coach-row / .coach-col-* が持つ。
   狭い幅で1行から2段に落とすので、幅をインラインで書くとメディアクエリで戻せない。 */

const cardStyle: React.CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
};

const columnLabelStyle: React.CSSProperties = {
  fontSize: 'var(--dc-fs-caption)',
  fontWeight: 500,
  color: 'var(--dc-text-muted)',
};

/** 読み込み中・エラー・0件の1行表示 */
function StateRow({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'error' }) {
  return (
    <div
      style={{
        padding: '56px 24px',
        textAlign: 'center',
        fontSize: 'var(--dc-fs-body)',
        lineHeight: 'var(--dc-lh-prose)',
        color: tone === 'error' ? 'var(--dc-primary)' : 'var(--dc-text-body)',
      }}
    >
      {children}
    </div>
  );
}

export function CoachStudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    bffClient.getStudents()
      .then(data => setStudents(data.students))
      .catch(() => setError('受講生情報の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = students;

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(s =>
        s.username.toLowerCase().includes(q) || s.fullname.includes(q)
      );
    }

    if (filter === 'alert') list = list.filter(isAlert);
    if (filter === 'new')   list = list.filter(s => s.new_user);

    return list;
  }, [students, query, filter]);

  const alertCount = useMemo(() => students.filter(isAlert).length, [students]);

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: 'all',   label: 'すべて' },
    { key: 'alert', label: `アラート${alertCount ? ` ${alertCount}` : ''}` },
    { key: 'new',   label: '受講開始 1ヶ月以内' },
  ];

  return (
    <div className="wc-warm min-h-screen flex flex-col" style={{ background: 'var(--dc-bg)' }}>
      <AppHeader userName={user?.username} />

      <div
        className="wc-page flex-1"
        style={{ '--wc-page-max': '1080px' } as React.CSSProperties}
      >
        <h1
          style={{
            margin: '0 0 20px',
            fontSize: 'var(--dc-fs-display)',
            fontWeight: 700,
            letterSpacing: '-.01em',
            lineHeight: 'var(--dc-lh-heading)',
            color: 'var(--dc-text)',
          }}
        >
          受講生一覧
        </h1>

        {/* 検索とフィルタ */}
        <div style={{ ...cardStyle, padding: 18, marginBottom: 14 }}>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search
              size={16}
              strokeWidth={2}
              style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--dc-text-subtle)', pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="受講IDまたは氏名で検索"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 14px 10px 36px',
                background: 'var(--dc-sunken)',
                border: '1px solid var(--dc-border)',
                borderRadius: 'var(--dc-radius-md)',
                fontFamily: 'inherit',
                fontSize: 'var(--dc-fs-body)',
                color: 'var(--dc-text-body)',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {filterButtons.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`coach-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]${filter === key ? ' is-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 一覧 */}
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          {/* 🔴 display はインラインで持たない。インライン style は
              .coach-table-head の display:none（狭い幅で畳む）に勝ってしまう。 */}
          <div
            className="coach-table-head"
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--dc-border)',
            }}
          >
            <span style={{ ...columnLabelStyle, flex: 1 }}>受講生</span>
            <span className="coach-col-access" style={{ ...columnLabelStyle, textAlign: 'center' }}>最終ログイン</span>
            <span className="coach-col-action" style={columnLabelStyle} />
          </div>

          {loading ? (
            <StateRow>読み込み中…</StateRow>
          ) : error ? (
            <StateRow tone="error">{error}</StateRow>
          ) : filtered.length === 0 ? (
            <StateRow>
              {query.trim() || filter !== 'all'
                ? '条件に合う受講生がいません。検索語や絞り込みを変えてみてください。'
                : 'まだ担当の受講生がいません。運営から割り当てられるとここに並びます。'}
            </StateRow>
          ) : (
            filtered.map((student, i) => (
              <div
                key={student.id}
                className="coach-row"
                style={{
                  padding: '14px 20px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--dc-rule)',
                }}
              >
                <span className="coach-row-main">
                  <span
                    style={{
                      width: 40, height: 40, flex: 'none',
                      borderRadius: '50%',
                      background: 'var(--dc-badge-pink)',
                      color: 'var(--dc-primary)',
                      display: 'grid', placeItems: 'center',
                    }}
                  >
                    <UserRound size={19} strokeWidth={2} />
                  </span>

                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--dc-fs-caption)',
                        color: 'var(--dc-text-muted)',
                        lineHeight: 'var(--dc-lh-ui)',
                      }}
                    >
                      {student.username}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--dc-fs-body)',
                        fontWeight: 600,
                        color: 'var(--dc-text)',
                        lineHeight: 'var(--dc-lh-ui)',
                      }}
                    >
                      {student.fullname}
                    </span>
                  </span>
                </span>

                <span className="coach-row-meta">
                  {/* 最終ログイン。ブランド赤は CTA・リンク・現在地に取っておくので、
                      要フォローの強調は琥珀（--dc-gold-text）＋アイコンで出す。 */}
                  <span
                    className="coach-col-access"
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      fontSize: 'var(--dc-fs-body)',
                      fontWeight: isAlert(student) ? 600 : 400,
                      color: isAlert(student) ? 'var(--dc-gold-text)' : 'var(--dc-text-body)',
                    }}
                  >
                    {isAlert(student) && <AlertTriangle size={14} strokeWidth={2.25} />}
                    {student.lastaccess === 0 ? '未ログイン' : student.lastaccess_formatted}
                  </span>

                  <span className="coach-col-action">
                    <Link
                      to={`/coach/schedule/${student.id}`}
                      className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '7px 14px',
                        background: 'var(--dc-surface)',
                        border: '1px solid var(--dc-border-strong)',
                        borderRadius: 999,
                        fontSize: 'var(--dc-fs-caption)',
                        fontWeight: 600,
                        color: 'var(--dc-text-body)',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <CalendarDays size={13} strokeWidth={2} />
                      コーチング記録
                    </Link>
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
