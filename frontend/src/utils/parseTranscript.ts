/**
 * Zoom / Google Meet が書き出す文字起こしファイル（VTT / SRT / TXT）を
 * 共通の TranscriptSegment[] に正規化する最小パーサ。
 *
 * 本番実装では bff 側の MeetingProvider が同じ正規化を行う想定だが、
 * モックでは「アップロードしたファイルの中身が実際に画面に出る」ようにするため
 * クライアント側でパースして送る。
 */
import { TranscriptSegment, SpeakerRole } from '../types/coaching';

/** 'hh:mm:ss.mmm' / 'mm:ss.mmm' / 'hh:mm:ss,mmm' をミリ秒へ */
function toMs(stamp: string): number {
  const cleaned = stamp.trim().replace(',', '.');
  const parts = cleaned.split(':').map((p) => parseFloat(p));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  // [ss] / [mm, ss] / [hh, mm, ss]
  const [h, m, s] =
    parts.length === 3 ? parts : parts.length === 2 ? [0, parts[0], parts[1]] : [0, 0, parts[0]];
  return Math.round((h * 3600 + m * 60 + s) * 1000);
}

/**
 * 発言テキストから話者名を切り出す。
 *  - VTT の voice タグ:  <v 山田コーチ>本文
 *  - Zoom / Meet の慣習: 山田コーチ: 本文
 * 話者名が取れなければ null。
 */
function extractSpeaker(line: string): { speaker: string | null; text: string } {
  const voiceTag = line.match(/^<v\s+([^>]+)>([\s\S]*)$/);
  if (voiceTag) {
    return { speaker: voiceTag[1].trim(), text: voiceTag[2].replace(/<\/v>\s*$/, '').trim() };
  }
  // 「名前: 本文」。URL の 'https:' などを拾わないよう、コロン前を短い非空白列に限定する
  const colon = line.match(/^([^\s:][^:]{0,29}):\s+([\s\S]+)$/);
  if (colon) {
    return { speaker: colon[1].trim(), text: colon[2].trim() };
  }
  return { speaker: null, text: line.trim() };
}

/** インラインのタグ（<c.colorE5E5E5> など）を落とす */
function stripTags(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

interface RawCue {
  startMs: number;
  endMs: number;
  lines: string[];
}

/** VTT / SRT に共通の「タイムコード行 + 本文行」構造を読む */
function parseCues(content: string): RawCue[] {
  const normalized = content.replace(/\r\n?/g, '\n');
  const blocks = normalized.split(/\n{2,}/);
  const cues: RawCue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (lines.length === 0) continue;

    const arrowIndex = lines.findIndex((l) => l.includes('-->'));
    if (arrowIndex === -1) continue; // WEBVTT ヘッダやNOTEブロック

    const [rawStart, rawEnd] = lines[arrowIndex].split('-->');
    if (!rawStart || !rawEnd) continue;

    const body = lines.slice(arrowIndex + 1);
    if (body.length === 0) continue;

    cues.push({
      startMs: toMs(rawStart),
      // 終了側は 'hh:mm:ss.mmm align:start position:0%' のように属性が続くことがある
      endMs: toMs(rawEnd.trim().split(/\s+/)[0]),
      lines: body,
    });
  }
  return cues;
}

/**
 * タイムコードを持たないプレーンテキスト。
 * 1行 = 1発言として扱い、時刻は行番号から擬似的に割り当てる。
 */
function parsePlainText(content: string): RawCue[] {
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    // タイムコードを持たない VTT/SRT のヘッダ・キュー番号は発言ではないので落とす
    .filter((l) => l !== '' && !/^WEBVTT\b/.test(l) && !/^NOTE\b/.test(l) && !/^\d+$/.test(l))
    .map((line, i) => ({ startMs: i * 8000, endMs: i * 8000 + 7000, lines: [line] }));
}

function guessRole(speaker: string | null): SpeakerRole {
  if (!speaker) return 'unknown';
  if (/コーチ|coach|講師|メンター/i.test(speaker)) return 'coach';
  return 'unknown';
}

/**
 * 文字起こしファイルの中身を TranscriptSegment[] に変換する。
 * 話者名は speaker_1 / speaker_2 ... に採番し、実名の推測はしない
 * （受講生が画面で「speaker_1 = コーチ」と割り当てる）。
 */
export function parseTranscriptFile(content: string, fileName = ''): TranscriptSegment[] {
  const looksTimed = content.includes('-->');
  const cues = looksTimed ? parseCues(content) : parsePlainText(content);
  // 空ファイルや読めない形式を素通りさせない（呼び出し元でエラー表示させる）
  if (cues.length === 0) {
    throw new Error(`${fileName || 'ファイル'} から発言を読み取れませんでした`);
  }

  // 話者名 → speaker_N の採番テーブル（ファイル全体で一貫させる）
  const speakerIds = new Map<string, string>();
  const idFor = (name: string | null): string => {
    if (!name) return 'unknown';
    const existing = speakerIds.get(name);
    if (existing) return existing;
    const id = `speaker_${speakerIds.size + 1}`;
    speakerIds.set(name, id);
    return id;
  };

  const segments: TranscriptSegment[] = [];
  cues.forEach((cue, i) => {
    const joined = cue.lines.join(' ');
    const { speaker, text } = extractSpeaker(joined);
    const clean = stripTags(text);
    if (!clean) return;
    segments.push({
      id: `seg_${String(i + 1).padStart(3, '0')}`,
      speakerId: idFor(speaker),
      speakerRole: guessRole(speaker),
      startMs: cue.startMs,
      endMs: cue.endMs,
      text: clean,
      // プロバイダーの文字起こしは信頼度を返さないことが多いので固定値
      confidence: 0.9,
    });
  });

  if (segments.length === 0) {
    throw new Error(`${fileName || 'ファイル'} から発言を読み取れませんでした`);
  }
  return segments;
}

/** 話者名の表示ラベル。実名が未割り当てのうちは「話者1」と出す */
export function speakerLabel(speakerId: string, role: SpeakerRole): string {
  if (role === 'coach') return 'コーチ';
  if (role === 'student') return '自分';
  const n = speakerId.match(/^speaker_(\d+)$/);
  return n ? `話者${n[1]}` : '不明';
}

/** ミリ秒 → 'MM:SS' */
export function formatTimecode(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
