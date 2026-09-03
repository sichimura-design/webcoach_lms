import { X } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import { PendingImage } from '../../hooks/useAiChat';
import { formatByteSize } from '../../utils/chatImage';
import { CHAT_FOCUS_RING, iconButtonStyle } from './chatTheme';

/**
 * 送信前の添付画像。
 *
 * 以前はサムネの隣に ImageOff アイコンのボタンがあるだけだった。
 * ImageOff は「画像を取り消す」ではなく「画像が無効」に見えるので、
 * 何のボタンなのか読み取れない。サムネ＋ファイル名＋実サイズ＋×に置き換える。
 *
 * サムネ自身もボタンにして、送る前に拡大して確認できるようにしている
 * （貼り付けた直後は、何を貼ったのか本人にも分からないことがある）。
 */
interface ChatAttachmentChipProps {
  image: PendingImage | null;
  preparing: boolean;
  onRemove: () => void;
  onZoom: (src: string, alt?: string) => void;
}

const THUMB = 42;

export function ChatAttachmentChip({ image, preparing, onRemove, onZoom }: ChatAttachmentChipProps) {
  if (preparing) {
    return (
      <div className="flex items-center" style={{ gap: 9, marginBottom: 8 }}>
        <div className="wc-skel" style={{ width: THUMB, height: THUMB, borderRadius: 7 }} />
        <span style={{ ...font.caption, color: color.textFaint, fontFamily: font.family }}>
          画像を準備しています…
        </span>
      </div>
    );
  }

  if (!image) return null;

  const dimension = image.width > 0 ? `${image.width}×${image.height} / ` : '';

  return (
    <div
      className="flex items-center"
      style={{
        gap: 9,
        marginBottom: 8,
        padding: 7,
        border: `1px solid ${color.border}`,
        borderRadius: 9,
        background: color.surface,
      }}
    >
      <button
        type="button"
        onClick={() => onZoom(image.dataUrl, image.fileName)}
        aria-label={`${image.fileName} を拡大して確認する`}
        className={CHAT_FOCUS_RING}
        style={{
          width: THUMB,
          height: THUMB,
          padding: 0,
          border: `1px solid ${color.border}`,
          borderRadius: 7,
          background: color.surface,
          cursor: 'zoom-in',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <img
          src={image.dataUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </button>

      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11.5,
            fontWeight: 700,
            color: color.textStrong,
            fontFamily: font.family,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {image.fileName}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: color.textFaint, fontFamily: font.family }}>
          {dimension}
          {formatByteSize(image.byteSize)}
          {image.downscaled && '・圧縮しました'}
        </p>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label="添付した画像を取り消す"
        title="添付した画像を取り消す"
        className={`wc-ai-icon-btn ${CHAT_FOCUS_RING}`}
        style={iconButtonStyle(26)}
      >
        <X size={13} />
      </button>
    </div>
  );
}

export default ChatAttachmentChip;
