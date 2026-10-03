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

/**
 * アプリのモードに入ったとき画面に出す挨拶文と最初の選択肢（GET /webcoach/ai-applications/:appKey/intro）。
 * Difyには何も送らずに、アプリの設定を読んだだけのもの。
 */
export interface AiApplicationIntro {
  app_key: string;
  opening_statement: string;
  suggested_questions: string[];
  /** 選択肢がある＝流れに沿って進むアプリ。最初の発言は選択肢のどれかでないと進まない */
  has_choices: boolean;
  /** 挨拶文＋選択肢ボタン（data-message）の HTML。AIの回答と同じく parseDifyMessage で描画できる */
  message: string;
  /**
   * 会話を始める前に入れてもらう項目（AI面接シミュレーターの求人URL等）。Dify標準画面の開始前フォームと同じもの。
   * Difyでは会話の中では尋ねられないので、画面の入力欄で受け取り、最初の発言と一緒に app_inputs で送る。
   */
  inputs?: AiApplicationInputField[];
}

/** 開始前フォームの1項目（Difyの user_input_form） */
export interface AiApplicationInputField {
  /** Difyの変数名（app_inputs のキー） */
  variable: string;
  /** 入力欄に添える文（「求人情報のURLを入力してください」等。必須の印は外してある） */
  label: string;
  type: 'text-input' | 'paragraph' | 'select' | 'number';
  required: boolean;
  options: string[];
  max_length?: number | null;
}

/**
 * 挨拶文・選択肢・開始前の入力欄のどれかがあるアプリは、モードに入った時点で入口を出す。
 * 選択肢の無いアプリも挨拶文は先に出す。出さないとサーバーが最初の応答の頭に挨拶文を付け、
 * 「〜を教えてください」の直後に同じ吹き出しでアプリの「ありがとうございます」が続いてしまう。
 */
export const introNeedsDisplay = (intro: AiApplicationIntro | null | undefined): boolean =>
  !!intro && (!!intro.opening_statement?.trim() || intro.has_choices || (intro.inputs?.length ?? 0) > 0);
