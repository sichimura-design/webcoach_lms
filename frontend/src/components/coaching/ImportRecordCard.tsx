/**
 * 【フォールバック】記録の手動取り込み。
 *
 * 通常は「AIノートを開始して参加」→ 終了後に自動で届く、で完結する。
 * この画面が出るのは、コーチが未連携・プラン非対応・自動取得に失敗したときだけ。
 * 自動取得の対象外になるコーチが構造的に必ず残るため、この経路は撤去できない。
 *
 * 受講生自身に録音させる経路は持たない。Zoom / Meet を別タブで使っている以上、
 * 受講生のマイクではコーチの声が録れず、「録れているつもりで片側しか録れていない」
 * 事故になるため。
 */
import React, { useCallback, useRef, useState } from 'react';
import { AlertTriangle, FileText, Upload } from 'lucide-react';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import { parseTranscriptFile } from '../../utils/parseTranscript';
import type { ImportRecordPayload, RecordingSource, TranscriptSegment } from '../../types/coaching';

interface Method {
  source: RecordingSource;
  label: string;
  hint: string;
}

/** 並び順 = おすすめ順。プロバイダーの文字起こしが最も速く精度も安定する */
const METHODS: Method[] = [
  {
    source: 'provider_transcript',
    label: '文字起こしファイルをアップロード',
    hint: 'Zoom / Google Meet が書き出した文字起こし（VTT・SRT・TXT）。最も速く、精度も安定します。',
  },
  {
    source: 'uploaded_audio',
    label: '録音・動画をアップロード',
    hint: 'MP3・M4A・WAV・MP4・WebM。会議ツール側で録音したファイルを取り込みます。',
  },
  {
    source: 'pasted_text',
    label: 'コーチングメモから作る',
    hint: '録音がなくても記録できます。話した内容のメモからでも目標とタスクを作れます。',
  },
];

const box: React.CSSProperties = {
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  background: color.pageBg,
  padding: 16,
};

interface ImportRecordCardProps {
  onSubmit: (payload: ImportRecordPayload) => void;
  onCancel?: () => void;
  submitting?: boolean;
  /** 自動取得できなかった理由。分かっていれば冒頭に出す */
  reason?: string | null;
}

export function ImportRecordCard({ onSubmit, onCancel, submitting, reason }: ImportRecordCardProps) {
  const [source, setSource] = useState<RecordingSource>('provider_transcript');
  const [transcriptFile, setTranscriptFile] = useState<{ name: string; segments: TranscriptSegment[] } | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);

  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const acceptTranscript = useCallback(async (file: File) => {
    setFileError(null);
    try {
      const segments = parseTranscriptFile(await file.text(), file.name);
      setTranscriptFile({ name: file.name, segments });
    } catch (e) {
      setTranscriptFile(null);
      setFileError(e instanceof Error ? e.message : 'ファイルを読み取れませんでした');
    }
  }, []);

  const dropHandlers = (accept: (f: File) => void) => ({
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) accept(file);
    },
  });

  const ready = (): boolean => {
    if (source === 'provider_transcript') return !!transcriptFile;
    if (source === 'uploaded_audio') return !!audioFile;
    return text.trim().length > 0;
  };

  const submit = () => {
    if (!ready() || submitting) return;
    if (source === 'provider_transcript' && transcriptFile) {
      onSubmit({ source, segments: transcriptFile.segments, fileName: transcriptFile.name });
    } else if (source === 'uploaded_audio' && audioFile) {
      onSubmit({ source, audio: audioFile, fileName: audioFile.name });
    } else if (source === 'pasted_text') {
      onSubmit({ source, text: text.trim() });
    }
  };

  const renderTranscript = () => (
    <div style={box} {...dropHandlers(acceptTranscript)}>
      <input
        ref={transcriptInputRef}
        type="file"
        accept=".vtt,.srt,.txt"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void acceptTranscript(f);
        }}
      />
      {transcriptFile ? (
        <div>
          <p style={{ ...font.rowTitle, color: color.text, margin: 0 }}>{transcriptFile.name}</p>
          <p style={{ ...font.meta, color: color.textMuted, margin: '4px 0 12px' }}>
            {transcriptFile.segments.length}件の発言を読み取りました
          </p>
          <button type="button" style={t.ghostButton} onClick={() => setTranscriptFile(null)}>
            別のファイルを選ぶ
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <FileText className="w-5 h-5" style={{ color: color.textFaint, margin: '0 auto 8px' }} />
          <p style={{ ...font.meta, color: color.textMuted, margin: '0 0 12px' }}>
            ここにドラッグ＆ドロップ、またはファイルを選択（.vtt / .srt / .txt）
          </p>
          <button type="button" style={t.ghostButton} onClick={() => transcriptInputRef.current?.click()}>
            ファイルを選択する
          </button>
        </div>
      )}
      {fileError && <p style={{ ...font.meta, color: color.primary, marginTop: 10 }}>{fileError}</p>}
    </div>
  );

  const renderAudio = () => (
    <div style={box} {...dropHandlers(setAudioFile)}>
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*,video/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setAudioFile(f);
        }}
      />
      {audioFile ? (
        <div>
          <p style={{ ...font.rowTitle, color: color.text, margin: 0 }}>{audioFile.name}</p>
          <p style={{ ...font.meta, color: color.textMuted, margin: '4px 0 12px' }}>
            {(audioFile.size / 1024 / 1024).toFixed(1)} MB
          </p>
          <button type="button" style={t.ghostButton} onClick={() => setAudioFile(null)}>
            別のファイルを選ぶ
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <Upload className="w-5 h-5" style={{ color: color.textFaint, margin: '0 auto 8px' }} />
          <p style={{ ...font.meta, color: color.textMuted, margin: '0 0 12px' }}>
            ここにドラッグ＆ドロップ、またはファイルを選択（MP3 / M4A / WAV / MP4 / WebM）
          </p>
          <button type="button" style={t.ghostButton} onClick={() => audioInputRef.current?.click()}>
            ファイルを選択する
          </button>
        </div>
      )}
    </div>
  );

  const renderText = () => (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={'話した内容や決まったことを、箇条書きでも構わないので入力してください。\n\n例）\nバナーは完成度を気にせずまず1案作る\n平日は朝30分だけ学習する\nポートフォリオの構成案を次回までに作る'}
        style={{
          width: '100%',
          border: `1px solid ${color.border}`,
          borderRadius: radius.md,
          padding: 14,
          fontFamily: 'inherit',
          fontSize: 14,
          lineHeight: 1.7,
          color: color.text,
          background: color.surface,
          resize: 'vertical',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );

  return (
    <section style={{ ...t.card, padding: 24 }}>
      <h2 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 4px' }}>コーチング記録を取り込む</h2>
      <p style={{ ...font.meta, color: color.textMuted, margin: '0 0 18px', lineHeight: 1.7 }}>
        取り込んだ内容をAIが整理し、次回までの目標とタスクを作ります。内容は必ずご自身で確認してから確定できます。
      </p>

      {reason && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            background: '#FFF6E5',
            border: '1px solid #F0DDB8',
            borderRadius: radius.md,
            padding: '12px 14px',
            marginBottom: 18,
          }}
        >
          <AlertTriangle className="w-4 h-4" style={{ color: '#B26A00', flexShrink: 0, marginTop: 2 }} />
          <p style={{ ...font.caption, color: '#8A5A10', margin: 0, lineHeight: 1.9 }}>{reason}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {METHODS.map((m, i) => {
          const active = m.source === source;
          return (
            <label
              key={m.source}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 14px',
                border: `1px solid ${active ? color.primaryBorder : color.border}`,
                background: active ? color.primaryTint : color.surface,
                borderRadius: radius.md,
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="import-source"
                checked={active}
                onChange={() => {
                  setSource(m.source);
                  setFileError(null);
                }}
                style={{ marginTop: 3, accentColor: color.primary }}
              />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ ...font.rowTitle, color: color.text }}>{m.label}</span>
                  {i === 0 && <span style={t.chip}>おすすめ</span>}
                </span>
                <span style={{ ...font.caption, color: color.textMuted, display: 'block', marginTop: 3, lineHeight: 1.7 }}>
                  {m.hint}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div style={{ marginBottom: 18 }}>
        {source === 'provider_transcript' && renderTranscript()}
        {source === 'uploaded_audio' && renderAudio()}
        {source === 'pasted_text' && renderText()}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {onCancel && (
          <button type="button" style={{ ...t.ghostButton, width: 'auto' }} onClick={onCancel}>
            キャンセル
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!ready() || submitting}
          style={{
            ...t.primaryButton,
            padding: '14px 24px',
            opacity: ready() && !submitting ? 1 : 0.5,
            cursor: ready() && !submitting ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? '取り込んでいます…' : 'AIで整理する'}
        </button>
      </div>
    </section>
  );
}

export default ImportRecordCard;
