/**
 * frontend/src/hooks/useAiApplications.ts
 * 「AIコーチでできること」の一覧を、DB（webcoach_ai_application）だけで組み立てる。
 *
 * 顔ぶれ・表示名・説明・分類・並び順はすべてDBが決める（画面側に既定の文言を持たない）。
 *   ・顔ぶれ …… secret_key（app_key）があり、画面側に対応するスキルがある行
 *   ・表示名 …… display_name（NULLなら name）
 *   ・説明   …… display_description（NULLなら description）
 *   ・分類   …… display_category（NULLなら「そのほか」）
 *   ・並び順 …… sort_order の小さい順（NULLは末尾）。分類の並びも、各分類の最初の行の位置で決まる
 * types/aiSkill.ts に残すのは、アイコン・入力例・モード中の文言など画面の作りだけ（appKey でDBの行と結ぶ）。
 * DBにあっても AI_SKILL_META に対応するスキルが無いアプリは出せない（アイコン等が無いため）。
 * その場合はコンソールに警告を出すので、AI_SKILL_META に1件足すこと。
 *
 * 一覧はページを跨いで共有するので、取得はアプリ全体で1回だけにしている。
 * 管理画面で登録内容を変えた場合は、再読み込みで反映される。
 */
import { useEffect, useMemo, useState } from 'react';
import { bffClient } from '../services/bffClient';
import type { AiApplication } from '../types/aiApplication';
import { AI_SKILL_META, CONCRETE_AI_SKILLS, ConcreteAiSkillId } from '../types/aiSkill';

/** display_category が空の行を束ねる見出し */
export const UNCATEGORIZED_LABEL = 'そのほか';

let pending: Promise<AiApplication[]> | null = null;
let loaded: AiApplication[] | null = null;

const load = (): Promise<AiApplication[]> => {
  if (!pending) {
    pending = bffClient
      .getAIApplications()
      .then((apps) => {
        // 表示用カラム追加前のAPI（app_key を返さない）では、どの行もスキルと結べない。
        // 空の一覧を「登録が0件」と見せないよう、取得失敗として扱う
        if (apps.length > 0 && apps.every((a) => a.app_key === undefined)) {
          throw new Error('ai-applications API does not return app_key');
        }
        loaded = apps;
        warnUnmappedApps(apps);
        return apps;
      })
      .catch((err) => {
        // 失敗を覚えておくと二度と取りに行かなくなるので、次の呼び出しで再試行させる
        pending = null;
        throw err;
      });
  }
  return pending;
};

const skillIdOfAppKey = (appKey: string | null): ConcreteAiSkillId | null =>
  (appKey && CONCRETE_AI_SKILLS.find((id) => AI_SKILL_META[id].appKey === appKey)) || null;

const warnUnmappedApps = (apps: AiApplication[]) => {
  const unmapped = apps.filter((a) => a.app_key && !skillIdOfAppKey(a.app_key));
  if (unmapped.length > 0) {
    console.warn(
      '[useAiApplications] 画面側の定義が無いため一覧に出せないAIアプリがあります。' +
        'types/aiSkill.ts の AI_SKILL_META に appKey を持つスキルを追加してください:',
      unmapped.map((a) => `${a.name} (app_key=${a.app_key})`)
    );
  }
};

/** 読み込み済みのAIアプリ。フックの外（送信処理など）から同期的に参照するため */
export const getLoadedAiApplications = (): AiApplication[] | null => loaded;

/** スキルの裏にあるAIアプリの行。未取得・未登録なら null */
export const findAiApplication = (
  apps: readonly AiApplication[] | null,
  skillId: ConcreteAiSkillId
): AiApplication | null => {
  const key = AI_SKILL_META[skillId].appKey;
  if (!key || !apps) return null;
  return apps.find((a) => a.app_key === key) ?? null;
};

/** 一覧の分類1つ。見出しと、その分類に並ぶスキル（並び順どおり） */
export interface AiSkillGroup {
  label: string;
  skills: ConcreteAiSkillId[];
}

export interface AiSkillCatalog {
  /** 取得中。一覧は空で返す */
  loading: boolean;
  /** 取得に失敗した。一覧は空で返す（画面側に代わりの一覧は持たない） */
  failed: boolean;
  /** 一覧に出すスキル（DBの sort_order 順） */
  listedSkills: ConcreteAiSkillId[];
  /** 分類ごとの一覧（分類の並びも sort_order で決まる） */
  groups: AiSkillGroup[];
  /**
   * 表示名。DBの display_name → name の順。
   * DBに行が無いスキル（教材について質問・読み込み前）だけ AI_SKILL_META の label を使う
   */
  labelOf: (skillId: ConcreteAiSkillId) => string;
  /** 説明文。DBの display_description → description の順（DBに行が無いときは AI_SKILL_META） */
  descriptionOf: (skillId: ConcreteAiSkillId) => string;
}

/** 並び順: sort_order の小さい順、NULLは末尾、同じなら id 順 */
const bySortOrder = (a: AiApplication, b: AiApplication) =>
  (a.sort_order ?? Number.POSITIVE_INFINITY) - (b.sort_order ?? Number.POSITIVE_INFINITY) ||
  a.id - b.id;

export function useAiApplications(): AiSkillCatalog {
  const [apps, setApps] = useState<AiApplication[] | null>(loaded);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (loaded) return undefined;
    let alive = true;
    load()
      .then((a) => {
        if (alive) setApps(a);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return useMemo<AiSkillCatalog>(() => {
    const groups: AiSkillGroup[] = [];
    const listedSkills: ConcreteAiSkillId[] = [];
    for (const app of [...(apps ?? [])].sort(bySortOrder)) {
      const id = skillIdOfAppKey(app.app_key);
      if (!id || listedSkills.includes(id)) continue;
      listedSkills.push(id);
      const label = app.display_category?.trim() || UNCATEGORIZED_LABEL;
      const group = groups.find((g) => g.label === label);
      if (group) group.skills.push(id);
      else groups.push({ label, skills: [id] });
    }
    return {
      loading: !apps && !failed,
      failed: !apps && failed,
      listedSkills,
      groups,
      labelOf: (id) => {
        const app = findAiApplication(apps, id);
        return app ? app.display_name || app.name : AI_SKILL_META[id].label;
      },
      descriptionOf: (id) => {
        const app = findAiApplication(apps, id);
        return app ? app.display_description || app.description : AI_SKILL_META[id].description;
      },
    };
  }, [apps, failed]);
}
