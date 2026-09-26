/**
 * frontend/src/types/aiApplication.ts
 * AIアプリ（webcoach_ai_application）1行。GET /webcoach/ai-applications の applications[]。
 *
 * name / description はAIチャットがどのアプリを呼ぶか決める材料（AI向け）なので画面には出さない。
 * 画面に出すのは display_name / display_description（NULLなら types/aiSkill.ts の既定文言）。
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
  /** secret_key列の値（Secrets Manager内のキー名。APIキーではない）。NULLならAIチャットから呼べない */
  app_key: string | null;
  created_at: string;
  updated_at: string;
}
