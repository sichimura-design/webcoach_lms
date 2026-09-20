# 使わないアートボード

ここにあるものは**原本ではない**。canvas.json からも外してある。流用しないこと。

| ファイル | なぜ使わないか |
|---|---|
| `Notes.dc.html` | `/notes` を左フォルダ列（248px）の形で写したもの。2026-09-08 にフォルダ列は廃止され、一覧上部の `NoteFolderBar` に一本化された（`components/notes/NoteFolderBar.tsx`）。レイアウトが現行実装と別物 |
| `NotesImproved.dc.html` | 上の元になった「改善案」。同じく左フォルダ列の形 |

どちらも実装に存在しないトークン名（`--dc-primary-deep` / `--dc-ok`）を自前で定義しており、
色の正解としても当てにならない。`/notes` の現行アートボードは `design-canvas/notes/` にある。
