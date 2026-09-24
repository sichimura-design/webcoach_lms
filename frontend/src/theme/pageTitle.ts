/**
 * ページ見出し（h1）の唯一の定義。
 * --dc-fs-display（clamp(28px, 1.68vw, 32px)）/ 700 / --dc-lh-heading。
 *
 * かつてこの値はどこにも定義されておらず、各ページが h1 のインライン style に
 * 手写ししていた。結果 20px（マイページ）/ 22px（マイノート）/ 28px 生px（コーチング）/
 * 28〜32px（学習する・学習の記録）と4通りに散り、画面を移ると見出しの階層が
 * 読めなくなっていた。新しいページを足すときも、ここを spread すること。
 *
 * 🔴 color を持たない。--dc-fs-* は :root にあるが、--dc-text などの色トークンは
 *    :root ではなく .mypage-3d / .wc-warm の opt-in スコープにある（index.css の
 *    「:root ではなく opt-in のクラスに載せている」コメント参照）。コーチング
 *    （CoachingPage は .wc-page しか持たない）はそのスコープの外なので、ここに
 *    color: var(--dc-text) を入れると未定義に落ちて黒になる。色は各ページが持つ。
 *
 * 🔴 components/profile/settingsStyles.ts の dcPageTitle（27px/800）は別系統の
 *    旧定義（アカウント設定・プロフィール）。名前が似ているが混ぜない。
 */
import React from 'react';

export const pageTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--dc-fs-display)',
  lineHeight: 'var(--dc-lh-heading)',
  fontWeight: 700,
  letterSpacing: '-0.01em',
};
