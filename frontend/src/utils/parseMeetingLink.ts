/**
 * コーチから届いたメッセージから会議リンクを抽出する。
 *
 * 受講生に日時・コーチ名・サービス種別を入力させないための要。
 * 「コピーして貼るだけ」で登録が終わるよう、URL以外の文章・改行・末尾の記号が
 * 混ざっていても拾えるようにしてある。
 *
 * 対応:
 *   - meet.google.com/abc-defg-hij
 *   - zoom.us/j/1234567890（サブドメイン付き us02web.zoom.us も）
 *   - Zoom のパスコード（URLの ?pwd= と、本文の「パスコード: 123456」の両方）
 *   - URLの前後に文章・改行がある
 *   - URLの末尾に句読点・括弧・全角記号が付いている
 *   - 複数URLが含まれる（すべて返し、UI側で選ばせる）
 */
import type { MeetingLink } from '../types/coaching';

/** URLの末尾にくっつきがちな記号を落とす。閉じ括弧は対になっていなければ落とす */
function trimTrailingNoise(url: string): string {
  let out = url;
  // 全角・半角の句読点、引用符、括弧など
  const noise = /[。、．，,.!?！？'"'"「」『』<>＞】）)\]｝}\s]+$/;
  while (noise.test(out)) {
    const stripped = out.replace(noise, '');
    if (stripped === out) break;
    out = stripped;
  }
  // 開き括弧が無いのに閉じ括弧で終わる場合だけ落とす（?pwd=xx) のようなケース）
  while (out.endsWith(')') && !out.includes('(')) out = out.slice(0, -1);
  return out;
}

/** 本文中の「パスコード: 123456」「Passcode: abc」などを拾う */
function findPasscodeInText(text: string): string | null {
  const m = text.match(
    /(?:パスコード|パス\s*コード|passcode|password|pass\s*code|ミーティングパスコード)\s*[:：]?\s*([A-Za-z0-9]{4,20})/i,
  );
  return m ? m[1] : null;
}

/** Zoom の pwd クエリを取り出す */
function findPwdParam(url: string): string | null {
  const m = url.match(/[?&]pwd=([^&\s]+)/i);
  return m ? m[1] : null;
}

function parseGoogleMeet(url: string): MeetingLink | null {
  // meet.google.com/abc-defg-hij （末尾に ?authuser= などが付くことがある）
  const m = url.match(/meet\.google\.com\/([a-z]{3,}-[a-z]{3,}-[a-z]{3,}|[a-z0-9-]{8,})/i);
  if (!m) return null;
  return {
    provider: 'google_meet',
    url: `https://meet.google.com/${m[1]}`,
    meetingId: m[1],
    passcode: null,
  };
}

function parseZoom(url: string, wholeText: string): MeetingLink | null {
  // us02web.zoom.us/j/1234567890 / zoom.us/w/... / zoom.us/my/xxxx
  const m = url.match(/([a-z0-9-]+\.)?zoom\.us\/(?:j|w|my|s)\/([A-Za-z0-9._-]+)/i);
  if (!m) return null;
  const meetingId = m[2];
  const passcode = findPwdParam(url) ?? findPasscodeInText(wholeText);
  // pwd は URL に含まれていればそのまま活かす（クエリを落とすと参加できなくなる）
  const pwd = findPwdParam(url);
  const normalized = pwd
    ? `https://${m[1] ?? ''}zoom.us/j/${meetingId}?pwd=${pwd}`
    : `https://${m[1] ?? ''}zoom.us/j/${meetingId}`;
  return { provider: 'zoom', url: normalized, meetingId, passcode };
}

/**
 * 貼り付けられた文面から会議リンクをすべて抽出する。
 * 同じ会議IDのものは1つにまとめる。
 */
export function extractMeetingLinks(rawText: string): MeetingLink[] {
  if (!rawText.trim()) return [];

  // スキーム無し（meet.google.com/... だけ）でも拾えるようにする
  const candidates = rawText.match(/(?:https?:\/\/)?[\w.-]*(?:meet\.google\.com|zoom\.us)\/[^\s\n]*/gi) ?? [];

  const found: MeetingLink[] = [];
  const seen = new Set<string>();

  candidates.forEach((candidate) => {
    const cleaned = trimTrailingNoise(candidate);
    const link = parseGoogleMeet(cleaned) ?? parseZoom(cleaned, rawText);
    if (!link) return;
    const key = `${link.provider}:${link.meetingId}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(link);
  });

  return found;
}

export type MeetingLinkParseResult =
  | { kind: 'none' }
  | { kind: 'single'; link: MeetingLink }
  | { kind: 'multiple'; links: MeetingLink[] };

export function parseMeetingLink(rawText: string): MeetingLinkParseResult {
  const links = extractMeetingLinks(rawText);
  if (links.length === 0) return { kind: 'none' };
  if (links.length === 1) return { kind: 'single', link: links[0] };
  return { kind: 'multiple', links };
}

/** 画面表示用にスキームを落とした短い形にする */
export function displayMeetingUrl(link: MeetingLink): string {
  return link.url.replace(/^https?:\/\//, '').replace(/\?pwd=.*$/, '');
}
