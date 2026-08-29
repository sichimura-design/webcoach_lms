/**
 * 会議リンク登録モーダル。
 *
 * 受講生の操作を2〜3アクションに収めるのが狙い。
 * 日時・コーチ名・サービス種別は入力させず、貼り付けた文面から自動で判定する
 * （抽出ロジックは utils/parseMeetingLink.ts）。
 */
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, ClipboardPaste, Link as LinkIcon, X } from 'lucide-react';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import { displayMeetingUrl, parseMeetingLink } from '../../utils/parseMeetingLink';
import type { AutoImportReadiness, MeetingLink } from '../../types/coaching';

interface MeetingLinkModalProps {
  coachName: string;
  /** 既に登録済みなら変更モードになる */
  currentLink: MeetingLink | null;
  readiness: AutoImportReadiness | null;
  onRegister: (link: MeetingLink) => Promise<void>;
  onClose: () => void;
}

const PROVIDER_NAME = { zoom: 'Zoom', google_meet: 'Google Meet' } as const;

export function MeetingLinkModal({
  coachName,
  currentLink,
  readiness,
  onRegister,
  onClose,
}: MeetingLinkModalProps) {
  const [text, setText] = useState('');
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [confirmingChange, setConfirmingChange] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);

  const parsed = useMemo(() => parseMeetingLink(text), [text]);

  const selected: MeetingLink | null = useMemo(() => {
    if (parsed.kind === 'single') return parsed.link;
    if (parsed.kind === 'multiple') {
      return parsed.links.find((l) => `${l.provider}:${l.meetingId}` === chosenId) ?? null;
    }
    return null;
  }, [parsed, chosenId]);

  /** コーチが未連携などで自動取得できない場合の注意（登録自体は成立させる） */
  const coachIssue = readiness?.issues.find((i) => i.code !== 'no_meeting_link') ?? null;

  const pasteFromClipboard = async () => {
    setPasteError(null);
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) {
        setPasteError('クリップボードが空でした。手入力でも登録できます。');
        return;
      }
      setText(clip);
      setChosenId(null);
    } catch {
      setPasteError('クリップボードを読み取れませんでした。手入力で貼り付けてください。');
    }
  };

  const submit = async () => {
    if (!selected || saving) return;
    // 既存リンクがある場合は上書き確認を挟む
    if (currentLink && !confirmingChange) {
      setConfirmingChange(true);
      return;
    }
    setSaving(true);
    try {
      await onRegister(selected);
      setDone(true);
    } finally {
      setSaving(false);
    }
  };

  const backdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: font.family,
      }}
      onClick={backdrop}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '86vh',
          overflowY: 'auto',
          background: color.surface,
          borderRadius: radius.card,
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 0',
          }}
        >
          <h2 style={{ ...font.sectionTitle, color: color.text, margin: 0 }}>
            {done ? '登録が完了しました' : currentLink ? '会議リンクを変更' : '会議リンクを登録'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: color.pageBg,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X className="w-4 h-4" style={{ color: color.textMuted }} />
          </button>
        </div>

        <div style={{ padding: '14px 24px 24px' }}>
          {/* ---- 登録完了 ---- */}
          {done ? (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 18 }}>
                <Check className="w-5 h-5" style={{ color: '#2F7F5B', flexShrink: 0, marginTop: 2 }} />
                <p style={{ ...font.meta, color: color.textBody, margin: 0, lineHeight: 1.9 }}>
                  {coachIssue
                    ? '会議リンクは登録できました。ただし、下記の理由で録音・文字起こしが利用できない可能性があります。'
                    : '次回のコーチングでは、AIコーチングノートを利用できます。'}
                </p>
              </div>
              {coachIssue && (
                <div
                  style={{
                    background: '#FFF6E5',
                    border: '1px solid #F0DDB8',
                    borderRadius: radius.md,
                    padding: '12px 14px',
                    marginBottom: 18,
                  }}
                >
                  <p style={{ ...font.caption, color: '#8A5A10', margin: 0, lineHeight: 1.9 }}>
                    {coachIssue.message}
                  </p>
                </div>
              )}
              <button type="button" onClick={onClose} style={{ ...t.primaryButton, justifyContent: 'center' }}>
                閉じる
              </button>
            </>
          ) : confirmingChange ? (
            /* ---- 上書き確認 ---- */
            <>
              <p style={{ ...font.meta, color: color.textBody, margin: '0 0 8px', lineHeight: 1.9 }}>
                現在登録されている会議リンクを変更しますか？
              </p>
              <div
                style={{
                  background: color.pageBg,
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.md,
                  padding: 14,
                  margin: '0 0 18px',
                }}
              >
                <p style={{ ...font.caption, color: color.textSubtle, margin: '0 0 4px' }}>現在</p>
                <p style={{ ...font.meta, color: color.textMuted, margin: '0 0 12px', wordBreak: 'break-all' }}>
                  {currentLink && displayMeetingUrl(currentLink)}
                </p>
                <p style={{ ...font.caption, color: color.textSubtle, margin: '0 0 4px' }}>変更後</p>
                <p style={{ ...font.meta, color: color.text, margin: 0, fontWeight: 700, wordBreak: 'break-all' }}>
                  {selected && displayMeetingUrl(selected)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setConfirmingChange(false)}
                  style={{ ...t.ghostButton, flex: 1 }}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={saving}
                  style={{ ...t.primaryButton, flex: 1, justifyContent: 'center', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? '変更しています…' : '変更する'}
                </button>
              </div>
            </>
          ) : (
            /* ---- 入力 ---- */
            <>
              <p style={{ ...font.meta, color: color.textBody, margin: '0 0 6px', lineHeight: 1.9 }}>
                コーチから送られてきた Google Meet または Zoom のリンクを貼り付けてください。
              </p>
              <p style={{ ...font.caption, color: color.textMuted, margin: '0 0 14px', lineHeight: 1.8 }}>
                URLだけでなく、送られてきたメッセージをそのまま貼り付けても登録できます。
              </p>

              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setChosenId(null);
                  setPasteError(null);
                }}
                rows={5}
                placeholder={'次回はこちらからお願いします！\n8月10日 10時〜\nhttps://meet.google.com/abc-defg-hij'}
                style={{
                  width: '100%',
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.md,
                  padding: 14,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  lineHeight: 1.8,
                  color: color.text,
                  background: color.surface,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />

              <button
                type="button"
                onClick={pasteFromClipboard}
                style={{ ...t.ghostButton, marginTop: 10, justifyContent: 'center' }}
              >
                <ClipboardPaste className="w-4 h-4" />
                クリップボードから貼り付け
              </button>
              {pasteError && (
                <p style={{ ...font.caption, color: color.textMuted, margin: '8px 0 0' }}>{pasteError}</p>
              )}

              {/* ---- 判定結果 ---- */}
              {text.trim() !== '' && parsed.kind === 'none' && (
                <div
                  style={{
                    marginTop: 16,
                    background: '#FFF6E5',
                    border: '1px solid #F0DDB8',
                    borderRadius: radius.md,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <AlertTriangle className="w-4 h-4" style={{ color: '#B26A00', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p style={{ ...font.meta, color: '#7A4A00', margin: 0, fontWeight: 700 }}>
                        会議リンクを見つけられませんでした
                      </p>
                      <p style={{ ...font.caption, color: '#8A5A10', margin: '6px 0 0', lineHeight: 1.9 }}>
                        Google Meet または Zoom のリンクを含むメッセージを、そのまま貼り付けてください。
                        <br />
                        例：https://meet.google.com/xxx-xxxx-xxx
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {parsed.kind === 'multiple' && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ ...font.rowTitle, color: color.textStrong, margin: '0 0 8px' }}>
                    リンクが{parsed.links.length}件見つかりました。どちらを登録しますか？
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {parsed.links.map((link) => {
                      const key = `${link.provider}:${link.meetingId}`;
                      const active = key === chosenId;
                      return (
                        <label
                          key={key}
                          style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'flex-start',
                            padding: '12px 14px',
                            border: `1px solid ${active ? color.primaryBorder : color.border}`,
                            background: active ? color.primaryTint : color.surface,
                            borderRadius: radius.md,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="radio"
                            name="which-link"
                            checked={active}
                            onChange={() => setChosenId(key)}
                            style={{ marginTop: 3, accentColor: color.primary }}
                          />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ ...font.rowTitle, color: color.text, display: 'block' }}>
                              {PROVIDER_NAME[link.provider]}
                            </span>
                            <span
                              style={{ ...font.caption, color: color.textMuted, wordBreak: 'break-all' }}
                            >
                              {displayMeetingUrl(link)}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {selected && (
                <div
                  style={{
                    marginTop: 16,
                    background: color.pageBg,
                    border: `1px solid ${color.border}`,
                    borderRadius: radius.md,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                    <LinkIcon className="w-4 h-4" style={{ color: color.primary }} />
                    <p style={{ ...font.rowTitle, color: color.text, margin: 0 }}>
                      {PROVIDER_NAME[selected.provider]}のリンクを確認しました
                    </p>
                  </div>
                  <p
                    style={{
                      ...font.meta,
                      color: color.textBody,
                      margin: '0 0 4px',
                      wordBreak: 'break-all',
                    }}
                  >
                    {displayMeetingUrl(selected)}
                  </p>
                  {selected.passcode && (
                    <p style={{ ...font.caption, color: color.textMuted, margin: '0 0 10px' }}>
                      パスコード: {selected.passcode}
                    </p>
                  )}
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: '10px 0 0',
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <li style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <Check className="w-3.5 h-3.5" style={{ color: color.primary, flexShrink: 0, marginTop: 3 }} />
                      <span style={{ ...font.caption, color: color.textBody, lineHeight: 1.8 }}>
                        {coachName}の次回コーチングに登録します
                      </span>
                    </li>
                    <li style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      {coachIssue ? (
                        <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#B26A00', flexShrink: 0, marginTop: 3 }} />
                      ) : (
                        <Check className="w-3.5 h-3.5" style={{ color: color.primary, flexShrink: 0, marginTop: 3 }} />
                      )}
                      <span
                        style={{
                          ...font.caption,
                          color: coachIssue ? '#8A5A10' : color.textBody,
                          lineHeight: 1.8,
                        }}
                      >
                        {coachIssue
                          ? '担当コーチの設定が未完了のため、録音・文字起こしが利用できない可能性があります'
                          : 'AIコーチングノートを利用できます'}
                      </span>
                    </li>
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={!selected || saving}
                style={{
                  ...t.primaryButton,
                  justifyContent: 'center',
                  marginTop: 18,
                  opacity: selected && !saving ? 1 : 0.5,
                  cursor: selected && !saving ? 'pointer' : 'not-allowed',
                }}
              >
                {saving ? '登録しています…' : currentLink ? 'このリンクに変更' : 'このリンクを登録'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MeetingLinkModal;
