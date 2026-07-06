/**
 * お知らせ（サンプル機能）
 * 実BFFには存在しない新エンドポイント GET /api/webcoach/announcements の型。
 * モックで新機能を作るときの型定義の置き場所の例。
 */
export interface Announcement {
  id: number;
  title: string;
  body: string;
  publishedAt: string;
}
