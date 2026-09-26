-- webcoach_ai_application.description（AI向けの説明文）を、LLMが呼び分けやすい書き方に改善する
--
-- description はAIチャットのツール説明「「{name}」（{category}）に問い合わせます。{description}」として
-- LLMに渡され、どのDifyアプリを呼ぶかの判断材料になる（api-server/agents/tools_langchain.py）。
-- 以前は「〇〇を行うAI」の1行だけで、似たアプリ（案件抽出×3と応募文、添削とデザイン課題）を
-- 区別する手がかりが無かった。各アプリについて
--   ・何をするか ・どんな依頼のときに使うか ・似たアプリとの違い（使わない場面）
-- を書く。受講生向けの文言は display_description 側（add-webcoach-ai-application-display-columns.sql）。
-- 列は varchar(256)（文字数）なので、256文字以内に収めること。

UPDATE `webcoach_ai_application` SET `description` =
  'その日に取り組むデザイン練習の課題を出題し、仕上げた作品の画像にフィードバックする。「今日の課題を出して」「デザインの練習をしたい」など練習のお題が欲しいときに使う。すでにある制作物の講評だけを求めている場合はデザインフィードバックメンターPro ver.2を使う。'
WHERE `secret_key` = 'design-sprint-challenger';

UPDATE `webcoach_ai_application` SET `description` =
  'AIが面接官役になって模擬面接を行い、回答を講評する。「面接の練習をしたい」「面談や商談の受け答えを練習したい」ときに使う。応募したい求人の内容（URLや本文）があれば、それに合わせた質問をする。'
WHERE `secret_key` = 'ai-interview-simulator';

UPDATE `webcoach_ai_application` SET `description` =
  '商品・サービス・バナー・LPの見出しなどのキャッチコピー案を、狙いを変えて複数出す。「キャッチコピーを考えて」「見出しの案がほしい」ときに使う。案件への応募文やプロフィール文の作成には使わない（応募文は案件応募文生成・添削メーカー）。'
WHERE `secret_key` = 'catchcopy-idea-maker';

UPDATE `webcoach_ai_application` SET `description` =
  'バナー・LP・サムネイルなどのデザイン制作物の画像を、プロの視点で講評し改善点を示す。「デザインを添削して」「制作物を見てほしい」と頼まれたときや、制作物の画像が添付されたときに使う。練習用のお題が欲しいだけならデイリーデザインスプリントチャレンジャーを使う。'
WHERE `secret_key` = 'design-feedback-mentor-pro-v2';

UPDATE `webcoach_ai_application` SET `description` =
  '教材や案件の募集文に出てくるデザイン・動画・Web業界の専門用語を、初心者向けにたとえを交えて解説する。「〇〇ってどういう意味？」「この用語がわからない」と用語の意味を聞かれたときに使う。'
WHERE `secret_key` = 'technical-term-ai-assistant';

UPDATE `webcoach_ai_application` SET `description` =
  'クラウドソーシング等の案件に応募するための応募文（提案文）を、募集内容と本人の実績から作成し、書いた応募文の添削もする。「応募文を作って」「提案文を添削して」のときに使う。媒体ごとの版は無くこれ1つだけ。案件そのものを探す依頼なら案件抽出メーカーを使う。'
WHERE `secret_key` = 'project-application-writer';

UPDATE `webcoach_ai_application` SET `description` =
  'クラウドワークス（Crowdworks）に掲載中の案件から、希望条件に合うものを検索して一覧にする（検索に1〜2分かかる）。クラウドワークスで案件を探したいときに使う。応募文の作成・添削には使わない（案件応募文生成・添削メーカーを使う）。'
WHERE `secret_key` = 'project-extractor-crowdworks';

UPDATE `webcoach_ai_application` SET `description` =
  'ランサーズ（Lancers）に掲載中の案件から、希望条件に合うものを検索して一覧にする簡易版（検索に1〜2分かかる）。ランサーズで案件を探したいときに使う。応募文の作成・添削には使わない（案件応募文生成・添削メーカーを使う）。'
WHERE `secret_key` = 'project-extractor-lancers-lite-hardgate';

UPDATE `webcoach_ai_application` SET `description` =
  'ココナラに掲載中の案件（仕事の依頼）から、希望条件に合うものを検索して一覧にする（検索に1〜2分かかる）。ココナラで案件を探したいときに使う。応募文の作成・添削には使わない（案件応募文生成・添削メーカーを使う）。'
WHERE `secret_key` = 'project-extractor-coconala';
