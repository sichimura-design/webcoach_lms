import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import bffClient from '../../services/bffClient';

const DICEBEAR_BASE = 'https://api.dicebear.com/9.x';
const ALLOWED_STYLES = ['lorelei', 'bottts-neutral'];

/** 識別子または URL → 表示用 URL に変換 */
export function resolveAvatarUrl(identifier: string | null | undefined, fallbackName: string): string {
  if (!identifier) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName || 'User')}&background=F0EAE6&color=CDC6C6&size=90`;
  }
  // 実URL（APIアバター）
  if (identifier.startsWith('http')) {
    return identifier;
  }
  // DiceBear識別子（後方互換）
  if (identifier.startsWith('dicebear:')) {
    const parts = identifier.split(':');
    if (parts.length === 3) {
      const [, style, seed] = parts;
      if (ALLOWED_STYLES.includes(style)) {
        return `${DICEBEAR_BASE}/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=fce7f3,fde8d8,e0f2fe,d1fae5`;
      }
    }
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName || 'User')}&background=F0EAE6&color=CDC6C6&size=90`;
}

/** CloudFront 認証トークンを URL に付与する */
export function withCfToken(url: string, token: string | null | undefined): string {
  if (!token || !url.startsWith('http')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}cf_token=${encodeURIComponent(token)}`;
}

interface AvatarPickerProps {
  /** 現在選択中のアバターID（APIから取得した数値ID） */
  selectedAvatarId: number | null;
  /** アバターID と URL を受け取るコールバック */
  onSelect: (avatarId: number, url: string) => void;
}

export function AvatarPicker({ selectedAvatarId, onSelect }: AvatarPickerProps) {
  const [open, setOpen] = useState(false);
  const [avatars, setAvatars] = useState<Array<{ avatar_id: number; url: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [contentToken, setContentToken] = useState<string | null>(null);

  useEffect(() => {
    if (open && avatars.length === 0) {
      setLoading(true);
      Promise.all([
        bffClient.getAvatars(),
        bffClient.getContentToken().catch(() => null),
      ])
        .then(([avatarList, tokenResult]) => {
          setAvatars(avatarList);
          if (tokenResult) setContentToken(tokenResult.token);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open]);

  const withToken = (url: string) => withCfToken(url, contentToken);

  const handleSelect = (avatarId: number, url: string) => {
    onSelect(avatarId, url);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#9CA3AF] bg-white border border-[#E5E0DB] rounded-full hover:bg-gray-50 transition-colors"
      >
        アバターを選択
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#4B3A33]">アバターを選ぶ</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E86D78]" />
              </div>
            ) : avatars.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">アバターが見つかりません</p>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {avatars.map(({ avatar_id, url }) => {
                  const isSelected = selectedAvatarId === avatar_id;
                  return (
                    <button
                      key={avatar_id}
                      type="button"
                      onClick={() => handleSelect(avatar_id, url)}
                      className={`relative w-full aspect-square rounded-full overflow-hidden border-2 transition-all ${
                        isSelected
                          ? 'border-[#E86D78] ring-2 ring-[#E86D78]/30 scale-105'
                          : 'border-transparent hover:border-[#FA9262]/50 hover:scale-105'
                      }`}
                    >
                      <img
                        src={withToken(url)}
                        alt={String(avatar_id)}
                        className="w-full h-full object-cover bg-[#FAF8F4]"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-[#E86D78]/10 flex items-center justify-center">
                          <span className="text-white text-lg drop-shadow">✓</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
