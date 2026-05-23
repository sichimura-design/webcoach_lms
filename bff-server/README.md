# Moodle SPA BFF Server

このディレクトリは Moodle SPA プロジェクトの BFF（Backend for Frontend）サーバーです。

## 概要

- Express ベースの Node.js サーバー
- Cognito 認証、Moodle API プロキシ、WebCoach などのルートを提供

## 必要条件

- Node.js 18 以上
- 依存関係は `package.json` からインストール

## 起動方法

1. bff-server に移動
   ```powershell
   cd bff-server
   ```
2. 依存関係をインストール
   ```powershell
   npm install
   ```
3. サーバーを起動
   ```powershell
   npm start
   ```

## 補足

- 開発中は `npm run dev` で nodemon を利用できます
