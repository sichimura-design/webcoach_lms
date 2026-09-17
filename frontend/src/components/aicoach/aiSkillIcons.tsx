import type { ComponentType } from 'react';
import {
  BookOpen,
  BookMarked,
  Briefcase,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Mic,
  Sparkles,
  Video,
  type LucideProps,
} from 'lucide-react';
import { AiSkillIconKey } from '../../types/aiSkill';

/**
 * スキルのアイコン。
 *
 * types/aiSkill.ts はアイコンのキーだけを持ち、実体（lucide-react のコンポーネント）は
 * ここで解決する。型定義を描画ライブラリに依存させると、MSWのハンドラ（mocks/）が
 * types 経由で lucide を引き込んでしまうため。
 */
/*
 * 🔴 props は自前で書かず lucide の LucideProps をそのまま使う。
 *    以前は { size, style } だけの最小形にしていたが、strokeWidth のような
 *    lucide 側のプロパティを渡したくなるたびに型を足す必要があり、しかも
 *    ForwardRefExoticComponent とは代入互換にならない（propTypes が食い違う）。
 *    lucide への依存を持たせたくないのは types/aiSkill.ts のほうで、
 *    このファイルは元から lucide を import している。
 */
export const AI_SKILL_ICON: Record<AiSkillIconKey, ComponentType<LucideProps>> = {
  book: BookOpen,
  glossary: BookMarked,
  image: ImageIcon,
  video: Video,
  lightbulb: Lightbulb,
  document: FileText,
  mic: Mic,
  briefcase: Briefcase,
  sparkles: Sparkles,
};

export default AI_SKILL_ICON;
