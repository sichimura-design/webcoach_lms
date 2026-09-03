/**
 * AIチャットに添付する画像の検証と縮小。
 *
 * チャットAPIは 1リクエスト1枚（AIRequest.image）で、画像はサーバに保存されない。
 * base64 で JSON ボディに載せて送るため、5MB の写真はそのままだと約6.7MB になり
 * BFF の JSON 上限（8mb）に対して余裕がない。長辺 1600px を超えるものは
 * canvas で縮めてから渡す。
 *
 * 🔴 縮小は「選択したとき」に済ませる。送信時にやると、プレビューで見ている絵と
 *    実際に飛ぶバイト列が別物になり、添付チップに実サイズも出せない。
 *
 * 🔴 throw ではなくコード付きの結果を返す。呼び出し側（useAiChat）を try/catch で
 *    汚さず、文言の出し分けを1箇所（chatImageErrorMessage）に閉じるため。
 */

/** サーバ側（Claude）が受け付ける形式 */
export const ALLOWED_CHAT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** 受け入れる元ファイルの上限。従来の挙動を変えない */
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

/** 縮小後の長辺 */
export const MAX_EDGE = 1600;

/** これ以下の小さいファイルは触らない（再エンコードで劣化させる意味がない） */
export const KEEP_AS_IS_BYTES = 1.5 * 1024 * 1024;

/** base64 化した後の上限。BFF の JSON 上限 8mb に対する安全側 */
export const MAX_ENCODED_BYTES = 6 * 1024 * 1024;

/** JPEG 再エンコードの品質 */
const JPEG_QUALITY = 0.85;

export interface ChatImageAttachment {
  /** data:<mime>;base64,… プレビューにもそのまま使う */
  dataUrl: string;
  /** AIImageAttachment.media_type にそのまま渡す */
  mediaType: string;
  fileName: string;
  /** 縮小後の実バイト数（添付チップの表示用） */
  byteSize: number;
  width: number;
  height: number;
  /** 縮小したかどうか。チップに「圧縮しました」を出すため */
  downscaled: boolean;
}

export type ChatImageErrorCode =
  | 'unsupported-type'
  | 'too-large'
  | 'decode-failed'
  | 'encode-too-large';

export type PrepareChatImageResult =
  | { ok: true; image: ChatImageAttachment }
  | { ok: false; code: ChatImageErrorCode };

const ERROR_MESSAGES: Record<ChatImageErrorCode, string> = {
  'unsupported-type': '対応していない画像形式です（JPEG / PNG / WebP / GIF）',
  'too-large': '画像が大きすぎます（1枚あたり5MBまで）',
  'decode-failed': '画像を読み込めませんでした。別の画像でお試しください',
  'encode-too-large':
    '画像の容量が大きすぎて送信できません。範囲を狭めて撮り直すか、別の画像でお試しください',
};

export function chatImageErrorMessage(code: ChatImageErrorCode): string {
  return ERROR_MESSAGES[code];
}

/** 「412KB」「1.2MB」のように読める形にする */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** data URL の base64 部分から元のバイト数を求める */
function base64ByteSize(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** data URL の先頭から実際の mime を読む */
function mediaTypeOf(dataUrl: string): string {
  const semi = dataUrl.indexOf(';');
  return semi > 5 ? dataUrl.slice(5, semi) : '';
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * 画像を読み込んで寸法を得る。
 * 🔴 createImageBitmap ではなく <img> を使う。<img> のデコードは EXIF の向きを
 *    反映してくれるので、横向きに撮った写真がそのまま起きた状態で入る。
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode failed'));
    };
    img.src = url;
  });
}

export async function prepareChatImage(file: File): Promise<PrepareChatImageResult> {
  // includes は ES2016。tsconfig の lib は es6 までなので indexOf を使う
  if (ALLOWED_CHAT_IMAGE_TYPES.indexOf(file.type) < 0) {
    return { ok: false, code: 'unsupported-type' };
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return { ok: false, code: 'too-large' };
  }

  const fileName = file.name || '画像';

  // 🔴 GIF は canvas に通さない。1コマ目に固まってアニメーションが黙って死ぬ。
  //    容量が通らなければ encode-too-large で弾く方がまだ説明がつく。
  if (file.type === 'image/gif') {
    return finishWithoutResize(file, fileName);
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return { ok: false, code: 'decode-failed' };
  }

  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
  if (longEdge <= MAX_EDGE && file.size <= KEEP_AS_IS_BYTES) {
    return finishWithoutResize(file, fileName, img.naturalWidth, img.naturalHeight);
  }

  const scale = Math.min(1, MAX_EDGE / longEdge);
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return finishWithoutResize(file, fileName, img.naturalWidth, img.naturalHeight);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // PNG は PNG のまま（透過を保つ）。それ以外は JPEG に寄せて容量を稼ぐ。
  const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  if (outType === 'image/jpeg') {
    // 透過を持つ WebP を JPEG に落とすと透明部分が黒くなるので先に白で塗る
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL(outType, JPEG_QUALITY);
  } catch {
    return finishWithoutResize(file, fileName, img.naturalWidth, img.naturalHeight);
  }

  // 🔴 toDataURL に渡した形式を信用しない。未対応のブラウザは黙って PNG を返す。
  const mediaType = mediaTypeOf(dataUrl);
  if (ALLOWED_CHAT_IMAGE_TYPES.indexOf(mediaType) < 0) {
    return finishWithoutResize(file, fileName, img.naturalWidth, img.naturalHeight);
  }

  const byteSize = base64ByteSize(dataUrl);
  // 小さい PNG は再エンコードで太ることがある。太ったら元を使う。
  if (byteSize >= file.size) {
    return finishWithoutResize(file, fileName, img.naturalWidth, img.naturalHeight);
  }
  if (dataUrl.length > MAX_ENCODED_BYTES) {
    return { ok: false, code: 'encode-too-large' };
  }

  return {
    ok: true,
    image: { dataUrl, mediaType, fileName, byteSize, width, height, downscaled: true },
  };
}

/** 縮小せずにそのまま data URL にする経路 */
async function finishWithoutResize(
  file: File,
  fileName: string,
  width = 0,
  height = 0
): Promise<PrepareChatImageResult> {
  let dataUrl: string;
  try {
    dataUrl = await readAsDataUrl(file);
  } catch {
    return { ok: false, code: 'decode-failed' };
  }
  if (dataUrl.length > MAX_ENCODED_BYTES) {
    return { ok: false, code: 'encode-too-large' };
  }
  return {
    ok: true,
    image: {
      dataUrl,
      mediaType: mediaTypeOf(dataUrl) || file.type,
      fileName,
      byteSize: file.size,
      width,
      height,
      downscaled: false,
    },
  };
}
