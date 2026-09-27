/**
 * frontend/src/types/aiApplication.ts
 * AIアプリ（webcoach_ai_application）1行。GET /webcoach/ai-applications の applications[]。
 *
 * name / description はAIチャットがどのアプリを呼ぶか決める材料（AI向け）。
 * 画面に出すのは display_name / display_description で、NULLのときだけ name / description を出す。
 */
export interface AiApplication {
  id: number;
  name: string;
  category: string;
  description: string;
  url: string | null;
  icon_url: string | null;
  tags: string[];
  display_name: string | null;
  display_description: string | null;
  /** 一覧で束ねる分類の見出し（例: 学習サポート）。NULLなら「そのほか」 */
  display_category: string | null;
  /** 一覧の並び順（小さい順）。NULLは末尾 */
  sort_order: number | null;
  /** secret_key列の値（Secrets Manager内のキー名。APIキーではない）。NULLならAIチャットから呼べない */
  app_key: string | null;
  created_at: string;
  updated_at: string;
}
