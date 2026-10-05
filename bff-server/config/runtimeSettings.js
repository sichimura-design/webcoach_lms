/**
 * 管理画面の「動作設定」で変えられる設定値の一覧。
 *
 * ここに無い値は画面から触れない。type は int(既定)・boolean・url。
 * 本番ではParameter Store
 * `{prefix}/config/xxx-yyy` に保存し、起動スクリプトが環境変数XXX_YYYとして読み込む。
 * 既定値はapi-server側がruntime_settings.py、BFF側がconfig/environment.jsに持つ。
 */

const { config } = require('./environment');

const RUNTIME_SETTINGS = [
  {
    name: 'AI_CHAT_MAX_OUTPUT_TOKENS',
    service: 'api-server',
    group: 'AIチャット',
    label: '回答の最大トークン数',
    description: 'AIチャットの1回の回答の長さの上限です。小さすぎると回答が途中で切れます。',
    defaultValue: 1024,
    min: 256,
    max: 8192,
  },
  {
    name: 'AI_CHAT_MAX_INPUT_TOKENS',
    service: 'api-server',
    group: 'AIチャット',
    label: '入力の最大トークン数',
    description: '今回の発言と会話履歴を合わせた量の上限です(推定値)。超えた分は古い履歴から削り、発言だけで超えるとエラーになります。',
    defaultValue: 5000,
    min: 1000,
    max: 50000,
  },
  {
    name: 'AI_CHAT_MAX_HISTORY_MESSAGE_CHARS',
    service: 'api-server',
    group: 'AIチャット',
    label: '会話履歴1件あたりの最大文字数',
    description: 'AIに渡す過去のやり取りを、1件あたりこの文字数で切り詰めます。',
    defaultValue: 1200,
    min: 200,
    max: 10000,
  },
  {
    name: 'AI_LEGACY_CHAT_MAX_OUTPUT_TOKENS',
    service: 'api-server',
    group: 'AIチャット',
    label: '旧AIチャットの回答の最大トークン数',
    description: '以前からある簡易版のAIチャット(/api/ai/chat)の回答の長さの上限です。',
    defaultValue: 2048,
    min: 256,
    max: 8192,
  },
  {
    name: 'COACHING_NOTE_MAX_OUTPUT_TOKENS',
    service: 'api-server',
    group: 'AIコーチングノート',
    label: 'ノート生成の最大トークン数',
    description: '議事録から作るノート下書きの長さの上限です。小さすぎるとノートが作れません。',
    defaultValue: 4096,
    min: 1024,
    max: 8192,
  },
  {
    name: 'NOTE_GENERATION_MAX_ATTEMPTS',
    service: 'bff-server',
    group: 'AIコーチングノート',
    label: 'ノート生成の作り直し回数',
    description: 'ノート生成に失敗した回を作り直す回数の上限です。BFFを再起動すると数え直しになります。',
    defaultValue: 3,
    min: 1,
    max: 10,
    current: () => config.noteGenerationMaxAttempts,
  },
  {
    name: 'TRANSCRIPT_SYNC_ENABLED',
    service: 'bff-server',
    type: 'boolean',
    group: '定期処理',
    label: '議事録の同期',
    description: 'Google Meetの議事録を定期的に取得し、AIコーチングノートの下書きを作ります。Organizer(会社のGoogleアカウント)の連携が済んでいる必要があります。',
    defaultValue: false,
    current: () => config.transcriptSyncEnabled,
  },
  {
    name: 'TRANSCRIPT_SYNC_INTERVAL_MINUTES',
    service: 'bff-server',
    group: '定期処理',
    label: '議事録の取得間隔(分)',
    description: 'Google Meetの議事録を取りに行く間隔です。議事録の同期が有効なときだけ使われます。',
    defaultValue: 15,
    min: 5,
    max: 1440,
    current: () => config.transcriptSyncIntervalMinutes,
  },
  {
    name: 'REMINDER_ENABLED',
    service: 'bff-server',
    type: 'boolean',
    group: '定期処理',
    label: 'リマインドメール',
    description: 'コーチング予定のリマインドメールを送ります。メール内のリンクには「画面のURL」を使うので、先にそちらを設定してください。',
    defaultValue: false,
    current: () => config.reminderEnabled,
  },
  {
    name: 'REMINDER_INTERVAL_MINUTES',
    service: 'bff-server',
    group: '定期処理',
    label: 'リマインドメールの確認間隔(分)',
    description: '送るべきリマインドメールがあるかを確認する間隔です。リマインドが有効なときだけ使われます。',
    defaultValue: 60,
    min: 5,
    max: 1440,
    current: () => config.reminderIntervalMinutes,
  },
  {
    name: 'FRONTEND_BASE_URL',
    service: 'bff-server',
    type: 'url',
    group: '接続',
    label: '画面のURL',
    description: 'リマインドメールのリンクと、外部サービス連携のあとに戻る先に使います。本番は https://study.webcoach.jp にしてください(末尾の / は付けない)。',
    defaultValue: 'http://localhost:3000',
    current: () => config.frontendBaseUrl,
  },
  {
    name: 'DB_POOL_SIZE',
    service: 'api-server',
    group: '接続',
    label: 'DB接続の常時確保数',
    description: 'api-server 1台が常に確保しておくDB接続の数です(混雑時はさらに最大20本まで増えます)。台数×(この値+20)とMoodleの接続の合計が、RDSの上限(200)を超えないようにしてください。',
    defaultValue: 10,
    min: 1,
    max: 30,
  },
  {
    name: 'ENABLE_DOCS',
    service: 'api-server',
    type: 'boolean',
    group: '接続',
    label: 'APIの説明ページ(/docs)を公開',
    description: 'api-serverのAPI一覧ページ(/docs・/redoc)を公開します。開発用のため、本番では無効にしてください。',
    defaultValue: true,
  },
];

/** AI_CHAT_MAX_OUTPUT_TOKENS → ai-chat-max-output-tokens (起動スクリプトの変換の逆) */
function toParameterKey(name) {
  return name.toLowerCase().replace(/_/g, '-');
}

module.exports = { RUNTIME_SETTINGS, toParameterKey };
