# Moodle AI Frontend Architecture

## システム概要

このMoodle AIフロントエンドシステムは、ReactベースのSPA（Single Page Application）と複数のNode.jsサーバーで構成された、Notion APIとの連携機能を持つWebアプリケーションです。

## システム構成図

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   React Frontend    │    │  Direct API Server   │    │    Notion API       │
│   (Port 3000)       │◄──►│    (Port 3004)       │◄──►│   (External API)    │
│                     │    │                      │    │                     │
│ - SPA Application   │    │ - Express Server     │    │ - Pages Search      │
│ - Notion Components │    │ - HTTPS Client       │    │ - Page Content      │
│ - Material Importer │    │ - JSON-RPC Format    │    │ - Block Retrieval   │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
           │
           │                ┌──────────────────────┐
           └───────────────►│  MCP Proxy Server    │
                            │    (Port 3001)       │
                            │                      │
                            │ - MCP Protocol       │
                            │ - Notion MCP Client  │
                            └──────────────────────┘
```

## コンポーネント詳細

### 1. React Frontend (Port 3000)

**役割**: ユーザーインターフェース、Notionデータの表示・操作

**主要ファイル**:
- `src/App.tsx` - メインアプリケーション
- `src/components/NotionImportSelector.tsx` - Notion選択UI
- `src/components/MaterialImporter.tsx` - マテリアルインポート機能
- `src/services/mcpNotionService.ts` - Notion API サービス

**機能**:
- Notionページ検索・選択
- コンテンツプレビュー
- マテリアルインポート
- エラーハンドリング

**プロキシ設定**:
```json
"proxy": "http://localhost:3004"
```

### 2. Direct API Server (Port 3004)

**役割**: Notion API への直接アクセス、HTTPSリクエスト処理

**ファイル**: `direct-notion-api.js`

**主要エンドポイント**:
- `POST /api/notion/search` - Notion検索
- `GET /api/notion/page/:pageId` - ページ取得
- `GET /api/notion/blocks/:blockId` - ブロック取得
- `GET /health` - ヘルスチェック

**実装詳細**:
```javascript
// 設定ファイルベースの構成
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const PORT = process.env.PORT || config.ports.directApi;

// Notion API 直接呼び出し
function callNotionAPI(endpoint, method = 'GET', data = null) {
  // HTTPS クライアントによる直接通信
  // Bearer トークン認証
  // JSON レスポンス処理
}
```

### 3. MCP Proxy Server (Port 3001)

**役割**: MCP（Model Context Protocol）を使用したNotion API アクセス

**ファイル**: `mcp-proxy-server.js`

**機能**:
- MCP プロトコル実装
- Notion MCP サーバーとの通信
- JSON-RPC フォーマット処理

### 4. 設定管理システム

**設定ファイル**: `config.json`
```json
{
  "ports": {
    "frontend": 3000,
    "directApi": 3004,
    "mcpProxy": 3001
  },
  "notion": {
    "apiVersion": "2022-06-28"
  }
}
```

**自動化スクリプト**: `update-proxy.js`
- 設定ファイル読み込み
- package.json の proxy 設定自動更新
- 開発環境での設定同期

## データフロー

### 1. Notion検索フロー

```
User Action → React Component → mcpNotionService
                    ↓
              Direct API優先実行
                    ↓
    POST /api/notion/search (Port 3004)
                    ↓
           Notion API (HTTPS)
                    ↓
              JSON Response
                    ↓
         Format & Display Pages
```

### 2. フォールバック機能

Direct API失敗時は自動的にMCP Proxyに切り替え:

```javascript
// Direct API を優先実行
if (this.preferDirectApi) {
  try {
    const response = await fetch(`${this.directApiUrl}/search`, {...});
    // 成功時の処理
  } catch (error) {
    // エラー時はMCPにフォールバック
  }
}

// MCP Proxy へフォールバック
const result = await this.makeRequest('notion__API_post_search', {...});
```

## 開発・運用コマンド

### 開発環境起動

```bash
# 設定更新 + Direct API + React 同時起動
npm run dev-direct

# または個別起動
npm run update-proxy  # 設定同期
npm run direct-api    # API サーバー起動
npm start            # React アプリ起動
```

### 設定変更手順

1. `config.json` でポート番号変更
2. `npm run update-proxy` で設定反映
3. サーバー再起動

## セキュリティ

### 認証
- Notion API: Bearer Token認証
- トークン: 環境変数または設定ファイルで管理

### CORS設定
```javascript
app.use(cors());  // 開発環境では全許可
```

### HTTPS通信
- Notion API: 強制HTTPS
- 本番環境: SSL/TLS証明書必須

## エラーハンドリング

### 多層フォールバック
1. Direct API (優先)
2. MCP Proxy (フォールバック)
3. Mock Data (最終フォールバック)

### ログ出力
```javascript
console.log('Direct API search successful, got', result.result.results.length, 'pages');
console.error('Direct API search error:', error);
```

## パフォーマンス最適化

### 接続プール
- Keep-Alive接続
- 接続再利用

### レスポンス処理
- ページングサポート (page_size: 20)
- 部分的データロード
- キャッシュ機能（フロントエンド側）

## 拡張性

### 新しいAPI追加
- `direct-notion-api.js` にエンドポイント追加
- `mcpNotionService.ts` にクライアント機能追加

### 他サービス連携
- 設定ファイルでポート管理
- プロキシ設定の柔軟な変更
- モジュラーな構成

## トラブルシューティング

### よくある問題

1. **ポート競合**
   - `config.json` でポート変更
   - `lsof -i :PORT` でポート使用状況確認

2. **API接続エラー**
   - Notionトークン確認
   - ネットワーク接続確認
   - ヘルスチェックエンドポイント利用

3. **プロキシ設定**
   - `npm run update-proxy` で設定同期
   - package.json の proxy 値確認

### デバッグ情報
```bash
# サーバーログ確認
curl http://localhost:3004/health

# API テスト
curl -X POST http://localhost:3004/api/notion/search \
  -H "Content-Type: application/json" \
  -d '{"query": "", "id": 1}'
```

## 今後の改善予定

- [ ] 環境変数によるトークン管理
- [ ] Docker化
- [ ] CI/CD パイプライン
- [ ] モニタリング・ログ集約
- [ ] API レート制限対応
- [ ] キャッシュシステム実装