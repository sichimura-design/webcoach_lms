import {
  BookOpen,
  BookMarked,
  Briefcase,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  ListChecks,
  Mic,
  PenLine,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { AiSkillIconKey } from '../../types/aiSkill';

/**
 * スキルのアイコン。
 *
 * types/aiSkill.ts はアイコンのキーだけを持ち、実体（lucide-react のコンポーネント）は
 * ここで解決する。型定義を描画ライブラリに依存させると、MSWのハンドラ（mocks/）が
 * types 経由で lucide を引き込んでしまうため。
 */
export const AI_SKILL_ICON: Record<AiSkillIconKey, React.ComponentType<{ size?: number | string }>> = {
  book: BookOpen,
  glossary: BookMarked,
  quiz: ListChecks,
  image: ImageIcon,
  pen: PenLine,
  lightbulb: Lightbulb,
  document: FileText,
  mic: Mic,
  briefcase: Briefcase,
  sparkles: Sparkles,
  wrench: Wrench,
};

export default AI_SKILL_ICON;
