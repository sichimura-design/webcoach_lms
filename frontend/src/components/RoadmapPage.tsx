import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle, Circle, Flag } from 'lucide-react';
import { AppHeader } from './shared';
import { useAuth } from '../contexts/AuthContext';
import bffClient from '../services/bffClient';
import { RoadmapSkill, UserRoadmap } from '../types/api';
import { color, font, shadow, t } from '../theme/webcoachTheme';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '未設定';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function RoadmapPage() {
  const { user } = useAuth();
  const [roadmap, setRoadmap] = useState<UserRoadmap | null>(null);
  const [skills, setSkills] = useState<RoadmapSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    bffClient.getUserRoadmap(user.userid)
      .then(data => { if (!cancelled) setRoadmap(data); })
      .catch((err: any) => {
        if (cancelled) return;
        if (err?.response?.status === 404) {
          setRoadmap(null);
        } else {
          setError('ロードマップの取得に失敗しました');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user || roadmap || loading) return;
    bffClient.getRoadmapSkills()
      .then(setSkills)
      .catch(() => setError('スキル一覧の取得に失敗しました'));
  }, [user, roadmap, loading]);

  const handleStart = async (skillId: number) => {
    if (!user) return;
    setStarting(true);
    setError(null);
    try {
      const started = await bffClient.startUserRoadmap(user.userid, skillId);
      setRoadmap(started);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'ロードマップの開始に失敗しました');
    } finally {
      setStarting(false);
    }
  };

  const phases = roadmap?.phases ?? [];
  const currentIndex = phases.findIndex(p => p.status === 'in_progress');
  const currentPhase = currentIndex >= 0 ? phases[currentIndex] : undefined;
  const nextPhase = currentIndex >= 0 && currentIndex + 1 < phases.length ? phases[currentIndex + 1] : undefined;

  return (
    <div style={{ minHeight: '100vh', background: color.pageBg, display: 'flex', flexDirection: 'column' }}>
      <AppHeader userName={user?.username} />

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 860,
          margin: '0 auto',
          padding: '32px 20px 80px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          fontFamily: font.family,
        }}
      >
        <h1 style={{ ...font.pageTitle, color: color.text, margin: 0 }}>キャリアロードマップ</h1>

        {error && (
          <div style={{ ...t.chip, background: '#FDEAE6', color: color.primary, padding: '10px 14px', borderRadius: 12 }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ ...font.meta, color: color.textMuted, textAlign: 'center', padding: '48px 0' }}>読み込み中…</p>
        ) : roadmap ? (
          <>
            {/* 最終ゴール・目標期限 */}
            <div style={{ ...t.card, padding: '22px 24px' }}>
              <div style={{ ...font.label, color: color.textSubtle, marginBottom: 6 }}>
                {roadmap.skill.name}
              </div>
              <div style={{ ...font.sectionTitle, color: color.text, marginBottom: 12 }}>
                {roadmap.skill.goal_label || `${roadmap.skill.name}として活躍する`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...font.meta, color: color.textMuted }}>
                <Calendar className="w-3.5 h-3.5" style={{ width: 14, height: 14 }} />
                目標期限：{formatDate(roadmap.target_date)}
              </div>
            </div>

            {/* フェーズ進捗バー */}
            <div style={{ ...t.card, padding: '24px 24px 18px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  overflowX: 'auto',
                }}
              >
                {phases.map((p, i) => {
                  const isCurrent = i === currentIndex;
                  const isDone = p.status === 'completed';
                  return (
                    <div
                      key={p.id}
                      style={{
                        flex: '1 1 0',
                        minWidth: 96,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        position: 'relative',
                      }}
                    >
                      {i > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 13,
                            right: '50%',
                            width: '100%',
                            height: 3,
                            background: isDone || isCurrent ? color.primary : color.trackBg,
                            zIndex: 0,
                          }}
                        />
                      )}
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isDone ? color.primary : isCurrent ? color.surface : color.surface,
                          border: `2px solid ${isDone || isCurrent ? color.primary : color.borderNeutral}`,
                          boxShadow: isCurrent ? shadow.currentStep : undefined,
                          zIndex: 1,
                        }}
                      >
                        {isDone ? (
                          <CheckCircle style={{ width: 16, height: 16, color: color.textOnPrimary }} />
                        ) : isCurrent ? (
                          <Flag style={{ width: 14, height: 14, color: color.primary }} />
                        ) : (
                          <Circle style={{ width: 10, height: 10, color: color.borderNeutral }} />
                        )}
                      </div>
                      <div
                        style={{
                          ...font.caption,
                          marginTop: 8,
                          textAlign: 'center',
                          color: isCurrent ? color.primary : isDone ? color.textBody : color.textFaint,
                          fontWeight: isCurrent ? 700 : 500,
                        }}
                      >
                        {p.phase.name}
                      </div>
                      {isCurrent && (
                        <div style={{ ...t.chip, marginTop: 4 }}>いまここ</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 現在フェーズの目的・タスク */}
            {currentPhase && (
              <div style={{ ...t.card, padding: '22px 24px' }}>
                <div style={{ ...font.cardTitle, color: color.text, marginBottom: 4 }}>
                  現在のフェーズ：{currentPhase.phase.name}
                </div>
                {currentPhase.end && (
                  <div style={{ ...font.caption, color: color.textSubtle, marginBottom: 14 }}>
                    期日：{formatDate(currentPhase.end)}
                  </div>
                )}
                <div style={{ marginBottom: 14 }}>
                  <p style={{ ...font.label, color: color.textSubtle, margin: '0 0 4px' }}>目的</p>
                  <p style={{ ...font.meta, color: color.textBody, margin: 0, lineHeight: 1.8 }}>
                    {currentPhase.phase.goal}
                  </p>
                </div>
                {currentPhase.phase.todos.length > 0 && (
                  <div>
                    <p style={{ ...font.label, color: color.textSubtle, margin: '0 0 8px' }}>やること</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {currentPhase.phase.todos
                        .slice()
                        .sort((a, b) => a.todo_no - b.todo_no)
                        .map(todo => (
                          <div key={todo.todo_no} style={{ ...t.listRow }}>
                            <Circle style={{ width: 8, height: 8, color: color.primaryDashed, flexShrink: 0 }} />
                            <span style={{ ...font.listItem, color: color.textBody }}>{todo.description}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 次フェーズプレビュー */}
            {nextPhase && (
              <div
                style={{
                  ...t.card,
                  padding: '18px 24px',
                  background: color.hoverBgTint,
                  borderStyle: 'dashed',
                }}
              >
                <div style={{ ...font.label, color: color.textSubtle, marginBottom: 4 }}>次のフェーズ</div>
                <div style={{ ...font.rowTitle, color: color.textBody, marginBottom: 4 }}>
                  {nextPhase.phase.name}
                </div>
                <p style={{ ...font.meta, color: color.textMuted, margin: 0, lineHeight: 1.7 }}>
                  {nextPhase.phase.goal}
                </p>
              </div>
            )}

            {!currentPhase && roadmap.is_completed && (
              <div style={{ ...t.card, padding: '22px 24px', textAlign: 'center' }}>
                <CheckCircle style={{ width: 28, height: 28, color: color.primary, margin: '0 auto 8px' }} />
                <p style={{ ...font.rowTitle, color: color.text, margin: 0 }}>
                  すべてのフェーズが完了しました！
                </p>
              </div>
            )}
          </>
        ) : (
          <div style={{ ...t.card, padding: '28px 24px' }}>
            <p style={{ ...font.cardTitle, color: color.text, marginBottom: 6 }}>
              まだロードマップが開始されていません
            </p>
            <p style={{ ...font.meta, color: color.textMuted, marginBottom: 20 }}>
              目指すスキルを選んでロードマップを開始しましょう。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {skills
                .slice()
                .sort((a, b) => a.display_order - b.display_order)
                .map(skill => (
                  <button
                    key={skill.id}
                    type="button"
                    disabled={starting}
                    onClick={() => handleStart(skill.id)}
                    style={{
                      ...t.ghostButton,
                      justifyContent: 'flex-start',
                      opacity: starting ? 0.6 : 1,
                      cursor: starting ? 'default' : 'pointer',
                    }}
                  >
                    {skill.name}
                  </button>
                ))}
              {skills.length === 0 && (
                <p style={{ ...font.meta, color: color.textFaint }}>選択できるスキルがありません。</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default RoadmapPage;
