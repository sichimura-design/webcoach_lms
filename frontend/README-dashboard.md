# WEBCOACH

要件定義書（youken.txt）に基づいて作成された学習者向けMoodle進捗ダッシュボードSPAです。

## 概要

Moodleのコース構造（親カテゴリ・カテゴリ・コース・必修/発展）を、学習者が直感的に理解できる外部SPAで可視化します。

## 主な機能

### ✅ 実装済み機能

1. **WEBCOACH学習進捗ダッシュボード**
   - 親カテゴリごとにタブ切替表示（実際のMoodle親カテゴリ名を使用）
   - カテゴリごとにカード表示
   - Udemy風のグリッド／カード形式でコース表示
   - 進捗率をプログレスバーで表示
   - 完了チェックマーク表示

2. **フィルタ・検索機能**
   - コース名検索
   - 必修/発展フィルタ
   - 完了ステータスフィルタ

3. **認証システム**
   - Moodle Webサービス用トークン管理
   - JWT認証対応

4. **UI/UXデザイン**
   - 赤を基調にしたカラーテーマ
   - Material UI使用
   - レスポンシブデザイン

### 🔧 技術仕様

- **フロントエンド**: React + TypeScript + Material UI
- **バックエンド**: Node.js BFF（Backend For Frontend）
- **API**: Moodle REST API
- **認証**: Moodle Webサービストークン

### 📁 ファイル構成

```
frontend/src/
├── components/
│   └── LearningDashboard.tsx    # メインダッシュボードコンポーネント
├── services/
│   ├── dashboardApi.ts          # ダッシュボードAPI
│   ├── bffApi.ts               # BFF（Backend For Frontend）
│   └── api.ts                  # 既存のMoodle API（流用）
├── types/
│   └── dashboard.ts            # ダッシュボード用型定義
└── theme.ts                    # 赤ベースのテーマ（更新）
```

### 🚀 起動方法

1. **開発モード（ダッシュボード）**:
   ```bash
   npm run dev-dashboard
   ```

2. **個別起動**:
   ```bash
   # BFFサーバー起動
   npm run bff-server

   # フロントエンド起動
   npm start
   ```

### 📊 データ構造

#### 取得データ
- **親カテゴリ**: Moodleの親カテゴリ（parent=0のカテゴリ）
- **カテゴリ**: Moodleカテゴリ
- **コース種別**: カスタムフィールド（必修/発展）
- **進捗率**: `core_completion_get_course_completion_status` API

#### 主要エンドポイント
- `core_course_get_categories` - カテゴリ取得
- `core_course_get_courses` - コース取得
- `core_completion_get_course_completion_status` - 進捗取得

### 🔄 既存機能との関係

#### 流用した機能
- ✅ 認証システム（LoginPage, auth types）
- ✅ API通信基盤（api.ts）
- ✅ エラーハンドリング（ErrorBoundary）
- ✅ テーマシステム（赤系統に変更）

#### 保持した将来使える機能
- 📋 Notion統合機能（NotionImportSelector等）
- 📋 コンテンツ作成機能（ModernContentCreator等）
- 📋 MCP（Model Context Protocol）サーバー機能

### 🎨 デザイン仕様

- **プライマリカラー**: `#d32f2f` (赤)
- **セカンダリカラー**: `#ff5722` (オレンジ赤)
- **プログレスバー**: 進捗に応じた色分け
  - 100%: 緑（success）
  - 70%以上: オレンジ（warning）
  - 30%以上: 青（info）
  - 30%未満: 赤（error）

### 🔧 カスタマイズポイント

1. **親カテゴリ取得ロジック** (`dashboardApi.ts:getParentCategoryName`)
   - Moodleの親カテゴリ（parent=0）を取得
   - 再帰的に親カテゴリを探索

2. **コース種別判定** (`dashboardApi.ts:extractCourseType`)
   - コースカスタムフィールド`course_type`
   - コース名からのキーワード判定

3. **進捗計算** (`dashboardApi.ts:getCourseCompletion`)
   - Moodle completion API使用
   - フォールバック処理対応

### 🛡️ セキュリティ

- HTTPS必須
- トークンをBFF側で安全に管理
- CORS設定
- 認証エラーハンドリング

### 📈 今後の拡張予定

- [ ] 学習者向けレコメンド機能
- [ ] 学習時間・習熟度可視化
- [ ] 未完了必修コース通知機能
- [ ] Notion統合によるコンテンツ管理
- [ ] レポート・分析機能