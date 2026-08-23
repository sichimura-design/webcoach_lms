/**
 * AIコーチングノート用の MSW ハンドラ。
 * ============================================================
 * 実BFFにはこの機能のAPIが一切存在しないため、全項目をここでモックする。
 * handlers.ts が肥大化するので別ファイルに切り出し、`coachingHandlers` を spread して合流させる。
 *
 * 再現している体験:
 *   コーチから届いたリンクを貼る → LMSからコーチングに参加する → 終了後にノートとタスクが完成している
 *
 * 主な状態:
 *   会議リンク未登録 → 登録済み → 記録中 → AI生成中 → 確認待ち → 確定済み
 *   コーチ未連携 / プラン非対応 / 再認証待ち / サービス不一致 のときは自動取得できないので、
 *   理由を返して手動取り込みのフォールバックへ倒す。
 * ============================================================
 */
import { http, HttpResponse } from 'msw';
import type {
  AudioRetention,
  AutoImportReadiness,
  CoachContacts,
  CoachingAiSummary,
  CoachingSessionDetail,
  CoachingSessionPatch,
  CoachingSessionSummary,
  CoachingSessions,
  ConnectionInvite,
  GoalCandidate,
  MeetingConnection,
  MeetingLink,
  MeetingProviderId,
  NextCoaching,
  RecordingConsent,
  RecordingSource,
  SessionStatus,
  TranscriptSegment,
} from '../types/coaching';
import { COACHING_AGENDA_MAX } from '../types/coaching';
import type { CoachingAgenda } from '../types/coaching';
// 確定した目標を「次回コーチングまでの目標」へ反映するため（詳細はそちらのヘッダコメント）
import { reflectCandidates } from './coachingGoalsStore';

// ---- 疑似トランスクリプト --------------------------------------------------

/** 話者2人のコーチング会話。speaker_1 = コーチ / speaker_2 = 受講生 のつもりだが役割は未割り当てで返す */
const SAMPLE_DIALOGUE: Array<[speaker: 1 | 2, text: string]> = [
  [1, '今日はお時間ありがとうございます。前回から2週間ですが、進み具合はいかがですか。'],
  [2, 'はい、配色の基礎の教材は最後まで終わりました。確認テストも通っています。'],
  [1, '教材を終えられたのは大きいですね。前回決めた3つのうち2つは進んだ形になります。'],
  [2, 'ただ、バナーの制作が思ったより進んでいなくて。'],
  [1, 'どのあたりで止まっていますか。'],
  [2, '最初のラフを作るところまではいったんですが、そこから手が止まってしまって。完成度が気になってしまうというか。'],
  [1, 'なるほど。よくあるつまずき方です。最初から完成度を上げようとすると、だいたい手が止まります。'],
  [1, 'おすすめは、1案目は「粗くていいから最後まで通す」と決めてしまうことです。'],
  [2, '確かに、途中で直しながら作っていました。'],
  [1, '直すのは2案目以降で大丈夫です。まず1案、完成の形まで持っていきましょう。'],
  [2, '分かりました。今週中にやってみます。'],
  [1, '学習時間のほうはどうですか。平日は取れていますか。'],
  [2, '平日はほとんど取れていないです。土日にまとめてやる感じになっています。'],
  [1, 'まとめてやる形だと、間が空いて前回の内容を忘れてしまうことが多いんですよね。'],
  [1, '平日は30分でいいので、単位を小さくして毎日触るほうが結果的に進みます。'],
  [2, '30分なら朝にできそうです。'],
  [1, 'いいですね。朝に固定できると崩れにくいです。'],
  [1, 'ポートフォリオの方向性についても少し話しておきましょうか。どんな案件を狙いたいですか。'],
  [2, '最初は小さめのバナー案件から入りたいと思っています。'],
  [2, 'ただ、ポートフォリオをどこで作るかまだ決めていなくて。'],
  [1, 'そこは次回までに決めておきたいですね。サービスは後からでも移せるので、まずは構成から考えるのがいいです。'],
  [1, '構成案を作って、次回のコーチングで一緒にレビューしましょう。'],
  [2, '構成案というのは、どのくらいの粒度ですか。'],
  [1, '載せる項目と並び順が分かれば十分です。Notionにまとめてもらう形でいいですよ。'],
  [2, '分かりました。次回までに構成案を作って共有します。'],
  [1, 'あと、案件サイトのプロフィールもまだでしたよね。'],
  [2, 'はい、まだ手をつけていません。'],
  [1, 'これは30分あれば書けるので、早めに埋めておきましょう。'],
  [1, 'では次回までは、バナー1案の完成、ポートフォリオ構成案、プロフィール作成の3つですね。'],
  [2, 'はい。あと平日30分の学習を続けてみます。'],
  [1, '無理のない範囲で大丈夫です。では次回、制作物を見せてください。'],
];

function buildSampleSegments(): TranscriptSegment[] {
  let cursor = 12_000;
  return SAMPLE_DIALOGUE.map(([speaker, text], i) => {
    const startMs = cursor;
    // 発言の長さから所要時間をざっくり見積もる
    const durationMs = Math.max(3000, text.length * 180);
    cursor = startMs + durationMs + 800;
    return {
      id: `seg_${String(i + 1).padStart(3, '0')}`,
      speakerId: `speaker_${speaker}`,
      speakerRole: 'unknown' as const,
      startMs,
      endMs: startMs + durationMs,
      text,
      confidence: 0.86 + ((i * 7) % 12) / 100,
    };
  });
}

/** テキスト貼り付け経路: 1行 = 1発言。話者は判別できないので unknown のまま */
function segmentsFromText(text: string): TranscriptSegment[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => ({
      id: `seg_${String(i + 1).padStart(3, '0')}`,
      speakerId: 'unknown',
      speakerRole: 'unknown' as const,
      startMs: i * 8000,
      endMs: i * 8000 + 7000,
      text: line,
      confidence: 1,
    }));
}

// ---- AI構造化出力の生成 ----------------------------------------------------

/**
 * 要約を組み立てる。
 *
 * 仕様§15のルールを構造で守る:
 *  - 根拠IDは必ず実在する segment を指す（UIの「この会話を見る」がリンク切れにならない）
 *  - 会話で決まっていない期限・完了条件は補完せず null にして needsReview を立てる
 *  - 合意された内容だけをタスク化し、数を増やしすぎない
 */
function buildSummary(segments: TranscriptSegment[], sessionId: number): CoachingAiSummary {
  const at = (i: number): string[] => {
    const seg = segments[Math.min(i, segments.length - 1)];
    return seg ? [seg.id] : [];
  };
  const span = (a: number, b: number): string[] =>
    segments.slice(a, Math.min(b + 1, segments.length)).map((s) => s.id);

  const goals: GoalCandidate[] = [
    {
      id: `goal_${sessionId}_1`,
      title: '「まず1案を最後まで通す」進め方に切り替える',
      successCriteria: '途中で直さずに完成まで持っていったバナーが1案ある状態',
      dueDate: '2026-08-09',
      estimatedMinutes: 120,
      priority: 'high',
      sourceSegmentIds: span(6, 10),
      needsReview: false,
      state: 'ai_suggested',
      selected: true,
    },
    {
      // 会話で「朝にできそう」と言っただけで、期限も達成条件も決まっていない
      id: `goal_${sessionId}_2`,
      title: '平日に毎日30分の学習時間を確保する',
      successCriteria: null,
      dueDate: null,
      estimatedMinutes: null,
      priority: 'normal',
      sourceSegmentIds: span(11, 16),
      needsReview: true,
      state: 'ai_suggested',
      selected: false,
    },
  ];

  const tasks: GoalCandidate[] = [
    {
      id: `task_${sessionId}_1`,
      title: 'バナーを1案、完成の形まで作る',
      successCriteria: 'LMSから提出する',
      dueDate: '2026-08-09',
      estimatedMinutes: 120,
      priority: 'high',
      sourceSegmentIds: at(10),
      needsReview: false,
      state: 'ai_suggested',
      selected: true,
    },
    {
      id: `task_${sessionId}_2`,
      title: 'ポートフォリオの構成案を作る',
      successCriteria: '載せる項目と並び順をNotionにまとめて共有する',
      dueDate: '2026-08-07',
      estimatedMinutes: 90,
      priority: 'high',
      sourceSegmentIds: span(22, 24),
      needsReview: false,
      state: 'ai_suggested',
      selected: true,
    },
    {
      id: `task_${sessionId}_3`,
      title: '案件サイトのプロフィールを作成する',
      successCriteria: 'プロフィール欄を最後まで埋めて公開する',
      dueDate: '2026-08-06',
      estimatedMinutes: 30,
      priority: 'normal',
      sourceSegmentIds: span(25, 27),
      needsReview: false,
      state: 'ai_suggested',
      selected: true,
    },
  ];

  return {
    sessionSummary:
      'バナー制作が「完成度を気にして手が止まる」状態で停滞していることを確認し、1案目は粗くても最後まで通す方針で合意しました。学習時間は土日まとめ型から平日30分の毎日型へ切り替えます。ポートフォリオは制作サービスを決める前に構成案から着手し、次回コーチングでレビューします。',
    progressSinceLast: [
      { title: '配色の基礎の教材を最後まで完了（確認テストも通過）', sourceSegmentIds: at(1) },
      { title: '前回設定した3つの目標のうち2つが完了', sourceSegmentIds: at(2) },
      { title: 'バナー制作はラフまで着手（完成には至らず）', sourceSegmentIds: at(5) },
    ],
    coachFeedback: [
      { title: '最初から完成度を上げすぎず、まず1案を最後まで通す', sourceSegmentIds: at(6).concat(at(7)) },
      { title: '直すのは2案目以降にする', sourceSegmentIds: at(9) },
      { title: '平日は30分単位に区切って毎日触る。まとめてやると間が空いて忘れる', sourceSegmentIds: at(13).concat(at(14)) },
      { title: 'ポートフォリオはサービス選定より先に構成から考える', sourceSegmentIds: at(20) },
    ],
    decisions: [
      { title: 'バナー1案を今週中に完成させる', sourceSegmentIds: at(10) },
      { title: '平日朝に30分の学習時間を固定する', sourceSegmentIds: at(15).concat(at(16)) },
      { title: 'ポートフォリオ構成案をNotionにまとめて次回レビューする', sourceSegmentIds: at(23).concat(at(24)) },
      { title: '案件サイトのプロフィールを早めに埋める', sourceSegmentIds: at(27) },
    ],
    goals,
    tasks,
    nextSessionAgenda: [
      'バナー1案のレビュー',
      'ポートフォリオ構成案のレビュー',
      '平日30分の学習が続いたかの振り返り',
      'ポートフォリオを作るサービスの決定',
    ],
    referencedContext: [
      '今回の文字起こし',
      '前回のコーチングノート（第3回）',
      '前回設定した目標 3件',
      '受講中の教材「Webデザイン基礎」の進捗',
      '提出済み課題 2件',
      '中長期の学習ロードマップ',
    ],
  };
}

// ---- ストア ----------------------------------------------------------------

const emptySessionBase = {
  meetingLink: null,
  source: null,
  importedFrom: null,
  status: 'draft' as SessionStatus,
  step: '',
  progress: 0,
  error: null,
  audioRetention: 'keep_30d' as AudioRetention,
  visibility: 'private' as const,
  hasAudio: false,
  segments: [] as TranscriptSegment[],
  summary: null,
  studentMemo: '',
  reflectedGoalIds: [] as string[],
  reflectedAt: null,
};

function seedSession(
  id: number,
  date: string,
  title: string,
  overrides: Partial<CoachingSessionDetail>,
): CoachingSessionDetail {
  const segments = buildSampleSegments();
  return {
    ...emptySessionBase,
    id,
    date,
    title,
    coach: '山田コーチ',
    coachId: 901,
    source: 'auto_recording',
    importedFrom: 'auto',
    segments,
    summary: buildSummary(segments, id),
    ...overrides,
  };
}

const sessionsStore: Record<number, CoachingSessionDetail> = {};

function seedAll(): void {
  const s2 = seedSession(1002, '2026-07-20', '第3回コーチング', {
    status: 'published',
    step: '目標とタスクを確定しました',
    progress: 100,
    studentMemo: '余白の取り方は次のバナーで意識する。',
    reflectedGoalIds: ['goal_1002_1', 'task_1002_1', 'task_1002_2'],
    reflectedAt: '2026-07-20T20:40:00+09:00',
  });
  const s1 = seedSession(1001, '2026-07-06', '第2回コーチング', {
    status: 'published',
    step: '目標とタスクを確定しました',
    progress: 100,
    source: 'pasted_text',
    importedFrom: 'manual',
    reflectedGoalIds: ['goal_1001_1'],
    reflectedAt: '2026-07-06T21:05:00+09:00',
  });
  [s1, s2].forEach((s) => {
    // 反映済みのものはステートも進めておく
    [...(s.summary?.goals ?? []), ...(s.summary?.tasks ?? [])].forEach((g) => {
      if (s.reflectedGoalIds.includes(g.id)) g.state = 'student_confirmed';
    });
    sessionsStore[s.id] = s;
  });
}
seedAll();

/**
 * 次回コーチングの予定日時。
 * 🔴 固定文字列にしない。「次回まであと何日」を出すようになったので、
 *    日付を決め打ちにすると常に過去になり、カウントダウンが負の値になる。
 *    今日から5日後の10:00〜11:00として、表示文字列もそこから起こす。
 */
function buildNextSchedule(): { date: string; startsAt: string } {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  d.setHours(10, 0, 0, 0);
  const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return {
    date: `${d.getMonth() + 1}月${d.getDate()}日(${wd}) 10:00〜11:00`,
    startsAt: d.toISOString(),
  };
}

/** 初期状態は「会議リンク未登録」。仕様§18の1番目の画面から触れるようにする */
let nextCoaching: NextCoaching = {
  ...buildNextSchedule(),
  coach: '山田コーチ',
  coachId: 901,
  meetingLink: null,
  activeSessionId: null,
  activeStatus: null,
};

let consent: RecordingConsent | null = null;
let nextSessionId = 1003;

/** 次回コーチングで相談したいこと。コーチングが終わるまで持ち越す */
let coachingAgenda: CoachingAgenda = { text: '', updatedAt: null };

/**
 * コーチへの連絡手段。初期は両方とも未登録にしておく。
 * デザイン（コーチング トップ 1C）が「未登録 → 登録 → 変更」の3状態を持つので、
 * 最初の状態から順に触れるようにする。
 */
const coachContacts: CoachContacts = { slackUrl: null, email: null };

/** AI生成の開始時刻。GET detail のたびに経過から status を導出する */
const generationStartedAt: Record<number, number> = {};

// ---- 処理状況の導出 --------------------------------------------------------

/** 文字起こしが既に手元にある経路では transcribing 工程が不要 */
function skipsTranscription(source: RecordingSource | null): boolean {
  return source === 'provider_transcript' || source === 'pasted_text';
}

interface Stage {
  until: number;
  status: SessionStatus;
  step: string;
  progress: number;
}

function stagesFor(source: RecordingSource | null): Stage[] {
  if (skipsTranscription(source)) {
    return [
      { until: 1200, status: 'uploading', step: '記録を保存しています', progress: 20 },
      { until: 4000, status: 'summarizing', step: 'コーチング内容を整理しています', progress: 70 },
    ];
  }
  return [
    { until: 1500, status: 'uploading', step: '録画データを取得しています', progress: 15 },
    { until: 5000, status: 'transcribing', step: '文字起こしを作成しています', progress: 45 },
    { until: 8500, status: 'summarizing', step: 'コーチング内容を整理しています', progress: 75 },
  ];
}

/** 経過時間から処理状況を進める。ポーリング（GET detail）のたびに呼ばれる */
function advance(session: CoachingSessionDetail): CoachingSessionDetail {
  const startedAt = generationStartedAt[session.id];
  if (startedAt == null) return session;

  const elapsed = Date.now() - startedAt;
  const stage = stagesFor(session.source).find((s) => elapsed < s.until);

  if (stage) {
    session.status = stage.status;
    session.step = stage.step;
    session.progress = stage.progress;
    return session;
  }

  delete generationStartedAt[session.id];
  session.status = 'review_required';
  session.step = 'AIコーチングノートが完成しました';
  session.progress = 100;
  if (!session.summary) session.summary = buildSummary(session.segments, session.id);
  syncNextCoachingActive(session);
  return session;
}

/** 進行中セッションの状態を次回コーチングカードにも反映する */
function syncNextCoachingActive(session: CoachingSessionDetail): void {
  if (nextCoaching.activeSessionId !== session.id) return;
  nextCoaching.activeStatus = session.status;
  // 確定まで終わったらカードは「次回待ち」に戻す
  if (session.status === 'published') {
    nextCoaching.activeSessionId = null;
    nextCoaching.activeStatus = null;
  }
}

// ---- コーチの録画連携 ------------------------------------------------------

const connectionsStore: Record<string, MeetingConnection> = {};

function seedConnections(): void {
  const seeds: MeetingConnection[] = [
    {
      id: 'conn_1',
      coachId: 901,
      coachName: '山田コーチ',
      coachEmail: 'yamada@example.com',
      provider: 'google_meet',
      status: 'connected',
      planLabel: 'Google Workspace Business Standard',
      reason: null,
      connectedAt: '2026-08-03T10:00:00+09:00',
      lastAutoImportAt: '2026-07-20T11:05:00+09:00',
    },
    {
      id: 'conn_2',
      coachId: 902,
      coachName: '鈴木コーチ',
      coachEmail: 'suzuki@example.com',
      provider: 'zoom',
      status: 'connected',
      planLabel: 'Zoom Pro',
      reason: null,
      connectedAt: '2026-06-12T14:30:00+09:00',
      lastAutoImportAt: '2026-07-18T20:12:00+09:00',
    },
    {
      id: 'conn_3',
      coachId: 903,
      coachName: '佐々木コーチ',
      coachEmail: 'sasaki@example.com',
      provider: null,
      status: 'not_connected',
      planLabel: null,
      reason: null,
      connectedAt: null,
      lastAutoImportAt: null,
    },
    {
      id: 'conn_4',
      coachId: 904,
      coachName: '小林コーチ',
      coachEmail: 'kobayashi@example.com',
      provider: 'zoom',
      status: 'plan_unsupported',
      planLabel: 'Zoom 無料',
      reason:
        'Zoom無料プランにはクラウド録画がありません。ローカル録画はAPIから取得できないため、自動取得は利用できません。',
      connectedAt: '2026-07-02T09:00:00+09:00',
      lastAutoImportAt: null,
    },
    {
      id: 'conn_5',
      coachId: 905,
      coachName: '高橋コーチ',
      coachEmail: 'takahashi@example.com',
      provider: 'google_meet',
      status: 'reauth_required',
      planLabel: 'Google Workspace Business Standard',
      reason: 'アクセス許可の有効期限が切れました。認証URLを再送して、もう一度連携してもらう必要があります。',
      connectedAt: '2026-05-20T16:00:00+09:00',
      lastAutoImportAt: '2026-07-03T19:40:00+09:00',
    },
    {
      id: 'conn_6',
      coachId: 906,
      coachName: '中村コーチ',
      coachEmail: 'nakamura@example.com',
      provider: null,
      status: 'expired',
      planLabel: null,
      reason: '認証URLの有効期限が切れました。再送してください。',
      connectedAt: null,
      lastAutoImportAt: null,
    },
  ];
  seeds.forEach((c) => {
    connectionsStore[c.id] = c;
  });
}
seedConnections();

const invitesStore: Record<string, ConnectionInvite> = {};
let inviteSeq = 1;

function connectionForCoach(coachId: number): MeetingConnection | null {
  return Object.values(connectionsStore).find((c) => c.coachId === coachId) ?? null;
}

function issueInvite(coachId: number, baseUrl: string, resentCount = 0): ConnectionInvite | null {
  const conn = connectionForCoach(coachId);
  // プラン非対応のコーチにURLを配っても接続できないので発行しない
  if (!conn || conn.status === 'plan_unsupported') return null;
  const token = `inv_${String(inviteSeq).padStart(4, '0')}`;
  inviteSeq += 1;
  const invite: ConnectionInvite = {
    token,
    coachId,
    coachName: conn.coachName,
    coachEmail: conn.coachEmail,
    // 有効期限は14日。初回セットアップの日程調整に耐える長さ
    expiresAt: new Date(Date.now() + 14 * 86400_000).toISOString(),
    url: `${baseUrl}/connect/${token}`,
    usedAt: null,
    resentCount,
  };
  invitesStore[token] = invite;
  return invite;
}

/**
 * 受講生側の事前チェック。
 * 「自動で記録が届く」と表示しておいて実は届かない、を防ぐのが目的なので、
 * 届かない条件はすべてここで潰して理由つきで返す。
 */
function buildReadiness(): AutoImportReadiness {
  const connection = connectionForCoach(nextCoaching.coachId);
  const issues: AutoImportReadiness['issues'] = [];

  if (!nextCoaching.meetingLink) {
    issues.push({ code: 'no_meeting_link', message: '会議リンクがまだ登録されていません。' });
  }

  if (!connection || connection.status === 'not_connected' || connection.status === 'revoked' || connection.status === 'expired') {
    issues.push({
      code: 'coach_not_connected',
      message: `${nextCoaching.coach}のAIコーチングノート設定が完了していません。コーチングには参加できますが、録音・文字起こしが利用できない可能性があります。`,
    });
  } else if (connection.status === 'plan_unsupported') {
    issues.push({
      code: 'coach_plan_unsupported',
      message:
        connection.reason ??
        `${nextCoaching.coach}のアカウントでは自動取得に対応していません。コーチングには参加できますが、記録は手動での取り込みになります。`,
    });
  } else if (connection.status === 'reauth_required') {
    issues.push({
      code: 'coach_reauth_required',
      message: `${nextCoaching.coach}の連携の有効期限が切れています。運営が再設定するまで、記録は手動での取り込みになります。`,
    });
  } else if (
    nextCoaching.meetingLink &&
    connection.provider &&
    connection.provider !== nextCoaching.meetingLink.provider
  ) {
    // §3: 会議リンクを発行したアカウントと、LMSに連携したアカウントが一致している必要がある
    const linkLabel = nextCoaching.meetingLink.provider === 'zoom' ? 'Zoom' : 'Google Meet';
    const connLabel = connection.provider === 'zoom' ? 'Zoom' : 'Google Meet';
    issues.push({
      code: 'provider_mismatch',
      message: `登録された会議リンクは${linkLabel}ですが、${nextCoaching.coach}が連携しているのは${connLabel}です。このままでは記録を取得できません。`,
    });
  }

  return { ready: issues.length === 0, connection, issues };
}

// ---- 一覧用の軽量表現 ------------------------------------------------------

function toSummaryRow(s: CoachingSessionDetail): CoachingSessionSummary {
  return {
    id: s.id,
    date: s.date,
    title: s.title,
    coach: s.coach,
    summary: s.summary?.sessionSummary ?? '（まだ記録が取り込まれていません）',
    status: s.status,
    source: s.source,
    importedFrom: s.importedFrom,
    tasksCreated: s.reflectedGoalIds.length > 0,
  };
}

function sortedSessions(): CoachingSessionDetail[] {
  return Object.values(sessionsStore).sort((a, b) => b.date.localeCompare(a.date));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 「第N回コーチング」の連番を既存タイトルの最大値から決める。
 * 件数から数えるとシードの開始番号とズレて同じ回数が2つできてしまう。
 */
function nextSessionTitle(): string {
  const max = Object.values(sessionsStore).reduce((m, s) => {
    const n = Number(s.title.match(/^第(\d+)回/)?.[1] ?? 0);
    return Math.max(m, n);
  }, 0);
  return `第${max + 1}回コーチング`;
}

// ---- ハンドラ --------------------------------------------------------------

export const coachingHandlers = [
  // ==================== コーチの録画連携 ====================

  http.get('*/api/webcoach/meeting-connections', () =>
    HttpResponse.json({
      connections: Object.values(connectionsStore).sort((a, b) => a.coachId - b.coachId),
    }),
  ),

  // 認証URLの一括発行（コーチの初回セットアップで使う）
  http.post('*/api/webcoach/meeting-connections/invites', async ({ request }) => {
    let coachIds: number[] = [];
    let baseUrl = '';
    try {
      const b = (await request.json()) as { coachIds?: number[]; baseUrl?: string };
      coachIds = Array.isArray(b?.coachIds) ? b.coachIds : [];
      baseUrl = b?.baseUrl || '';
    } catch {
      /* ignore */
    }
    const invites = coachIds.map((id) => issueInvite(id, baseUrl)).filter(Boolean) as ConnectionInvite[];
    return HttpResponse.json({ invites }, { status: 201 });
  }),

  // 認証URLの再送（期限切れ・再認証のとき。古いトークンは無効化する）
  http.post('*/api/webcoach/meeting-connections/:coachId/resend', async ({ request, params }) => {
    const coachId = Number(params.coachId);
    let baseUrl = '';
    try {
      const b = (await request.json()) as { baseUrl?: string };
      baseUrl = b?.baseUrl || '';
    } catch {
      /* ignore */
    }
    const previous = Object.values(invitesStore).filter((i) => i.coachId === coachId);
    previous.forEach((i) => delete invitesStore[i.token]);

    const invite = issueInvite(coachId, baseUrl, previous.length);
    if (!invite) {
      return HttpResponse.json({ error: 'このコーチには認証URLを発行できません' }, { status: 409 });
    }
    // 期限切れだった場合は未連携に戻して、再度接続できる状態にする
    const conn = connectionForCoach(coachId);
    if (conn?.status === 'expired') {
      conn.status = 'not_connected';
      conn.reason = null;
    }
    return HttpResponse.json(invite, { status: 201 });
  }),

  // 認証URLの内容（認証不要。コーチはLMSアカウントを持たない）
  http.get('*/api/webcoach/meeting-connections/invites/:token', ({ params }) => {
    const invite = invitesStore[String(params.token)];
    if (!invite) return new HttpResponse(null, { status: 404 });
    const connection = connectionForCoach(invite.coachId);
    const expired = new Date(invite.expiresAt).getTime() < Date.now();
    return HttpResponse.json({ invite, connection, expired });
  }),

  // 連携の完了（本番は OAuth コールバック後の処理）
  http.post('*/api/webcoach/meeting-connections/invites/:token/complete', async ({ request, params }) => {
    const invite = invitesStore[String(params.token)];
    if (!invite) return new HttpResponse(null, { status: 404 });
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      return HttpResponse.json({ error: 'この認証URLは有効期限が切れています。' }, { status: 410 });
    }

    let provider: MeetingProviderId = 'zoom';
    let simulateFreePlan = false;
    let simulateFailure = false;
    try {
      const b = (await request.json()) as {
        provider?: MeetingProviderId;
        simulateFreePlan?: boolean;
        simulateFailure?: boolean;
      };
      if (b?.provider) provider = b.provider;
      simulateFreePlan = !!b?.simulateFreePlan;
      simulateFailure = !!b?.simulateFailure;
    } catch {
      /* ignore */
    }

    if (simulateFailure) {
      return HttpResponse.json(
        { error: '認証に失敗しました。もう一度お試しいただくか、運営までご連絡ください。' },
        { status: 502 },
      );
    }

    const conn = connectionForCoach(invite.coachId);
    if (!conn) return new HttpResponse(null, { status: 404 });

    conn.provider = provider;
    if (simulateFreePlan) {
      // 認可自体は通るが、プランが対応していないので自動取得はできない
      conn.status = 'plan_unsupported';
      conn.planLabel = provider === 'zoom' ? 'Zoom 無料' : '個人Googleアカウント';
      conn.reason =
        provider === 'zoom'
          ? 'Zoom無料プランにはクラウド録画がありません。ローカル録画はAPIから取得できないため、自動取得は利用できません。'
          : '個人Googleアカウントでは Meet の録画・文字起こしを利用できません（Google Workspace が必要です）。';
    } else {
      conn.status = 'connected';
      conn.planLabel = provider === 'zoom' ? 'Zoom Pro' : 'Google Workspace Business Standard';
      conn.reason = null;
    }
    conn.connectedAt = new Date().toISOString();
    // 初回連携の日時を記録する。期限内なら再訪・再連携できる
    if (!invite.usedAt) invite.usedAt = new Date().toISOString();

    return HttpResponse.json(conn);
  }),

  http.delete('*/api/webcoach/meeting-connections/:id', ({ params }) => {
    const conn = connectionsStore[String(params.id)];
    if (!conn) return new HttpResponse(null, { status: 404 });
    conn.status = 'revoked';
    conn.provider = null;
    conn.planLabel = null;
    conn.reason = null;
    conn.connectedAt = null;
    return HttpResponse.json(conn);
  }),

  // ==================== 受講生: 事前チェック ====================

  http.get('*/api/webcoach/coaching-auto-import/readiness/:userid', () =>
    HttpResponse.json(buildReadiness()),
  ),

  // ==================== コーチングセッション ====================
  // ':userid' より先に 'detail' を登録しないと detail が userid として食われる

  http.get('*/api/webcoach/coaching-sessions/detail/:sessionId', ({ params }) => {
    const session = sessionsStore[Number(params.sessionId)];
    if (!session) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(advance(session));
  }),

  http.patch('*/api/webcoach/coaching-sessions/detail/:sessionId', async ({ request, params }) => {
    const session = sessionsStore[Number(params.sessionId)];
    if (!session) return new HttpResponse(null, { status: 404 });

    let patch: CoachingSessionPatch = {};
    try {
      patch = (await request.json()) as CoachingSessionPatch;
    } catch {
      /* ignore */
    }

    if (patch.studentMemo !== undefined) session.studentMemo = patch.studentMemo;
    if (patch.visibility !== undefined) session.visibility = patch.visibility;
    if (patch.audioRetention !== undefined) {
      session.audioRetention = patch.audioRetention;
      if (patch.audioRetention === 'delete_after_summary') session.hasAudio = false;
    }
    if (patch.segments !== undefined) session.segments = patch.segments;
    if (patch.title !== undefined) session.title = patch.title;
    if (patch.date !== undefined) session.date = patch.date;
    if (session.summary) {
      if (patch.goals !== undefined) session.summary = { ...session.summary, goals: patch.goals };
      if (patch.tasks !== undefined) session.summary = { ...session.summary, tasks: patch.tasks };
    }

    return HttpResponse.json(session);
  }),

  http.delete('*/api/webcoach/coaching-sessions/detail/:sessionId', ({ params }) => {
    const id = Number(params.sessionId);
    if (!sessionsStore[id]) return new HttpResponse(null, { status: 404 });
    delete sessionsStore[id];
    delete generationStartedAt[id];
    if (nextCoaching.activeSessionId === id) {
      nextCoaching.activeSessionId = null;
      nextCoaching.activeStatus = null;
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // --- 次回コーチングで相談したいこと ---
  // 🔴 実BFFには無い。コーチング当日に「何を話すんだっけ」から始まらないよう、
  //    思いついたときに書き置ける場所として新設した。
  http.get('*/api/webcoach/coaching-agenda/:userid', () => HttpResponse.json(coachingAgenda)),

  http.put('*/api/webcoach/coaching-agenda/:userid', async ({ request }) => {
    let text = '';
    try {
      const body = (await request.json()) as { text?: string };
      text = typeof body?.text === 'string' ? body.text : '';
    } catch {
      return HttpResponse.json({ error: 'invalid body' }, { status: 400 });
    }
    coachingAgenda = {
      text: text.slice(0, COACHING_AGENDA_MAX),
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json(coachingAgenda);
  }),

  // --- コーチへの連絡手段（Slackリンク / メールアドレス） ---
  // 🔴 実BFFには無い。コーチング以外のタイミングで連絡したくなったとき、
  //    案内メールを探しに行かなくて済むよう、会議リンクと同じ場所に置く。
  http.get('*/api/webcoach/coach-contacts/:userid', () => HttpResponse.json(coachContacts)),

  http.put('*/api/webcoach/coach-contacts/:userid', async ({ request }) => {
    let body: Partial<CoachContacts>;
    try {
      body = (await request.json()) as Partial<CoachContacts>;
    } catch {
      return HttpResponse.json({ error: 'invalid body' }, { status: 400 });
    }

    // 部分更新。キーが来ていない項目は触らない（Slackだけ変えてメールが消える、を防ぐ）
    if ('slackUrl' in body) {
      const raw = (body.slackUrl ?? '').trim();
      if (raw && !/^https:\/\/\S+$/.test(raw)) {
        return HttpResponse.json({ error: 'https:// からはじまるURLを入力してください' }, { status: 400 });
      }
      coachContacts.slackUrl = raw || null;
    }
    if ('email' in body) {
      const raw = (body.email ?? '').trim();
      if (raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        return HttpResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 });
      }
      coachContacts.email = raw || null;
    }
    return HttpResponse.json(coachContacts);
  }),

  // --- 一覧（次回予定 + 履歴 + 同意状況） ---
  http.get('*/api/webcoach/coaching-sessions/:userid', () => {
    // 進行中セッションがあれば状態を最新化してから返す
    if (nextCoaching.activeSessionId) {
      const active = sessionsStore[nextCoaching.activeSessionId];
      if (active) syncNextCoachingActive(advance(active));
    }
    const body: CoachingSessions = {
      next: nextCoaching,
      past: sortedSessions().map(toSummaryRow),
      consent,
    };
    return HttpResponse.json(body);
  }),

  // --- 会議リンクの登録・変更 ---
  http.put('*/api/webcoach/coaching-sessions/:userid/meeting-link', async ({ request }) => {
    try {
      const link = (await request.json()) as MeetingLink;
      nextCoaching.meetingLink = link;
    } catch {
      return HttpResponse.json({ error: '会議リンクを解釈できませんでした' }, { status: 400 });
    }
    return HttpResponse.json(nextCoaching);
  }),

  // --- 録音・文字起こし・AI要約への同意（初回のみ） ---
  http.put('*/api/webcoach/coaching-sessions/:userid/consent', async ({ request }) => {
    try {
      const body = (await request.json()) as RecordingConsent;
      consent = { agreed: !!body?.agreed, agreedAt: body?.agreedAt || new Date().toISOString() };
    } catch {
      consent = { agreed: true, agreedAt: new Date().toISOString() };
    }
    return HttpResponse.json(consent);
  }),

  // --- AIノートを開始して参加する ---
  http.post('*/api/webcoach/coaching-sessions/:userid/start', () => {
    if (!nextCoaching.meetingLink) {
      return HttpResponse.json({ error: '会議リンクが登録されていません' }, { status: 409 });
    }
    // 既に開始済みならそれを返す（二重に作らない）
    if (nextCoaching.activeSessionId) {
      const existing = sessionsStore[nextCoaching.activeSessionId];
      if (existing) return HttpResponse.json(advance(existing));
    }

    const id = nextSessionId;
    nextSessionId += 1;
    const readiness = buildReadiness();
    const session: CoachingSessionDetail = {
      ...emptySessionBase,
      id,
      date: todayIso(),
      title: nextSessionTitle(),
      coach: nextCoaching.coach,
      coachId: nextCoaching.coachId,
      meetingLink: nextCoaching.meetingLink,
      // 自動取得できる状態かどうかで、あとでどちらの経路になるかが決まる
      source: readiness.ready ? 'auto_recording' : null,
      importedFrom: readiness.ready ? 'auto' : null,
      status: 'recording',
      step: 'AIコーチングノート記録中',
      progress: 0,
      hasAudio: readiness.ready,
    };
    sessionsStore[id] = session;
    nextCoaching.activeSessionId = id;
    nextCoaching.activeStatus = 'recording';
    return HttpResponse.json(session, { status: 201 });
  }),

  // --- 【モック専用】コーチング終了 → 取得とAI生成を開始 ---
  http.post('*/api/webcoach/coaching-sessions/:sessionId/finish', ({ params }) => {
    const session = sessionsStore[Number(params.sessionId)];
    if (!session) return new HttpResponse(null, { status: 404 });
    if (session.status !== 'recording') {
      return HttpResponse.json({ error: '記録中のコーチングではありません' }, { status: 409 });
    }

    const readiness = buildReadiness();
    if (!readiness.ready) {
      // 自動取得できないので手動取り込みへ倒す。ここで嘘の「生成中」を見せない
      session.status = 'failed';
      session.step = '';
      session.progress = 0;
      session.error =
        readiness.issues[0]?.message ??
        '録画・文字起こしを取得できませんでした。お手数ですが記録を手動で取り込んでください。';
      syncNextCoachingActive(session);
      return HttpResponse.json(session);
    }

    session.segments = buildSampleSegments();
    session.summary = null;
    session.source = 'auto_recording';
    session.importedFrom = 'auto';
    session.status = 'uploading';
    session.step = '録画データを取得しています';
    session.progress = 10;
    generationStartedAt[session.id] = Date.now();
    syncNextCoachingActive(session);

    const conn = connectionForCoach(session.coachId);
    if (conn) conn.lastAutoImportAt = new Date().toISOString();

    return HttpResponse.json(session);
  }),

  // --- 【フォールバック】記録の手動取り込み ---
  http.post('*/api/webcoach/coaching-sessions/:sessionId/import', async ({ request, params }) => {
    const session = sessionsStore[Number(params.sessionId)];
    if (!session) return new HttpResponse(null, { status: 404 });

    let body: {
      source?: RecordingSource;
      segments?: TranscriptSegment[];
      text?: string;
      audioRetention?: AudioRetention;
      audioSizeBytes?: number;
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      /* ignore */
    }

    const source = body.source ?? 'pasted_text';
    const text = body.text ?? '';

    session.source = source;
    session.importedFrom = 'manual';
    session.error = null;
    session.reflectedGoalIds = [];
    session.reflectedAt = null;
    if (body.audioRetention) session.audioRetention = body.audioRetention;

    if (source === 'pasted_text' && text.trim().length < 20) {
      session.status = 'failed';
      session.step = '';
      session.progress = 0;
      session.error = '内容が読み取れませんでした。もう少し詳しくメモを入力してください。';
      return HttpResponse.json(session);
    }

    if (source === 'provider_transcript') {
      // アップロードされた実ファイルのパース結果をそのまま使う（画面に中身が出る）
      session.segments = body.segments?.length ? body.segments : buildSampleSegments();
    } else if (source === 'pasted_text') {
      session.segments = segmentsFromText(text);
    } else {
      session.segments = buildSampleSegments();
    }

    session.hasAudio = source === 'uploaded_audio';
    session.summary = null;
    session.status = 'uploading';
    session.step = '記録を保存しています';
    session.progress = 10;
    generationStartedAt[session.id] = Date.now();
    syncNextCoachingActive(session);

    return HttpResponse.json(session);
  }),

  // --- 目標・タスクの確定 ---
  http.post('*/api/webcoach/coaching-sessions/:sessionId/confirm-goals', async ({ request, params }) => {
    const session = sessionsStore[Number(params.sessionId)];
    if (!session) return new HttpResponse(null, { status: 404 });

    let goalIds: string[] = [];
    try {
      const body = (await request.json()) as { goalIds?: string[] };
      goalIds = Array.isArray(body?.goalIds) ? body.goalIds : [];
    } catch {
      /* ignore */
    }

    [...(session.summary?.goals ?? []), ...(session.summary?.tasks ?? [])].forEach((g) => {
      if (goalIds.includes(g.id)) g.state = 'student_confirmed';
    });
    // 反映済みは積み上げる（2回目の確定で1回目の分が消えないように）
    session.reflectedGoalIds = Array.from(new Set([...session.reflectedGoalIds, ...goalIds]));
    session.reflectedAt = new Date().toISOString();
    session.status = 'published';
    session.step = '目標とタスクを確定しました';
    session.progress = 100;
    syncNextCoachingActive(session);

    // 🔴 確定した目標を「次回コーチングまでの目標」へ反映する。
    //    ここを繋がないと、コーチングノートで確定してもマイページには何も出ない
    //    （以前は別データだったため実際にそうなっていた）。
    //    候補IDで冪等にしているので、同じ目標を二重に取り込むことはない。
    const confirmed = [...(session.summary?.goals ?? []), ...(session.summary?.tasks ?? [])]
      .filter((g) => goalIds.includes(g.id))
      .map((g) => ({ id: g.id, title: g.title }));
    reflectCandidates(confirmed);

    return HttpResponse.json(session);
  }),

  // --- 次回コーチング予定の更新 ---
  http.put('*/api/webcoach/coaching-sessions/:userid/next', async ({ request }) => {
    try {
      const body = (await request.json()) as Partial<NextCoaching>;
      nextCoaching = { ...nextCoaching, ...body };
    } catch {
      /* ignore */
    }
    return HttpResponse.json(nextCoaching);
  }),
];
