import { useRef } from 'react';
import { AlertTriangle, Copy, ImagePlus, Maximize2, Send, Star, StickyNote, X } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import { LessonAiMessage, UseLessonAi } from '../../hooks/useLessonAi';
import { LessonAiResponse } from '../../types/lesson';
import { AI_SKILL_PREFER_WIDE, isSpecialistSkill } from '../../types/aiSkill';
import MarkdownRenderer from '../MarkdownRenderer';
import SkillSelector from './SkillSelector';
import SkillProposalCard from './SkillProposalCard';
import SkillResultView from './SkillResultView';

/**
 * AIコーチ本体。レッスンページの右パネルと、AI専用ページの中央の両方で使う。
 *
 * 回答は必ず「結論／教材の根拠／今回のケースへの当てはめ／次にやること／参照箇所」の
 * 構造で描く（要件§8）。教材に根拠が無いときは groundedInMaterial が false になるので、
 * 教材の内容であるかのように見せず、一般的な補足であることを明示する。
 *
 * 専門モード（仕様§3）に入っても、ユーザーから見えるのは
 * 「AIコーチのヘッダーが変わって、参照中のものが増えた」だけ。
 * 別のアプリを開いた感覚にさせないことがこの画面の設計意図。
 * 裏で何が呼ばれているかは types/aiSkill.ts のラベル群より先には出さない。
 */
interface AiCoachPaneProps {
  ai: UseLessonAi;
  onSaveAnswer: (message: LessonAiMessage) => void;
  onAppendToMemo: (message: LessonAiMessage) => void;
  onJumpToBlock: (blockId: string) => void;
  disabled: boolean; // 縮退モード（Moodleフォールバック）では教材根拠を作れない
  /**
   * panel … レッスンページの右パネル。狭いので余白を詰める
   * page  … AI専用ページ。作業領域として広く使い、本文幅を制限して読みやすくする
   */
  variant?: 'panel' | 'page';
  /** 「広い画面で続ける」導線。AI専用ページ側では渡さない */
  onExpand?: () => void;
}

/** 画像添付後に出す、質問のきっかけ（要件§7） */
const IMAGE_PROMPTS = [
  'エラーの原因を知りたい',
  '教材基準で添削して',
  '改善点を教えて',
  '次に何を直すべき？',
];

/** 通常時のクイックプロンプト */
const QUICK_PROMPTS = [
  '簡単に説明して',
  '具体例を出して',
  'なぜそうするの？',
  '制作物に当てはめると？',
];

function answerToPlainText(answer: LessonAiResponse): string {
  const lines = [`結論：${answer.conclusion}`];
  if (answer.basis) lines.push(`教材の根拠：${answer.basis}`);
  if (answer.apply) lines.push(`今回のケースへの当てはめ：${answer.apply}`);
  if (answer.next) lines.push(`次にやること：${answer.next}`);
  if (answer.generalNote) lines.push(`教材外の一般的な補足：${answer.generalNote}`);
  if (answer.sources.length) lines.push(`参照箇所：${answer.sources.map((s) => s.heading).join(' / ')}`);
  return lines.join('\n');
}

function AnswerSection({ label, body }: { label: string; body: string }) {
  if (!body) return null;
  return (
    <div style={{ marginTop: 9, padding: '9px 10px', borderRadius: 9, background: color.pageBg }}>
      <strong style={{ display: 'block', marginBottom: 4, fontSize: 10, fontWeight: 800, color: color.text }}>
        {label}
      </strong>
      <span style={{ fontSize: 11.5, lineHeight: 1.75, color: color.textBody }}>{body}</span>
    </div>
  );
}

function AiAvatar() {
  return (
    <div
      aria-hidden
      style={{
        width: 27,
        height: 27,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 8,
        background: color.primary,
        color: '#fff',
        fontSize: 9,
        fontWeight: 900,
        flexShrink: 0,
      }}
    >
      AI
    </div>
  );
}

export function AiCoachPane({
  ai,
  onSaveAnswer,
  onAppendToMemo,
  onJumpToBlock,
  disabled,
  variant = 'panel',
  onExpand,
}: AiCoachPaneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (file) {
      e.preventDefault();
      ai.attachImageFile(file);
    }
  };

  // 確認カードが未回答のあいだは送信させない。ユーザーの選択を待っている状態なので、
  // 続けて質問できてしまうと「さっきの提案はどうなったのか」が分からなくなる。
  const canSend =
    (!!ai.input.trim() || !!ai.image || !!ai.quote) && !ai.loading && !ai.pendingProposal;

  const wide = variant === 'page';
  const contentWidth = wide ? 760 : undefined;
  // 専門モードで作業が続くときだけ拡大を勧める（要件§6の使い分け）
  const highlightExpand = AI_SKILL_PREFER_WIDE[ai.skillId];

  return (
    <section className="flex flex-col" style={{ minHeight: 0, height: '100%', overflow: 'hidden' }}>
      {/* ── ヘッダー：モードと、いま参照しているもの ── */}
      <div
        style={{
          padding: wide ? '11px 20px' : '9px 14px',
          borderBottom: `1px solid ${color.border}`,
          background: color.surface,
          flexShrink: 0,
        }}
      >
        <div className="flex items-center" style={{ gap: 8 }}>
          <strong style={{ ...font.label, fontWeight: 800, color: color.text, flexShrink: 0 }}>
            AIコーチ
          </strong>
          <SkillSelector value={ai.skillId} onChange={ai.selectSkill} disabled={ai.loading} />
          <div style={{ flex: 1 }} />
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              title="いまの会話・レッスン・画像・モードを引き継いで広い画面で続けます"
              className="inline-flex items-center"
              style={{
                gap: 4,
                height: 26,
                padding: '0 9px',
                borderRadius: 8,
                border: `1px solid ${highlightExpand ? color.primaryBorder : color.borderStrong}`,
                background: highlightExpand ? color.primarySoft : color.surface,
                color: highlightExpand ? color.primary : color.textMuted,
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <Maximize2 size={11} /> 広い画面で続ける
            </button>
          )}
        </div>

        {ai.references.length > 0 && (
          <div className="flex flex-wrap items-center" style={{ gap: 5, marginTop: 7 }}>
            <span style={{ fontSize: 9.5, color: color.textFaint, flexShrink: 0 }}>現在参照中</span>
            {ai.references.map((ref) => (
              <span
                key={ref}
                title={ref}
                style={{
                  maxWidth: 190,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: color.primarySoft,
                  color: color.primary,
                  fontSize: 9.5,
                  fontWeight: 700,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {ref}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── 会話 ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: wide ? 20 : 14,
          background: color.pageBg,
          minHeight: 0,
        }}
      >
        <div style={{ maxWidth: contentWidth, margin: wide ? '0 auto' : undefined }}>
          {ai.messages.length === 0 && (
            <div className="flex" style={{ gap: 8 }}>
              <AiAvatar />
              <div
                style={{
                  padding: '11px 12px',
                  border: `1px solid ${color.border}`,
                  borderRadius: 12,
                  background: color.surface,
                }}
              >
                <strong style={{ ...font.label, fontWeight: 800, color: color.text, display: 'block', marginBottom: 6 }}>
                  {ai.context.lessonTitle ? 'このレッスンを前提に回答します' : '学習のことなら何でも相談できます'}
                </strong>
                <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.75, color: color.textBody }}>
                  {!ai.context.lessonTitle
                    ? // 教材の文脈が無い相談（常駐ドロワー・新規の相談）。
                      // ここで「外部コンテンツのため」と出すと、開いていないレッスンの話になってしまう。
                      '困っていることをそのまま書いてください。内容に応じて、添削や文章改善などの専門モードを提案します。'
                    : disabled
                      ? 'このレッスンは外部コンテンツのため、教材単位の根拠提示はできません。一般的な質問にはお答えできます。'
                      : '本文をドラッグして選択すると、その箇所を引用して質問できます。制作物の画像を添付して添削を頼むこともできます。'}
                </p>
              </div>
            </div>
          )}

          {ai.imageDropped && (
            <div
              className="flex items-start"
              style={{
                gap: 6,
                marginBottom: 12,
                padding: '8px 9px',
                borderRadius: 8,
                background: '#FFF8E6',
                border: '1px solid #F0DCA6',
                fontSize: 10.5,
                lineHeight: 1.7,
                color: '#7A6320',
              }}
            >
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>画面を再読み込みしたため、添付画像は保持されていません。もう一度添付してください。</span>
            </div>
          )}

          {ai.messages.map((message) => {
            // ── 経過の説明（モードの切り替わり） ──
            if (message.role === 'system') {
              return (
                <div key={message.id} className="flex items-center" style={{ gap: 8, margin: '4px 0 14px' }}>
                  <span aria-hidden style={{ flex: 1, height: 1, background: color.border }} />
                  <span
                    style={{ fontSize: 9.5, fontWeight: 700, color: color.textFaint, whiteSpace: 'nowrap' }}
                  >
                    {message.content}
                  </span>
                  <span aria-hidden style={{ flex: 1, height: 1, background: color.border }} />
                </div>
              );
            }

            // ── 専門モードへ入る前の確認カード（要件§4-3） ──
            if (message.role === 'proposal' && message.proposal) {
              return (
                <div key={message.id} className="flex" style={{ gap: 8, marginBottom: 14 }}>
                  <AiAvatar />
                  <div style={{ flex: 1, minWidth: 0, maxWidth: '90%' }}>
                    <SkillProposalCard
                      suggestion={message.proposal}
                      variant="confirm"
                      resolution={message.resolution ?? null}
                      hasImage={!!ai.image || ai.messages.some((m) => m.role === 'user' && !!m.image)}
                      disabled={ai.loading}
                      onAccept={() => void ai.acceptProposal(message.id)}
                      onDismiss={() => void ai.dismissProposal(message.id)}
                      onRequestImage={() => fileInputRef.current?.click()}
                    />
                  </div>
                </div>
              );
            }

            if (message.role === 'user') {
              return (
                <div key={message.id} className="flex justify-end" style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      maxWidth: '90%',
                      padding: '11px 12px',
                      border: `1px solid ${color.primaryBorder}`,
                      borderRadius: 12,
                      background: color.primarySoft,
                      color: color.textBody,
                      fontSize: 11.5,
                      lineHeight: 1.75,
                    }}
                  >
                    {message.quote && (
                      <p
                        style={{
                          margin: '0 0 6px',
                          paddingLeft: 8,
                          borderLeft: `3px solid ${color.primary}`,
                          color: color.textMuted,
                          fontSize: 10.5,
                        }}
                      >
                        {message.quote.length > 80 ? `${message.quote.slice(0, 80)}…` : message.quote}
                      </p>
                    )}
                    {message.image && (
                      <img
                        src={message.image}
                        alt="添付した画像"
                        style={{
                          width: '100%',
                          maxHeight: wide ? 260 : 140,
                          objectFit: 'cover',
                          borderRadius: 8,
                          marginBottom: 6,
                        }}
                      />
                    )}
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message.content}</p>
                  </div>
                </div>
              );
            }

            // ── AIコーチの回答（通常回答 または 専門モードの結果） ──
            return (
              <div key={message.id} className="flex" style={{ gap: 8, marginBottom: 14 }}>
                <AiAvatar />
                <div
                  style={{
                    maxWidth: '90%',
                    padding: '11px 12px',
                    border: `1px solid ${color.border}`,
                    borderRadius: 12,
                    background: color.surface,
                  }}
                >
                  {message.skillResult && (
                    <SkillResultView result={message.skillResult} onJumpToBlock={onJumpToBlock} />
                  )}

                  {message.answer && (
                    <>
                      {/* 教材の文脈がある会話でだけ「教材だけでは判断できません」を出す。
                          教材と無関係な相談で出すと、何も約束していないことを謝る形になる。 */}
                      {!message.answer.groundedInMaterial && !!ai.context.lessonTitle && (
                        <div
                          className="flex items-start"
                          style={{
                            gap: 6,
                            marginBottom: 8,
                            padding: '8px 9px',
                            borderRadius: 8,
                            background: '#FFF8E6',
                            border: '1px solid #F0DCA6',
                            fontSize: 10.5,
                            lineHeight: 1.7,
                            color: '#7A6320',
                          }}
                        >
                          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                          <span>この教材だけでは判断できません。以下は教材外の一般的な補足です。</span>
                        </div>
                      )}

                      {/* 教材準拠の回答は「結論」見出し付きの構造で読ませる。
                          教材の文脈が無い一般相談は普通の会話なので見出しを付けず、
                          汎用AIが返すMarkdownをそのまま整形して出す。 */}
                      {ai.context.lessonTitle ? (
                        <>
                          <strong
                            style={{ display: 'block', marginBottom: 6, ...font.label, fontWeight: 800, color: color.text }}
                          >
                            結論
                          </strong>
                          <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.75, color: color.textBody }}>
                            {message.answer.conclusion}
                          </p>
                        </>
                      ) : (
                        <div style={{ fontSize: 11.5, lineHeight: 1.75, color: color.textBody }}>
                          <MarkdownRenderer content={message.answer.conclusion} compact />
                        </div>
                      )}

                      <AnswerSection label="教材の根拠" body={message.answer.basis} />
                      <AnswerSection label="今回のケースへの当てはめ" body={message.answer.apply} />
                      <AnswerSection label="次にやること" body={message.answer.next} />
                      {message.answer.generalNote && (
                        <AnswerSection label="教材外の一般的な補足" body={message.answer.generalNote} />
                      )}

                      {message.answer.sources.length > 0 && (
                        <div className="flex flex-wrap" style={{ gap: 5, marginTop: 8 }}>
                          <span style={{ fontSize: 9.5, color: color.textFaint, alignSelf: 'center' }}>
                            参照した教材箇所
                          </span>
                          {message.answer.sources.map((source) => (
                            <button
                              key={source.blockId}
                              type="button"
                              onClick={() => onJumpToBlock(source.blockId)}
                              title="この教材箇所へ移動"
                              style={{
                                border: `1px solid ${color.primaryBorder}`,
                                borderRadius: 999,
                                background: color.hoverBgTint,
                                color: color.primary,
                                padding: '4px 8px',
                                fontSize: 9.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {source.heading}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* 要件§4-2: 回答の下に控えめに専門モードを提案する */}
                  {message.suggestion && message.suggestion.strength !== 'none' && (
                    <SkillProposalCard
                      suggestion={message.suggestion}
                      variant="inline"
                      resolution={message.resolution ?? null}
                      hasImage={!!ai.image || ai.messages.some((m) => m.role === 'user' && !!m.image)}
                      disabled={ai.loading}
                      onAccept={() => void ai.acceptProposal(message.id)}
                      onDismiss={() => void ai.dismissProposal(message.id)}
                      onRequestImage={() => fileInputRef.current?.click()}
                    />
                  )}

                  <div className="flex flex-wrap" style={{ gap: 5, marginTop: 9 }}>
                    {message.answer && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(answerToPlainText(message.answer!))}
                        className="inline-flex items-center"
                        style={actionButtonStyle}
                      >
                        <Copy size={11} /> コピー
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSaveAnswer(message)}
                      className="inline-flex items-center"
                      style={actionButtonStyle}
                    >
                      <Star size={11} /> 保存
                    </button>
                    <button
                      type="button"
                      onClick={() => onAppendToMemo(message)}
                      className="inline-flex items-center"
                      style={actionButtonStyle}
                    >
                      <StickyNote size={11} /> メモに追加
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {ai.loading && (
            <div className="flex" style={{ gap: 8 }}>
              <AiAvatar />
              <div
                style={{
                  padding: '11px 12px',
                  border: `1px solid ${color.border}`,
                  borderRadius: 12,
                  background: color.surface,
                  fontSize: 11.5,
                  color: color.textMuted,
                }}
              >
                {isSpecialistSkill(ai.skillId)
                  ? '教材の基準に照らして項目ごとに確認しています…'
                  : '教材の該当箇所と照合しています…'}
              </div>
            </div>
          )}
          <div ref={ai.scrollAnchorRef} />
        </div>
      </div>

      {/* ── きっかけチップ ── */}
      <div
        className="flex"
        style={{ gap: 6, overflowX: 'auto', padding: '8px 12px 4px', background: color.surface, flexShrink: 0 }}
      >
        {(ai.image ? IMAGE_PROMPTS : QUICK_PROMPTS).map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={ai.loading || !!ai.pendingProposal}
            onClick={() => void ai.send(prompt)}
            className="disabled:opacity-50"
            style={{
              flex: '0 0 auto',
              height: 28,
              padding: '0 10px',
              border: `1px solid ${color.border}`,
              borderRadius: 999,
              background: color.surface,
              color: color.textMuted,
              fontSize: 10,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* ── 引用中の教材文 ── */}
      {ai.quote && (
        <div
          className="flex items-start"
          style={{
            gap: 8,
            margin: '8px 12px 0',
            padding: '9px 10px',
            borderLeft: `3px solid ${color.primary}`,
            borderRadius: 8,
            background: color.primarySoft,
            fontSize: 10.5,
            lineHeight: 1.6,
            color: color.textSecondary,
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', color: color.text, marginBottom: 2 }}>選択した教材本文</strong>
            <span>{ai.quote.text.length > 110 ? `${ai.quote.text.slice(0, 110)}…` : ai.quote.text}</span>
          </div>
          <button
            type="button"
            onClick={() => ai.setQuote(null)}
            aria-label="引用を削除"
            style={{
              marginLeft: 'auto',
              border: 0,
              background: 'transparent',
              color: color.primary,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── 添付画像プレビュー ── */}
      {ai.image && (
        <div
          className="flex items-center"
          style={{
            gap: 8,
            margin: '7px 12px 0',
            padding: 7,
            border: `1px solid ${color.border}`,
            borderRadius: 9,
            background: color.surface,
            flexShrink: 0,
          }}
        >
          <img
            src={ai.image}
            alt="添付画像のプレビュー"
            style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: 7 }}
          />
          <span style={{ flex: 1, minWidth: 0, fontSize: 10, color: color.textSubtle }}>
            画像を添付しました
          </span>
          <button
            type="button"
            onClick={ai.clearImage}
            aria-label="画像を削除"
            style={{
              width: 26,
              height: 26,
              display: 'grid',
              placeItems: 'center',
              border: `1px solid ${color.border}`,
              borderRadius: 7,
              background: color.surface,
              color: color.iconMuted,
              cursor: 'pointer',
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── 入力 ── */}
      <div
        style={{
          padding: '9px 12px 11px',
          background: color.surface,
          borderTop: `1px solid ${color.border}`,
          flexShrink: 0,
        }}
      >
        <div style={{ maxWidth: contentWidth, margin: wide ? '0 auto' : undefined }}>
          {ai.pendingProposal && (
            <p style={{ margin: '0 0 6px', fontSize: 10, color: color.textFaint }}>
              上の確認に答えると続けられます。
            </p>
          )}
          <div
            style={{
              border: `1px solid ${color.borderStrong}`,
              borderRadius: 12,
              background: color.surface,
              overflow: 'hidden',
            }}
          >
            <textarea
              ref={textareaRef}
              value={ai.input}
              onChange={(e) => ai.setInput(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void ai.send();
                }
              }}
              placeholder={
                ai.quote
                  ? '選択した文章について質問する…'
                  : ai.context.lessonTitle
                    ? 'このレッスンについて質問する…'
                    : '相談したいことを書いてください…'
              }
              style={{
                width: '100%',
                minHeight: wide ? 78 : 56,
                maxHeight: wide ? 200 : 120,
                resize: 'vertical',
                border: 0,
                padding: '10px 11px 4px',
                color: color.text,
                outline: 'none',
                fontSize: 12,
                lineHeight: 1.55,
                fontFamily: 'inherit',
              }}
            />
            <div className="flex items-center" style={{ gap: 7, padding: '5px 7px 7px' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) ai.attachImageFile(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="画像を添付"
                title="画像を添付"
                style={{
                  width: 30,
                  height: 30,
                  display: 'grid',
                  placeItems: 'center',
                  border: 0,
                  borderRadius: 8,
                  background: color.hoverBg,
                  color: color.iconMuted,
                  cursor: 'pointer',
                }}
              >
                <ImagePlus size={15} />
              </button>
              <span style={{ fontSize: 9, color: color.textFaint }}>
                画像貼り付けにも対応 / Ctrl+Enter で送信
              </span>
              <button
                type="button"
                onClick={() => void ai.send()}
                disabled={!canSend}
                className="inline-flex items-center disabled:opacity-50"
                style={{
                  marginLeft: 'auto',
                  gap: 5,
                  height: 30,
                  padding: '0 12px',
                  border: 0,
                  borderRadius: 8,
                  background: color.primary,
                  color: '#fff',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: canSend ? 'pointer' : 'default',
                }}
              >
                <Send size={12} /> 送信
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const actionButtonStyle: React.CSSProperties = {
  gap: 4,
  height: 26,
  padding: '0 8px',
  border: `1px solid ${color.border}`,
  borderRadius: 7,
  background: color.surface,
  color: color.textMuted,
  fontSize: 9.5,
  cursor: 'pointer',
};

export default AiCoachPane;
