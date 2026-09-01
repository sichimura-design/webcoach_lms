import { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import bffClient from '../../services/bffClient';

/**
 * マイノートのデモデータ入れ替えパネル（モック時のみ /notes の右下に出る）。
 *
 * 何のための画面か:
 *   ページ送りの操作性は「何件たまるとどう変わるか」でしか判断できない。
 *   ノートを24枚手で作るのは現実的でないので、件数を指定して入れ直せるようにした。
 *   境界（PAGE_SIZE ちょうど / +1）と、0件の空状態がワンタップで見られる。
 *
 * 🔴 これは開発用の足場で、製品のUIではない。MyNotesPage 側で MOCKS_ENABLED の
 *    ときだけ読み込んでいる（本番ビルドには乗らない）。
 * 🔴 入れ直すと、自分で書いたノートも消える。押す前に分かるよう文言に出す。
 */
interface NotesDevPanelProps {
  /** 1ページの件数（MyNotesPage の PAGE_SIZE）。境界の目安を出すのに使う */
  pageSize: number;
  /** 現在の総件数（絞り込み前） */
  total: number;
  /** 入れ直したあとに一覧を読み直す */
  onDone: () => void | Promise<void>;
}

export function NotesDevPanel({ pageSize, total, onDone }: NotesDevPanelProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState('');

  /** 境界を見るための件数。PAGE_SIZE を軸に並べる */
  const presets: { count: number; label: string }[] = [
    { count: 0, label: '空' },
    { count: 1, label: '1件' },
    { count: pageSize - 1, label: `${pageSize - 1}件` },
    { count: pageSize, label: `${pageSize}件` },
    { count: pageSize + 1, label: `${pageSize + 1}件` },
    { count: pageSize * 2, label: `${pageSize * 2}件` },
    { count: 100, label: '100件' },
    { count: 240, label: '240件' },
  ];

  const reset = async (count: number) => {
    setBusy(true);
    try {
      await bffClient.resetNotes(count);
      await onDone();
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ ...FAB, background: '#2B2629', color: '#FFFFFF' }}
      >
        DEV ノート {total}件
      </button>
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 60,
        width: 268,
        padding: 12,
        borderRadius: 12,
        background: '#2B2629',
        color: '#FFFFFF',
        boxShadow: '0 10px 30px rgba(0,0,0,.35)',
        fontSize: 12,
        lineHeight: 1.6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 12.5 }}>ノートのデモデータ（開発用）</strong>
        <button
          type="button"
          aria-label="閉じる"
          onClick={() => setOpen(false)}
          style={{ border: 0, background: 'none', color: '#FFFFFF', cursor: 'pointer', padding: 2 }}
        >
          <X size={14} />
        </button>
      </div>

      <p style={{ margin: '6px 0 10px', color: 'rgba(255,255,255,.72)' }}>
        いま {total}件 / 1ページ {pageSize}件 → {pageCount}ページ。
        <br />
        入れ直すと今のノートは全部消えます。
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {presets.map((p) => (
          <button
            key={p.count}
            type="button"
            disabled={busy}
            onClick={() => void reset(p.count)}
            style={{ ...PILL, opacity: busy ? 0.5 : 1 }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="件数"
          inputMode="numeric"
          aria-label="入れ直す件数"
          style={{
            width: 74,
            height: 30,
            padding: '0 8px',
            border: '1px solid rgba(255,255,255,.25)',
            borderRadius: 8,
            background: 'rgba(255,255,255,.08)',
            color: '#FFFFFF',
            fontFamily: 'inherit',
            fontSize: 12,
            outline: 'none',
          }}
        />
        <button
          type="button"
          disabled={busy || custom === ''}
          onClick={() => void reset(Number(custom))}
          style={{
            ...PILL,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            flex: 1,
            justifyContent: 'center',
            opacity: busy || custom === '' ? 0.5 : 1,
          }}
        >
          <RotateCcw size={12} /> この件数で入れ直す
        </button>
      </div>

      <p style={{ margin: '8px 0 0', fontSize: 11, color: 'rgba(255,255,255,.55)' }}>
        上限500件。件数はチップで絞る前の総数です。
      </p>
    </div>
  );
}

const FAB: React.CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  zIndex: 60,
  padding: '8px 14px',
  border: 0,
  borderRadius: 9999,
  boxShadow: '0 6px 18px rgba(0,0,0,.3)',
  fontFamily: 'inherit',
  fontSize: 11.5,
  fontWeight: 700,
  cursor: 'pointer',
};

const PILL: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid rgba(255,255,255,.25)',
  borderRadius: 9999,
  background: 'rgba(255,255,255,.08)',
  color: '#FFFFFF',
  fontFamily: 'inherit',
  fontSize: 11.5,
  fontWeight: 700,
  cursor: 'pointer',
};

export default NotesDevPanel;
