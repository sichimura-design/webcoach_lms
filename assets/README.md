# assets

教材とサムネイルの原本を保管するフォルダ。アプリのビルド・配信には含まれない。

```
assets/
├── materials/    教材の原本（コースごとにフォルダを切る: materials/<コースslug>/）
└── thumbnails/   コースサムネイルの原本（ファイル名はコースslug: thumbnails/<コースslug>.png）
```

- コースslug は `frontend/src/constants/courseTaxonomy.ts` のもの。
- アプリで表示するには、配信用に書き出したものを別途配置する。
  - 教材: `frontend/public/materials/<コースslug>/`
  - サムネ: `frontend/public/images/courses/` に置き、`frontend/src/mocks/courseThumbnails.ts` に登録
