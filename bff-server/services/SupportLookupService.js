/**
 * 問い合わせ対応用の「受講生の状態確認」
 *
 * メールアドレス1つから、ログイン(Cognito)・学習データ(Moodle)・担当コーチ・
 * コーチング予約と記録の状態を集め、問い合わせの原因の目安(hints)を添えて返す。
 * 読むだけで何も書き換えない。目安の文言は docs/support/ のマニュアルと揃える。
 */

const cognitoAdapter = require('../adapters/CognitoAdapter');
const moodleAdapter = require('../adapters/MoodleAdapter');
const apiServerAdapter = require('../adapters/ApiServerAdapter');

// cdk-prod/lib/cognito-stack.ts の tempPasswordValidity と合わせる
const TEMP_PASSWORD_VALID_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const INACTIVE_DAYS = 30;
// 1人あたりの予約は多くないが、ノート・記録を1件ずつ読むので上限を置く
const MAX_SCHEDULES = 20;

function jstDate(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** 失敗した項目は {error} にして、ほかの項目は出す */
async function settle(fn) {
  try {
    return await fn();
  } catch (err) {
    return { error: err.message };
  }
}

function attr(user, name) {
  return user.Attributes?.find(a => a.Name === name)?.Value;
}

function summarizeCognitoUser(user, groups, now = new Date()) {
  const updatedAt = user.UserLastModifiedDate ? new Date(user.UserLastModifiedDate) : null;
  // 仮パスワードは発行(再発行)した時点から数える。再発行で更新日時も変わるので、それを目安にする
  const tempPasswordExpiresAt = user.UserStatus === 'FORCE_CHANGE_PASSWORD' && updatedAt
    ? new Date(updatedAt.getTime() + TEMP_PASSWORD_VALID_DAYS * DAY_MS)
    : null;
  return {
    username: user.Username,
    sub: attr(user, 'sub') || null,
    name: attr(user, 'name') || null,
    status: user.UserStatus,
    enabled: user.Enabled !== false,
    emailVerified: attr(user, 'email_verified') === 'true',
    createdAt: user.UserCreateDate ? new Date(user.UserCreateDate).toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
    tempPasswordExpiresAt: tempPasswordExpiresAt ? tempPasswordExpiresAt.toISOString() : null,
    tempPasswordExpired: tempPasswordExpiresAt ? tempPasswordExpiresAt.getTime() <= now.getTime() : false,
    groups,
  };
}

function summarizeMoodleUser(user) {
  return {
    id: user.id,
    username: user.username,
    fullname: user.fullname,
    email: user.email,
    firstaccess: user.firstaccess || 0,
    lastaccess: user.lastaccess || 0,
    suspended: !!user.suspended,
  };
}

/**
 * 予約1件が今どの段階か。受講生の画面・コーチの画面のどこで止まっているかを1語で返す
 */
function scheduleStage(schedule, today) {
  const date = schedule.coachingDate;
  const note = schedule.note;
  if (schedule.result === 'rescheduled') return { stage: 'rescheduled', label: 'リスケ', level: 'info' };
  if (date > today) {
    if (date === addDays(today, 1) && !schedule.reminderSentAt) {
      return { stage: 'upcoming', label: '予定(リマインド未送信)', level: 'warning' };
    }
    return { stage: 'upcoming', label: '予定', level: 'info' };
  }
  if (note?.status === 'published') return { stage: 'published', label: '記録公開済み', level: 'ok' };
  if (note?.status === 'coach_confirmed') return { stage: 'confirmed', label: 'コーチ確認済み・受講生に未公開', level: 'warning' };
  if (note?.status === 'ai_suggested') return { stage: 'draft', label: 'AI下書きあり・コーチ未確認', level: 'warning' };
  if (date === today) return { stage: 'today', label: '本日実施', level: 'info' };
  if (schedule.manualAllowed) {
    return {
      stage: 'missed',
      label: schedule.transcript ? '記録の自動作成に失敗(コーチが手で書ける)' : '文字起こしなし(コーチが手で書ける)',
      level: 'danger',
    };
  }
  if (schedule.transcript) return { stage: 'generating', label: '記録を作成中', level: 'info' };
  return { stage: 'waiting', label: '文字起こしの取り込み待ち', level: 'info' };
}

/**
 * 集めた状態から、問い合わせの原因になりそうな点を重い順に並べる
 * level: danger=それが原因でほぼ確実に使えない / warning=問い合わせの原因になりうる / info=参考
 */
function buildHints(result, now = new Date()) {
  const hints = [];
  const add = (level, text) => hints.push({ level, text });
  const { cognito, moodle } = result;

  if (!cognito) {
    add('danger', 'このメールアドレスのアカウントはありません。登録されているメールアドレスが違う可能性があります(招待メールが届いたアドレスを確認してもらう)。');
    return hints;
  }
  if (!cognito.enabled) {
    add('danger', 'アカウントが無効になっています。ログインできません(エンジニアへ)。');
  }
  if (cognito.status === 'FORCE_CHANGE_PASSWORD') {
    if (cognito.tempPasswordExpired) {
      add('danger', `まだ初回ログインをしておらず、仮パスワードの有効期限(${TEMP_PASSWORD_VALID_DAYS}日)が切れています。ログイン画面の「パスワードお忘れですか？」から登録メールアドレスを入れると、新しい仮パスワードが届きます。`);
    } else {
      add('warning', 'まだ初回ログインをしていません(仮パスワードのまま)。招待メールの仮パスワードでログインしてもらいます。届いていなければ「パスワードお忘れですか？」から再発行できます。');
    }
  } else if (cognito.status === 'RESET_REQUIRED') {
    add('danger', 'パスワードの再設定が必要な状態です。「パスワードお忘れですか？」から再設定してもらいます。');
  }
  if (!cognito.emailVerified) {
    add('warning', 'メールアドレスが確認済みになっていません。パスワード再設定のメールが届かない可能性があります(エンジニアへ)。');
  }

  const isStudent = cognito.groups.includes('student');
  const isCoach = cognito.groups.includes('coach');
  if (cognito.groups.length === 0) {
    add('warning', '役割(受講生・コーチ・管理者)が付いていません。ログインしても画面が正しく出ない可能性があります(エンジニアへ)。');
  }

  if (moodle?.error) {
    add('warning', `学習データを確認できませんでした(${moodle.error})。`);
  } else if (!moodle) {
    if (cognito.status === 'CONFIRMED') {
      add('warning', 'パスワード設定は済んでいますが、ログイン後に作られるはずの学習データがありません。ログイン後の初期処理に失敗している可能性があります。もう一度ログインしてもらい、直らなければエンジニアへ。');
    }
  } else {
    if (moodle.suspended) {
      add('danger', '学習データ側でアカウントが停止されています。教材が開けません(エンジニアへ)。');
    }
    if (moodle.lastaccess > 0 && now.getTime() / 1000 - moodle.lastaccess > INACTIVE_DAYS * 24 * 60 * 60) {
      add('info', `${INACTIVE_DAYS}日以上ログインしていません。`);
    }
  }

  if (isStudent && moodle && !moodle.error) {
    if (result.coach && !result.coach.error && !result.coach.id) {
      add('warning', '担当コーチが割り当てられていません。コーチング予約が作れません(管理画面「コーチ割り当て」)。');
    }
    if (Array.isArray(result.schedules)) {
      const today = jstDate(now);
      const upcoming = result.schedules.filter(s => s.coachingDate >= today && s.result !== 'rescheduled');
      if (result.coach?.id && upcoming.length === 0) {
        add('info', '今日以降のコーチング予約はありません(予約はコーチが登録します)。');
      }
      const unpublished = result.schedules.filter(s => s.stage === 'draft' || s.stage === 'confirmed');
      if (unpublished.length > 0) {
        add('warning', `コーチング記録がまだ受講生に公開されていない回が${unpublished.length}件あります(第${unpublished.map(s => s.coachingNo).join('・')}回)。公開するまで受講生には見えません。`);
      }
      const missed = result.schedules.filter(s => s.stage === 'missed');
      if (missed.length > 0) {
        add('warning', `記録が自動で作れなかった回が${missed.length}件あります(第${missed.map(s => s.coachingNo).join('・')}回)。コーチが「記録を手で書く」から書いて公開できます。`);
      }
    }
  }
  if (isCoach && Array.isArray(result.coachStudents) && result.coachStudents.length === 0) {
    add('warning', 'このコーチには担当受講生が割り当てられていません(管理画面「コーチ割り当て」)。');
  }

  const order = { danger: 0, warning: 1, info: 2 };
  return hints.sort((a, b) => order[a.level] - order[b.level]);
}

async function findMoodleUser(cognito, email) {
  // Moodleのidnumberにはログイン時にCognitoのsubを入れている。メールは後から変わりうるので先にsubで探す
  if (cognito?.sub) {
    const bySub = await moodleAdapter.getUsersByField('idnumber', [cognito.sub]);
    if (bySub?.length) return bySub[0];
  }
  const byEmail = await moodleAdapter.getUsersByField('email', [email]);
  return byEmail?.[0] || null;
}

async function loadScheduleDetail(schedule, today) {
  const [note, recordings] = await Promise.all([
    apiServerAdapter.getCoachingNote(schedule.id).catch(err => {
      if (err.response?.status === 404) return { missing: true, manualAllowed: !!err.response.data?.manual_allowed };
      return { error: err.message };
    }),
    settle(() => apiServerAdapter.getCoachingRecordings(schedule.id)),
  ]);
  const transcript = Array.isArray(recordings)
    ? recordings.find(r => r.recording_type === 'transcript')
    : null;
  const detail = {
    id: schedule.id,
    coachingNo: schedule.coaching_no,
    coachingDate: String(schedule.coaching_date).slice(0, 10),
    result: schedule.status || null,
    meetingProvider: schedule.meeting_provider || null,
    hasMeetingUrl: !!schedule.meeting_url,
    reminderSentAt: schedule.reminder_sent_at || null,
    transcript: transcript ? { status: transcript.status, updatedAt: transcript.updated_at } : null,
    note: note && !note.missing && !note.error
      ? { status: note.status, publishedAt: note.published_at || null, updatedAt: note.updated_at || null }
      : null,
    manualAllowed: !!note?.manualAllowed,
    errors: [note?.error, recordings?.error].filter(Boolean),
  };
  return { ...detail, ...scheduleStage(detail, today) };
}

async function lookupByEmail(email, now = new Date()) {
  const result = {
    checkedAt: now.toISOString(),
    email,
    cognito: null,
    moodle: null,
    courses: null,
    coach: null,
    coachStudents: null,
    schedules: null,
  };

  const cognitoUser = await cognitoAdapter.findUserByEmail(email);
  if (cognitoUser) {
    const groups = await cognitoAdapter.listUserGroups(cognitoUser.Username);
    result.cognito = summarizeCognitoUser(cognitoUser, groups.map(g => g.GroupName), now);
  }

  const moodleUser = await settle(() => findMoodleUser(result.cognito, email));
  result.moodle = moodleUser?.error ? moodleUser : moodleUser && summarizeMoodleUser(moodleUser);

  if (result.moodle && !result.moodle.error) {
    const userId = result.moodle.id;
    const groups = result.cognito?.groups || [];
    const isStudent = groups.includes('student');
    const today = jstDate(now);

    const [courses, coach, coachStudents, schedules] = await Promise.all([
      settle(async () => {
        const list = await moodleAdapter.getEnrolledCourses(userId);
        return (list || []).map(c => ({
          id: c.id,
          fullname: c.fullname,
          progress: typeof c.progress === 'number' ? Math.round(c.progress) : null,
          lastaccess: c.lastaccess || 0,
        }));
      }),
      isStudent ? settle(async () => {
        const res = await apiServerAdapter.getStudentCoach(userId);
        if (!res?.coach_user_id) return { id: null };
        const users = await moodleAdapter.getUsersByField('id', [res.coach_user_id]);
        return { id: res.coach_user_id, fullname: users?.[0]?.fullname || null, email: users?.[0]?.email || null };
      }) : null,
      groups.includes('coach') ? settle(async () => {
        const res = await apiServerAdapter.getCoachStudents(userId, false);
        return res?.student_user_ids || [];
      }) : null,
      isStudent ? settle(async () => {
        const list = await apiServerAdapter.getCoachingSchedules(userId);
        const recent = [...(list || [])]
          .sort((a, b) => String(b.coaching_date).localeCompare(String(a.coaching_date)))
          .slice(0, MAX_SCHEDULES);
        return Promise.all(recent.map(s => loadScheduleDetail(s, today)));
      }) : null,
    ]);
    Object.assign(result, { courses, coach, coachStudents, schedules });
  }

  result.hints = buildHints(result, now);
  return result;
}

module.exports = { lookupByEmail, buildHints, scheduleStage, summarizeCognitoUser, TEMP_PASSWORD_VALID_DAYS };
