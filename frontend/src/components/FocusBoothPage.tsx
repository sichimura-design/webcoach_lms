import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, BookOpen, Heart, Send, Music } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AppHeader, MascotSvg } from './shared';
import { useStudySession } from '../hooks/useStudySession';
import { useFocusBoothMembers } from '../hooks/useFocusBoothMembers';
import { useFocusBoothRanking } from '../hooks/useFocusBoothRanking';
import { useAiChat } from '../hooks/useAiChat';
import MarkdownRenderer from './MarkdownRenderer';
import { fetchUserCourses } from '../services/mypageApi';
import { Course } from '../types/mypage';
import { StudySessionMode } from '../types/studyRoom';
import { RankingType } from '../types/focusBooth';

const POMODORO_PRESETS = [15, 25, 50];

const QUICK_REPLIES = ['休憩のとり方を教えて', 'モチベが下がったときは？', '次の学習ステップを相談する'];

const RANKING_TABS: { type: RankingType; label: string }[] = [
  { type: 'studyTime', label: '学習時間ランキング' },
  { type: 'cheersGiven', label: '応援したランキング' },
  { type: 'cheersReceived', label: '応援されたランキング' },
];

function formatMinutesHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
}

function formatRankingValue(type: RankingType, value: number): string {
  return type === 'studyTime' ? formatMinutesHM(value) : `${value}回`;
}

function FocusBoothPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { session, elapsedSeconds, start, stop, pauseSession, resumeSession } = useStudySession(user?.userid);
  const { members, pulse, cheer } = useFocusBoothMembers();
  const [rankingTab, setRankingTab] = useState<RankingType>('studyTime');
  const { ranking } = useFocusBoothRanking(rankingTab);
  const { messages: aiMessages, input: aiInput, setInput: setAiInput, loading: aiLoading, messagesEndRef, sendMessage } = useAiChat();

  const [courses, setCourses] = useState<Course[]>([]);
  const [mode, setMode] = useState<StudySessionMode>('pomodoro');
  const [targetMinutes, setTargetMinutes] = useState(25);
  const [courseId, setCourseId] = useState<number | ''>('');
  const [justFinished, setJustFinished] = useState(false);

  useEffect(() => {
    if (user?.userid) {
      fetchUserCourses(user.userid).then(setCourses).catch(() => setCourses([]));
    }
  }, [user?.userid]);

  const handleStart = () => {
    const course = courses.find((c) => c.id === courseId);
    start({
      mode,
      targetMinutes: mode === 'pomodoro' ? targetMinutes : undefined,
      courseId: course?.id,
      courseTitle: course?.title,
    });
  };

  const handleFinish = async () => {
    await stop();
    setJustFinished(true);
    setCourseId('');
  };

  const handleReset = () => {
    if (!session) return;
    start({
      mode: session.mode,
      targetMinutes: session.targetMinutes,
      courseId: session.courseId,
      courseTitle: session.courseTitle,
    });
  };

  const running = !!session && session.pausedAt === null;
  const totalSeconds = session?.mode === 'pomodoro' && session.targetMinutes ? session.targetMinutes * 60 : 25 * 60;
  const remainingSeconds = session ? Math.max(0, totalSeconds - elapsedSeconds) : totalSeconds;
  const timerDeg = Math.round((remainingSeconds / totalSeconds) * 360);
  const mm = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const ss = String(remainingSeconds % 60).padStart(2, '0');

  return (
    <div className="min-h-screen bg-dash-bg flex flex-col">
      <AppHeader userName={user?.username || 'User'} />

      <main className="relative mx-auto flex flex-col" style={{ maxWidth: 1440, paddingTop: 32, paddingBottom: 40, paddingLeft: 24, paddingRight: 24, gap: 20 }}>
        <button
          onClick={() => navigate('/mypage')}
          className="inline-flex items-center gap-1.5 self-start appearance-none border-0 outline-none bg-transparent"
          style={{ fontSize: 13, color: '#9A8B8D', fontWeight: 700 }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          マイページへ戻る
        </button>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1">
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>🎧 集中ブース</h1>
            <p style={{ margin: '5px 0 0', fontSize: 12, color: '#B78F98' }}>一緒にがんばる仲間がいるから、今日も前に進める。</p>
          </div>
          {pulse && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6B575E' }}>
              いま <span style={{ color: '#E0213A' }}>{pulse.concentratingCount}人</span> が集中中 🔥
              <span style={{ color: '#E0213A' }}>{pulse.cheerFeedCount}件</span> の応援が飛び交っています 💗
            </span>
          )}
          <span
            className="inline-flex items-center gap-1.5"
            style={{ background: '#fff', borderRadius: 999, padding: '9px 16px', fontSize: 12, fontWeight: 700, boxShadow: '0 6px 16px rgba(200,90,110,.1)', cursor: 'pointer' }}
          >
            <Music className="w-3.5 h-3.5" /> BGM
          </span>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1.55fr 1fr', gap: 22, alignItems: 'start' }}>
          {/* 左カラム: 集中タイマー + AIコーチ */}
          <div className="flex flex-col" style={{ gap: 20 }}>
            <div className="bg-white flex flex-col" style={{ borderRadius: 22, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: '26px 30px', gap: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 900 }}><span style={{ color: '#E0213A' }}>✦</span> 集中タイマー</div>

              {session ? (
                <>
                  <div className="grid" style={{ gridTemplateColumns: '1fr auto 1fr', gap: 20, alignItems: 'center' }}>
                    <div className="flex flex-col items-center" style={{ gap: 10 }}>
                      <MascotSvg size={76} pulse flag />
                      <div style={{ background: '#FDF0F2', borderRadius: 14, padding: '10px 14px', fontSize: 11, lineHeight: 1.7, color: '#A05A6B', textAlign: 'center' }}>
                        小さな積み重ねが<br />未来をつくるよ 🌸<br />一緒にがんばろう！
                      </div>
                    </div>

                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{ width: 230, height: 230, borderRadius: '50%', background: `conic-gradient(#E0213A 0 ${timerDeg}deg,#F5DFE1 ${timerDeg}deg 360deg)`, transition: 'background 500ms ease' }}
                    >
                      <div className="flex flex-col items-center justify-center" style={{ width: 192, height: 192, borderRadius: '50%', background: '#fff', boxShadow: 'inset 0 0 0 1px #FBEDEF' }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#E0213A' }}>{running ? '集中中！' : '一時停止中'}</div>
                        <div style={{ fontSize: 46, fontWeight: 900, letterSpacing: '.02em' }}>{mm}:{ss}</div>
                        <div style={{ fontSize: 11, color: '#B78F98' }}>セット {session.targetMinutes ?? 25}:00</div>
                      </div>
                    </div>

                    <div style={{ background: '#FBF4F5', borderRadius: 16, padding: 16 }}>
                      <div className="flex items-center justify-between" style={{ fontSize: 12, fontWeight: 900 }}>
                        <span>今日の目標</span>
                        <span style={{ background: '#fff', borderRadius: 999, padding: '3px 10px', fontSize: 10, color: '#E0213A', cursor: 'pointer' }}>編集</span>
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.7, color: '#5A4A50', marginTop: 10 }}>
                        {session.courseTitle || 'HTML/CSSの基礎を理解して、演習を完了する'}
                      </div>
                      <div style={{ height: 7, borderRadius: 999, background: '#F0DCE0', overflow: 'hidden', marginTop: 10 }}>
                        <div style={{ width: '68%', height: '100%', background: 'linear-gradient(90deg,#F0546A,#E0213A)', borderRadius: 999 }} />
                      </div>
                      <div className="flex items-center justify-between" style={{ fontSize: 10, color: '#B78F98', marginTop: 5 }}>
                        <span>目標時間 4.8時間</span>
                        <span style={{ fontWeight: 700, color: '#E0213A' }}>68%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center" style={{ gap: 8, fontSize: 11, color: '#8A767D' }}>
                    セット
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#E0213A' }} />
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#E0213A' }} />
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#E0213A' }} />
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#F0DCE0' }} /> 3/4
                  </div>

                  {session.courseTitle && (
                    <div className="self-center inline-flex items-center" style={{ gap: 9, background: '#FBF4F5', borderRadius: 999, padding: '9px 18px', fontSize: 12 }}>
                      <span className="inline-flex items-center justify-center" style={{ background: '#E0213A', color: '#fff', borderRadius: 8, width: 22, height: 22, fontSize: 12 }}>
                        <BookOpen className="w-3 h-3" />
                      </span>
                      いま取り組んでいること　<b>{session.courseTitle}</b>
                    </div>
                  )}

                  <div className="flex items-center justify-center" style={{ gap: 26 }}>
                    <div onClick={running ? pauseSession : resumeSession} className="flex flex-col items-center cursor-pointer" style={{ gap: 6 }}>
                      <span className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff', border: '1.5px solid #EEC0C4', color: '#E0213A', fontSize: 16 }}>
                        {running ? '⏸' : '▶'}
                      </span>
                      <span style={{ fontSize: 11, color: '#8A767D' }}>{running ? '一時停止' : '再開'}</span>
                    </div>
                    <button
                      onClick={handleFinish}
                      className="appearance-none border-0 outline-none text-white font-bold focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                      style={{ background: 'linear-gradient(120deg,#F0546A,#E0213A)', borderRadius: 999, padding: '15px 34px', fontSize: 15, boxShadow: '0 12px 28px rgba(224,33,58,.4)' }}
                    >
                      ✓ 集中終了
                    </button>
                    <div onClick={handleReset} className="flex flex-col items-center cursor-pointer" style={{ gap: 6 }}>
                      <span className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff', border: '1.5px solid #EEC0C4', color: '#E0213A', fontSize: 16 }}>
                        ↺
                      </span>
                      <span style={{ fontSize: 11, color: '#8A767D' }}>リセット</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid" style={{ gridTemplateColumns: '1fr auto 1fr', gap: 20, alignItems: 'center' }}>
                  <div className="flex flex-col items-center" style={{ gap: 10 }}>
                    <MascotSvg size={76} pulse flag />
                    <div style={{ background: '#FDF0F2', borderRadius: 14, padding: '10px 14px', fontSize: 11, lineHeight: 1.7, color: '#A05A6B', textAlign: 'center' }}>
                      小さな積み重ねが<br />未来をつくるよ 🌸<br />一緒にがんばろう！
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: 230, height: 230, borderRadius: '50%', background: '#F5DFE1' }}
                  >
                    <div className="flex flex-col items-center justify-center" style={{ width: 192, height: 192, borderRadius: '50%', background: '#fff', boxShadow: 'inset 0 0 0 1px #FBEDEF', gap: 6 }}>
                      <span className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(120deg,#F0546A,#E0213A)', color: '#fff', fontSize: 16 }}>
                        <Play className="w-4 h-4 fill-white" />
                      </span>
                      <div style={{ fontSize: 12, fontWeight: 900, color: '#B78F98' }}>タイマー未開始</div>
                    </div>
                  </div>

                  <div className="flex flex-col" style={{ background: '#FBF4F5', borderRadius: 16, padding: 14, gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 900 }}>タイマーの種類</div>
                    <div className="flex" style={{ gap: 6 }}>
                      {(['pomodoro', 'freeform'] as StudySessionMode[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMode(m)}
                          className="appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                          style={{
                            flex: 1, borderRadius: 999, padding: '6px 0', fontSize: 11, fontWeight: 700,
                            background: mode === m ? 'linear-gradient(120deg,#F0546A,#E0213A)' : '#fff',
                            color: mode === m ? '#fff' : '#9A8B8D',
                          }}
                        >
                          {m === 'pomodoro' ? 'ポモドーロ' : '自由入力'}
                        </button>
                      ))}
                    </div>

                    {mode === 'pomodoro' ? (
                      <div className="flex" style={{ gap: 6 }}>
                        {POMODORO_PRESETS.map((min) => (
                          <button
                            key={min}
                            onClick={() => setTargetMinutes(min)}
                            className="appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                            style={{
                              flex: 1, borderRadius: 10, padding: '6px 0', fontSize: 11, fontWeight: 700,
                              background: targetMinutes === min ? 'linear-gradient(120deg,#F0546A,#E0213A)' : '#fff',
                              color: targetMinutes === min ? '#fff' : '#9A8B8D',
                            }}
                          >
                            {min}分
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        value={targetMinutes}
                        onChange={(e) => setTargetMinutes(Number(e.target.value) || 0)}
                        className="outline-none w-full"
                        style={{ borderRadius: 10, background: '#fff', border: 'none', padding: '6px 10px', fontSize: 12 }}
                      />
                    )}

                    <select
                      value={courseId}
                      onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : '')}
                      className="outline-none w-full"
                      style={{ borderRadius: 10, background: '#fff', border: 'none', padding: '7px 10px', fontSize: 11 }}
                    >
                      <option value="">学ぶコース（任意）</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>

                    <button
                      onClick={handleStart}
                      className="inline-flex items-center justify-center gap-1.5 text-white font-bold appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                      style={{ background: 'linear-gradient(120deg,#F0546A,#E0213A)', borderRadius: 999, padding: '10px 0', fontSize: 13, boxShadow: '0 8px 20px rgba(224,33,58,.35)' }}
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      スタート
                    </button>
                  </div>
                </div>
              )}

              {justFinished && (
                <div style={{ borderRadius: 12, padding: '10px 16px', fontSize: 12, color: '#3A2F35', fontWeight: 700, background: '#FDF0F2', textAlign: 'center' }}>
                  学習お疲れ様でした！記録しました。
                </div>
              )}
            </div>

            <div className="bg-white flex flex-col" style={{ borderRadius: 22, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: '22px 26px', gap: 14 }}>
                <div className="flex items-center" style={{ gap: 11 }}>
                  <div className="flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(120deg,#F6B4BE,#EE8296)', fontSize: 18 }}>🧠</div>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 900 }}>AIコーチ <span style={{ color: '#E0213A' }}>さくらちゃん</span></span>
                    <div style={{ fontSize: 10, color: '#B78F98' }}>いつでも味方だよ！</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 160 }}>
                  {aiMessages.slice(-4).map((m) => (
                    <div
                      key={m.id}
                      style={{
                        maxWidth: '82%', borderRadius: 16, padding: '11px 14px', fontSize: 12.5, lineHeight: 1.8,
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        background: m.role === 'user' ? 'linear-gradient(120deg,#F0546A,#E0213A)' : '#FDF0F2',
                        color: m.role === 'user' ? '#fff' : '#4A3B42',
                        borderTopRightRadius: m.role === 'user' ? 4 : 16,
                        borderTopLeftRadius: m.role === 'user' ? 16 : 4,
                      }}
                    >
                      {m.role === 'assistant' ? <MarkdownRenderer content={m.content} compact /> : m.content}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="flex flex-wrap" style={{ gap: 9 }}>
                  {QUICK_REPLIES.map((q) => (
                    <span
                      key={q}
                      onClick={() => { setAiInput(q); setTimeout(sendMessage, 0); }}
                      style={{ background: '#fff', border: '1px solid #EEC0C4', color: '#C24358', borderRadius: 999, padding: '8px 15px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {q}
                    </span>
                  ))}
                </div>
                <div className="flex items-center" style={{ gap: 8, background: '#FBF2F4', borderRadius: 999, padding: '6px 6px 6px 18px' }}>
                  <input
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="何でも気軽に相談してね…"
                    className="flex-1 bg-transparent outline-none"
                    style={{ border: 'none', fontSize: 12 }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!aiInput.trim() || aiLoading}
                    className="rounded-full flex items-center justify-center flex-shrink-0 appearance-none border-0 outline-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{ width: 34, height: 34, background: '#E0213A' }}
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* 右カラム: 在室メンバー + ランキング */}
            <div className="flex flex-col" style={{ gap: 18 }}>
              <div className="bg-white flex flex-col" style={{ borderRadius: 22, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: 20, gap: 12 }}>
                <div className="flex items-center justify-between">
                  <div style={{ fontSize: 14, fontWeight: 900 }}>
                    <span style={{ color: '#E0213A' }}>👥</span> 在室メンバー <span style={{ fontSize: 11, fontWeight: 400, color: '#B78F98' }}>{pulse?.concentratingCount ?? members.length}人</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#E0213A', cursor: 'pointer' }}>すべて見る ›</span>
                </div>
                {members.map((m) => (
                  <div key={m.id} className="flex items-center" style={{ gap: 10 }}>
                    <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 38, height: 38, background: '#F6D2D2', fontSize: 16 }}>
                      {m.avatarEmoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{m.nickname}</div>
                      <div style={{ fontSize: 10, color: '#2FA35C' }}>● 学習中 <span style={{ color: '#A9909A' }}>{m.activityLabel}</span></div>
                    </div>
                    <span style={{ fontSize: 11, color: '#8A767D' }}>{formatMinutesHM(m.elapsedMinutes)}</span>
                    <span style={{ fontSize: 11, color: '#E0213A', fontWeight: 700 }}>♥ {m.hearts}</span>
                    <span
                      onClick={() => !m.cheeredByMe && cheer(m.id)}
                      style={{
                        fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '5px 10px', flexShrink: 0,
                        background: m.cheeredByMe ? '#F3E7EA' : '#E0213A',
                        color: m.cheeredByMe ? '#B7A0A7' : '#fff',
                        cursor: m.cheeredByMe ? 'default' : 'pointer',
                      }}
                    >
                      {m.cheeredByMe ? '応援済' : '応援'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-white flex flex-col" style={{ borderRadius: 22, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: 20, gap: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 900 }}>
                  <span style={{ color: '#E0213A' }}>👑</span> ランキング <span style={{ fontSize: 10, fontWeight: 400, color: '#B78F98' }}>みんなのがんばりを讃え合おう！</span>
                </div>
                <div className="flex" style={{ gap: 7 }}>
                  {RANKING_TABS.map((t) => (
                    <span
                      key={t.type}
                      onClick={() => setRankingTab(t.type)}
                      style={{
                        borderRadius: 999, padding: '6px 12px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                        background: rankingTab === t.type ? '#E0213A' : '#FBF2F4',
                        color: rankingTab === t.type ? '#fff' : '#A9909A',
                      }}
                    >
                      {t.label}
                    </span>
                  ))}
                </div>
                <div className="grid" style={{ gridTemplateColumns: '1fr 1.15fr 1fr', gap: 9, alignItems: 'end' }}>
                  {[ranking[1], ranking[0], ranking[2]].map((r, i) => {
                    if (!r) return <div key={i} />;
                    const isFirst = i === 1;
                    return (
                      <div
                        key={r.rank}
                        style={{
                          background: isFirst ? '#FFF6E4' : '#FBF4F5',
                          border: isFirst ? '1px solid #F2E2B8' : undefined,
                          borderRadius: 14, padding: isFirst ? '14px 8px' : '12px 8px', textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: isFirst ? 12 : 11, fontWeight: 900, color: isFirst ? '#DFA211' : '#8A98A8' }}>
                          {isFirst ? `👑 ${r.rank}` : r.rank}
                        </div>
                        <span className="flex items-center justify-center rounded-full" style={{ width: isFirst ? 48 : 40, height: isFirst ? 48 : 40, background: '#F6D2D2', margin: '6px auto', fontSize: isFirst ? 20 : 16 }}>
                          {r.avatarEmoji}
                        </span>
                        <div style={{ fontSize: isFirst ? 12 : 11, fontWeight: isFirst ? 900 : 700 }}>{r.nickname}</div>
                        <div style={{ fontSize: 10, color: '#8A767D' }}>{formatRankingValue(rankingTab, r.value)}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-col">
                  {ranking.slice(3).map((r) => (
                    <div
                      key={r.rank}
                      className="flex items-center"
                      style={
                        r.isMe
                          ? { gap: 10, padding: '9px 8px', fontSize: 12, background: '#FDF0F2', borderRadius: 10, marginTop: 6 }
                          : { gap: 10, padding: '8px 4px', fontSize: 12, borderBottom: '1px solid #F7EAEC' }
                      }
                    >
                      <span style={{ width: 18, color: r.isMe ? '#E0213A' : '#8A767D', fontWeight: r.isMe ? 900 : 400 }}>{r.rank}</span>
                      <span className="flex-1" style={{ fontWeight: r.isMe ? 900 : 700 }}>{r.isMe ? 'あなたの順位' : r.nickname}</span>
                      <span style={{ color: r.isMe ? '#E0213A' : '#8A767D', fontWeight: r.isMe ? 700 : 400 }}>{formatRankingValue(rankingTab, r.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {pulse && (
                <div className="bg-white flex items-center justify-between flex-wrap" style={{ borderRadius: 18, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: '15px 18px', gap: 10 }}>
                  <span style={{ fontSize: 12 }}>🌟 あなたは本日 <b style={{ color: '#E0213A' }}>{pulse.myCheerCountToday}回</b> 応援しました 👏</span>
                  <button className="appearance-none border-0 outline-none" style={{ background: '#FDF0F2', color: '#C24358', borderRadius: 999, padding: '8px 15px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                    応援履歴を見る
                  </button>
                </div>
              )}
            </div>
          </div>
      </main>
    </div>
  );
}

export default FocusBoothPage;
