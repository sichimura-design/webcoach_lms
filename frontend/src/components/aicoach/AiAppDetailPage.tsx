/**
 * AIアプリの詳しい解説（/ai-coach/apps/:appId）。
 *
 * 一覧カード（AiCoachHome）に載せられるのは「何ができるか」の1〜2文まで。
 * 概要・主な機能・操作手順（対話例つき）・トラブルシューティングは
 * カードにも会話画面にも収まらないので、アプリごとのこのページが受け持つ。
 *
 * 🔴 本文は TS に埋めず public/content/ai-apps/<appId>.md から取る。
 *    数千字の手順書をコンポーネントに書くとレビューできなくなるのと、
 *    原稿の追加を「.md を1枚置くだけ」で済ませたいため。
 *    原稿が無いアプリは「準備中」に倒す（404でページを壊さない）。
 * 🔴 fetch のパスには必ず process.env.PUBLIC_URL を前置する。
 *    dev プレビューは /branches/<slug>/ のサブパス配信。
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { AppFooter, AppHeader } from '../shared';
import { useAuth } from '../../contexts/AuthContext';
import { useAiCoachStore } from '../../store/aiCoachStore';
import { AI_SKILL_META, type ConcreteAiSkillId } from '../../types/aiSkill';
import MarkdownRenderer from '../MarkdownRenderer';
import { AI_SKILL_ICON } from './aiSkillIcons';

type DocState = { kind: 'loading' } | { kind: 'ready'; body: string } | { kind: 'missing' };

export function AiAppDetailPage() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const createSkillSession = useAiCoachStore((s) => s.createSkillSession);

  const [doc, setDoc] = useState<DocState>({ kind: 'loading' });

  /*
   * URLの文字列はまだ何のIDでもないので、AI_SKILL_META に実在するかで判定する。
   * 🔴 isConcreteSkill は 'auto' を弾くだけ（型の絞り込み用）で、知らない文字列も
   *    通してしまう。それで判定すると AI_SKILL_META[id] が undefined になり、
   *    アイコンを引いた時点で ErrorBoundary に落ちる。
   */
  const valid = !!appId && Object.prototype.hasOwnProperty.call(AI_SKILL_META, appId);

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    setDoc({ kind: 'loading' });
    fetch(`${process.env.PUBLIC_URL}/content/ai-apps/${appId}.md`)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
      .then((body) => {
        if (!alive) return;
        // 静的配信は 404 でも index.html を返すことがある。HTML が来たら原稿無しとみなす
        if (body.trimStart().startsWith('<')) setDoc({ kind: 'missing' });
        else setDoc({ kind: 'ready', body });
      })
      .catch(() => { if (alive) setDoc({ kind: 'missing' }); });
    return () => { alive = false; };
  }, [appId, valid]);

  // 知らないIDで来たら一覧へ戻す（リンクの打ち間違い・古いブックマーク）
  useEffect(() => {
    if (!valid) navigate('/ai-coach', { replace: true });
  }, [valid, navigate]);

  if (!valid || !appId) return null;

  const id = appId as ConcreteAiSkillId;
  const meta = AI_SKILL_META[id];
  const Icon = AI_SKILL_ICON[meta.icon];

  /** ここから使い始める。実行はユーザーの操作を待つ（AiCoachPage の挙動に合わせる） */
  const startApp = () => {
    const sessionId = createSkillSession({ skillId: id });
    navigate(`/ai-coach?session=${sessionId}`);
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--dc-surface)',
    border: '1px solid var(--dc-border)',
    borderRadius: 'var(--dc-radius-lg)',
    boxShadow: 'var(--dc-shadow-card)',
    padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
  };

  return (
    <div className="wc-warm min-h-screen flex flex-col" style={{ background: 'var(--dc-bg)' }}>
      <AppHeader userName={user?.username || 'User'} />

      <main
        className="wc-page flex flex-col"
        style={{ '--wc-page-max': '860px', flex: 1, gap: 20, color: 'var(--dc-text)' } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => navigate('/ai-coach')}
          style={{
            alignSelf: 'flex-start',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            padding: 0,
            fontFamily: 'inherit',
            fontSize: 13,
            color: 'var(--dc-text-muted)',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={14} />
          AIアプリ一覧に戻る
        </button>

        {/* ヘッダー: サムネ ＋ 名前 ＋ 何ができるか ＋ 使い始めるCTA */}
        <section style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              className="ai-home-app-thumb"
              style={{ width: 208, flex: 'none', borderRadius: 'var(--dc-radius-md)' }}
            >
              {meta.thumbnail ? (
                <img src={`${process.env.PUBLIC_URL}/${meta.thumbnail}`} alt="" />
              ) : (
                <span
                  aria-hidden
                  className="grid place-items-center"
                  style={{ width: '100%', height: '100%', color: 'var(--dc-primary)' }}
                >
                  <Icon size={36} strokeWidth={1.5} />
                </span>
              )}
            </span>

            <div style={{ flex: 1, minWidth: 220 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                {meta.label}
              </h1>
              <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.8, color: 'var(--dc-text-body)' }}>
                {meta.description}
              </p>
            </div>
          </div>

          <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {([
              ['入力するもの', meta.inputHint],
              ['こんなときに', meta.useCase],
            ] as const).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: 10, fontSize: 12.5, lineHeight: 1.8 }}>
                <dt style={{ flex: 'none', width: 92, color: 'var(--dc-primary)', fontWeight: 700 }}>{label}</dt>
                <dd style={{ margin: 0, minWidth: 0, color: 'var(--dc-text-muted)' }}>{value}</dd>
              </div>
            ))}
          </dl>

          <button
            type="button"
            onClick={startApp}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              alignSelf: 'flex-start',
              border: 0,
              borderRadius: 'var(--dc-radius-md)',
              background: 'var(--dc-primary)',
              color: '#fff',
              padding: '12px 24px',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {meta.cta}
          </button>
        </section>

        {/* 詳しい解説（原稿） */}
        <section style={cardStyle}>
          {doc.kind === 'loading' ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--dc-text-muted)' }}>読み込み中…</p>
          ) : doc.kind === 'missing' ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--dc-text-muted)', lineHeight: 1.9 }}>
              このアプリの詳しい解説は準備中です。上の「{meta.cta}」からそのまま使い始められます。
            </p>
          ) : (
            <MarkdownRenderer content={doc.body} />
          )}
        </section>

        <AppFooter />
      </main>
    </div>
  );
}

export default AiAppDetailPage;
