# SPA コードレビュー

> 対象: `frontend/src/` + `bff-server/index.js`
> 実施日: 2026-02-21

---

## 総評

フロントエンドとBFFサーバーの包括的なコードレビューを実施。**セキュリティ上の重大な問題**（Cognito認証情報の平文埋め込み、エラー情報の過剰露出）、認証フローの矛盾（セッション認証とJWT認証の混在）、エラーハンドリングの不備、型安全性の不足、パフォーマンス上の懸念点が検出されました。特にセキュリティとエラーハンドリングの改善が急務です。

---

## 重大度の凡例

| 重大度 | 説明 |
|--------|------|
| 🔴 Critical | 本番運用前に必ず対応が必要 |
| 🟠 High | できるだけ早期に対応が必要 |
| 🟡 Medium | 品質・保守性の向上のため対応を推奨 |
| 🟢 Low | 余裕があれば対応 |

---

## 1. セキュリティ 🔴 Critical

### 1-1. Cognito認証情報がソースコードに平文で埋め込まれている

**ファイル:** `frontend/src/services/cognitoAuth.ts` L8-9

**問題:**
`USER_POOL_ID` と `CLIENT_ID` がハードコードされています。デフォルト値として実在するCognito User Poolの認証情報が埋め込まれており、GitHubなどに公開された場合に第三者に悪用されるリスクがあります。

**改善案:**
```typescript
const COGNITO_USER_POOL_ID = process.env.REACT_APP_COGNITO_USER_POOL_ID;
const COGNITO_CLIENT_ID = process.env.REACT_APP_COGNITO_CLIENT_ID;

if (!COGNITO_USER_POOL_ID || !COGNITO_CLIENT_ID) {
  throw new Error('Cognito credentials not configured');
}
```

---

### 1-2. BFF: serviceAccountTokenがグローバル変数で管理されている

**ファイル:** `bff-server/index.js` L29-30

**問題:**
`serviceAccountToken` がモジュールレベルのグローバル変数で管理されています。トークン更新中にリクエストが来た場合、古いトークンが使用される可能性があります。

**改善案:**
```javascript
let serviceAccountToken = null;
let tokenRefreshPromise = null;

async function getServiceAccountToken() {
  if (tokenRefreshPromise) return tokenRefreshPromise;

  tokenRefreshPromise = (async () => {
    try {
      const response = await axios.post(/* ... */);
      serviceAccountToken = response.data.token;
      return serviceAccountToken;
    } finally {
      tokenRefreshPromise = null;
    }
  })();

  return tokenRefreshPromise;
}
```

---

### 1-3. BFF: requireOwnershipミドルウェアのパラメータ検証が不十分

**ファイル:** `bff-server/index.js` L218-245

**問題:**
`parseInt(requestedUserId)` がNaNを返す場合の処理が不十分で、攻撃者が文字列を送信することでチェックをbypassできる可能性があります。

**改善案:**
```javascript
const requireOwnership = (req, res, next) => {
  const requestedUserId = req.params.userid || req.body.userid || req.query.userid;
  if (requestedUserId) {
    const requestedUserIdInt = parseInt(requestedUserId, 10);
    if (isNaN(requestedUserIdInt)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    if (requestedUserIdInt !== req.session.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  next();
};
```

---

### 1-4. BFF: 画像プロキシでトークンがURLに含まれている

**ファイル:** `bff-server/index.js` L1220-1226

**問題:**
Moodle画像取得時にトークンがクエリパラメータとして追加されています。ブラウザのキャッシュやRefererヘッダーを通じて第三者に漏洩する可能性があります。

**改善案:**
```javascript
const response = await axios.get(imageUrl, {
  responseType: 'arraybuffer',
  timeout: 30000,
  headers: {
    'Authorization': `Bearer ${serviceAccountToken}`
  }
});
```

---

### 1-5. BFF: SESSION_SECRETのデフォルト値チェックが不完全

**ファイル:** `bff-server/index.js` L51-55

**問題:**
`NODE_ENV` が正しく設定されていない場合、本番環境でもデフォルト値のまま起動できてしまいます。

**改善案:**
```javascript
if (process.env.SESSION_SECRET === 'change-me-in-production') {
  throw new Error('SESSION_SECRET must be explicitly configured');
}
```

---

### 1-6. BFF: ヘルスチェックエンドポイントが情報を過剰公開している

**ファイル:** `bff-server/index.js` L301-349

**問題:**
`GET /health` が `serviceAccountToken` の有無などサーバー内部情報を返しており、攻撃者が探索に利用できます。

**改善案:**
```javascript
// ロードバランサー用（詳細なし）
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 詳細版は認証必須
app.get('/api/health', requireAuth, (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

---

## 2. パフォーマンス 🟠 High

### 2-1. AppHeader: チャットメッセージが無制限に蓄積される

**ファイル:** `frontend/src/components/shared/AppHeader.tsx` L30-38

**問題:**
`messages` ステートが蓄積され続け、長時間の使用でメモリリークやUIの遅延につながります。

**改善案:**
```typescript
const MAX_MESSAGES = 50;

setMessages((prev) => {
  const updated = [...prev, userMessage];
  return updated.slice(-MAX_MESSAGES); // 最新50件のみ保持
});
```

---

### 2-2. CoursesPage: 検索フィールドが未実装のまま残っている

**ファイル:** `frontend/src/components/CoursesPage.tsx` L71-150

**問題:**
`searchQuery` state が定義・更新されていますが、その値を使った処理がまったく実装されていません（デッドコード）。

**改善案:**
```typescript
// デバウンス付き検索
useEffect(() => {
  if (!searchQuery.trim()) return;
  const timer = setTimeout(() => {
    bffClient.searchCourses(searchQuery).then(setSearchResults);
  }, 300);
  return () => clearTimeout(timer);
}, [searchQuery]);
```

---

### 2-3. BFF: 大量のデバッグログが本番環境でも出力される

**ファイル:** `bff-server/index.js` L86-157

**問題:**
`console.log` が至る所に散在しており、特にヘルスチェックのたびにセッション詳細がログ出力されます。本番環境では性能低下とストレージ消費につながります。

**改善案:**
```javascript
const logger = {
  debug: process.env.NODE_ENV === 'development' ? console.log : () => {},
  info: console.log,
  warn: console.warn,
  error: console.error
};
```

---

### 2-4. BFF: コース進捗計算が1件ずつMoodle APIを呼ぶ

**ファイル:** `bff-server/index.js` L534-543

**問題:**
`Promise.all` で並列実行していますが、登録コースが多い場合にMoodle APIへのリクエスト数が急増し、レート制限に引っかかる可能性があります。

**改善案:**
進捗情報はMoodleから一括取得するAPIに変更するか、キャッシュ機能を実装することを検討してください。

---

## 3. 型安全性 🟠 High

### 3-1. bffClient全体でanyを多用している

**ファイル:** `frontend/src/services/bffClient.ts` L95, 105, 124, 145など

**問題:**
`getCourses()`, `getUserCourses()`, `getCourseContent()` などの戻り値が `any[]` や `any` で定義されており、型の恩恵が得られていません。

**改善案:**
```typescript
export interface Course {
  id: number;
  fullname: string;
  shortname: string;
  categoryid: number;
  summary?: string;
  tags?: Array<{ id: number; name: string; rawname: string }>;
  customfields?: Array<{ shortname: string; value: string; name?: string }>;
}

async getCourses(): Promise<Course[]> {
  const response = await this.api.get('/moodle/courses');
  return response.data;
}
```

---

### 3-2. CognitoAuthResultの型定義が実態と合っていない

**ファイル:** `frontend/src/services/cognitoAuth.ts` L16-23

**問題:**
`email`, `sub` を必須フィールドとして定義しているが、JWTペイロードにない場合に空文字を入れており、型が実態を正確に表していません。

**改善案:**
```typescript
export interface CognitoAuthResult {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  email: string | null;
  sub: string | null;
  username: string;
}
```

---

## 4. エラーハンドリング 🟠 High

### 4-1. LoginPage: 詳細なエラーメッセージがユーザー存在有無を漏洩している

**ファイル:** `frontend/src/components/LoginPage.tsx` L26-36

**問題:**
エラーコードによって「このメールアドレスは登録されていません」などの詳細メッセージが表示されており、攻撃者がユーザー存在確認に利用できます。

**改善案:**
```typescript
} catch (err: any) {
  // 詳細を隠して汎用メッセージを使用
  setError('メールアドレスまたはパスワードが正しくありません');
  console.error('[DEBUG] Login error:', err.code, err.message);
}
```

---

### 4-2. AppHeader: AIチャットエラーがバックエンド情報を露出している

**ファイル:** `frontend/src/components/shared/AppHeader.tsx` L93-101

**問題:**
`error.message` をそのままチャットメッセージに表示しており、内部システム情報が漏洩する可能性があります。

**改善案:**
```typescript
} catch (error: any) {
  console.error('AI response error:', error);
  setMessages((prev) => [...prev, {
    id: Date.now().toString(),
    role: 'assistant',
    content: 'すみません、回答の取得に失敗しました。もう一度お試しください。',
    timestamp: new Date(),
  }]);
}
```

---

### 4-3. BFF: 内部エラーの詳細がAPIレスポンスに含まれている

**ファイル:** `bff-server/index.js` 多数のルートハンドラー

**問題:**
`error.message` や `error.response.data` をそのまま返しており、スタックトレースや内部パスが露出する可能性があります。

**改善案:**
```javascript
} catch (error) {
  console.error('[Route] Error:', error.message);
  if (!error.response) {
    return res.status(500).json({ error: 'Internal server error' });
  }
  res.status(error.response.status).json({
    error: error.response.data?.error || 'Request failed'
  });
}
```

---

### 4-4. BFF: session.saveエラー後にレスポンスが二重送信される可能性

**ファイル:** `bff-server/index.js` L435-451

**問題:**
ヘッダー送信後に `session.save` のエラーコールバックが実行された場合、`res.status(500)` が呼ばれて `ERR_HTTP_HEADERS_SENT` エラーになります。

**改善案:**
```javascript
req.session.save((err) => {
  if (err) {
    console.error('Session save error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to save session' });
    }
    return;
  }
  res.json({ success: true, username, userId: userInfo.id });
});
```

---

## 5. コード品質 🟡 Medium

### 5-1. CoursesPage: searchQueryが宣言されているが検索処理が未実装

**ファイル:** `frontend/src/components/CoursesPage.tsx` L71

**問題:**
`const [searchQuery, setSearchQuery] = useState('')` が定義され入力値も更新されていますが、実際の検索APIの呼び出しが一切ありません。UIと機能が乖離しています。

---

### 5-2. getCognitoErrorMessage関数がLoginPageとPasswordResetPageで重複している

**ファイル:** `frontend/src/components/LoginPage.tsx`, `frontend/src/components/PasswordResetPage.tsx`

**問題:**
同じエラーメッセージ変換ロジックが2ファイルに重複しています。

**改善案:**
```typescript
// utils/cognitoErrors.ts に共通化
export const getCognitoErrorMessage = (err: any): string => {
  const errorMap: Record<string, string> = {
    'UserNotFoundException': 'このメールアドレスは登録されていません。',
    'LimitExceededException': 'リクエスト回数の上限に達しました。',
    'CodeMismatchException': '認証コードが正しくありません。',
  };
  return errorMap[err?.code || err?.name] ?? err?.message ?? 'エラーが発生しました。';
};
```

---

### 5-3. BFF: 1ファイルに全ルートが集中している（1,400行超）

**ファイル:** `bff-server/index.js`

**問題:**
すべてのルートハンドラーが1ファイルに記述されており、保守性が著しく低下しています。

**改善案:**
```
bff-server/
├── index.js         # サーバー初期化のみ
├── middleware/
│   ├── auth.js      # requireAuth, requireOwnership
│   └── logging.js   # リクエストログ
└── routes/
    ├── auth.js      # /api/login, /api/logout
    ├── moodle.js    # /api/moodle/*
    └── webcoach.js  # /api/webcoach/*
```

---

### 5-4. AppHeader: ヘッダーUIとAIチャット機能が混在している

**ファイル:** `frontend/src/components/shared/AppHeader.tsx` L25-374

**問題:**
単一コンポーネントにナビゲーション表示・アバター表示・AIチャット機能が詰め込まれており、単一責任原則に違反しています。

**改善案:**
```typescript
// components/AIChat.tsx に分離
function AIChat({ onClose }: { onClose: () => void }) { /* ... */ }

// AppHeader はUIのみ担当
export function AppHeader({ userName }: AppHeaderProps) {
  const [chatOpen, setChatOpen] = useState(false);
  return (
    <>
      {/* ヘッダーUI */}
      {chatOpen && <AIChat onClose={() => setChatOpen(false)} />}
    </>
  );
}
```

---

## 6. アーキテクチャ 🟡 Medium

### 6-1. AuthContextとauthStoreが重複している

**ファイル:** `frontend/src/contexts/AuthContext.tsx`, `frontend/src/store/authStore.ts`

**問題:**
認証状態が `AuthContext` と `useAuthStore` の2箇所で管理されており、どちらを使うべきか不明確です。

**改善案:**
`AuthContext` に統一し、`authStore.ts` は削除してください。

---

### 6-2. セッション認証とCognito JWT認証が混在している

**ファイル:** `bff-server/index.js`, `frontend/src/services/bffClient.ts`

**問題:**
- フロントエンドはCognito JWTを `Authorization: Bearer` ヘッダーで送信
- BFFは `express-session` によるセッション認証を使用
- BFFはJWTを検証していない（コメントに「BFF JWT対応後に実値になる」と記述あり）

現状、JWTの送信は無意味であり、設計の一貫性がありません。

**改善案:**
認証戦略をどちらかに統一してください。Cognito JWTに統一する場合は、BFFで `jsonwebtoken` を使ってJWT検証を実装し、セッション管理を廃止する必要があります。

---

### 6-3. API_SERVER_URLの `/api/tags/:categoryid` が未実装

**ファイル:** `bff-server/index.js` L1141-1166, `api-server/` 全体

**問題:**
BFFは `API_SERVER_URL/api/tags/{categoryid}` にプロキシしていますが、APIサーバー（FastAPI）にこのエンドポイントが存在しません。`CategoryDetailPage` からの呼び出しは常に失敗します。

**改善案:**
APIサーバーに `/api/tags/{categoryid}` エンドポイントを実装するか、BFFのルートを削除してください。

---

## 7. アクセシビリティ 🟢 Low

### 7-1. ローディングスピナーにARIA属性が未設定

**ファイル:** `frontend/src/components/ProfilePage.tsx`, `frontend/src/components/CategoryDetailPage.tsx` など

**改善案:**
```tsx
<div role="status" aria-live="polite">
  <Loader2 className="animate-spin" aria-label="読み込み中" />
</div>
```

---

### 7-2. AppHeader: Escキーでチャットを閉じる機能がない

**ファイル:** `frontend/src/components/shared/AppHeader.tsx` L107-112

**改善案:**
```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Escape') setChatOpen(false);
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
};
```

---

### 7-3. インタラクティブ要素のfocus管理が不十分

**ファイル:** `frontend/src/components/shared/AppHeader.tsx`, モーダル系コンポーネント

**問題:**
チャットパネルの開閉時にフォーカスが適切に移動しておらず、スクリーンリーダーユーザーが操作しにくい状態です。

---

## 優先対応リスト

| 優先度 | 項目 | 対応コスト |
|--------|------|-----------|
| 🔴 1 | Cognito認証情報のハードコード削除 | 小 |
| 🔴 2 | エラーメッセージからの内部情報漏洩防止 | 小 |
| 🔴 3 | requireOwnershipのNaN処理 | 小 |
| 🟠 4 | AuthContext/authStoreの統一 | 中 |
| 🟠 5 | セッション認証とJWT認証の統一方針決定 | 大 |
| 🟠 6 | bffClientの型定義整備 | 中 |
| 🟠 7 | BFFデバッグログの制御 | 小 |
| 🟡 8 | BFFルートのファイル分割 | 中 |
| 🟡 9 | CoursesPage検索機能の実装 | 中 |
| 🟡 10 | AppHeaderのAIチャット分離 | 中 |
| 🟡 11 | `/api/tags/:categoryid` エンドポイントの実装 | 大 |
