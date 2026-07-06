import React, { useEffect, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { Announcement } from '../types/announcement';

/**
 * お知らせ一覧（サンプル機能）
 * ------------------------------------------------------------
 * 「実BFFに無い新APIをモックで作って新機能を実装する」流れの実例。
 * データは GET /api/webcoach/announcements から取得するが、この
 * エンドポイントは実BFFに存在せず、frontend/src/mocks/handlers.ts の
 * モックが応答する。/announcements で表示。
 */
function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bffClient
      .getAnnouncements()
      .then(setItems)
      .catch((e) => setError(e?.message || 'お知らせの取得に失敗しました'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-brand-bg px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">お知らせ</h1>

        {loading && <p className="text-gray-500">読み込み中...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && (
          <ul className="space-y-4">
            {items.map((a) => (
              <li key={a.id} className="rounded-lg bg-white p-4 shadow-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-semibold">{a.title}</h2>
                  <time className="text-xs text-gray-400">
                    {new Date(a.publishedAt).toLocaleDateString('ja-JP')}
                  </time>
                </div>
                <p className="mt-2 text-sm text-gray-600">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default AnnouncementsPage;
