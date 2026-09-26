/**
 * frontend/src/hooks/useAiApplications.ts
 * 「AIコーチでできること」に何を出すかを、DB（webcoach_ai_application）から決める。
 *
 * 以前は types/aiSkill.ts の直書きだけで一覧を作っていたため、DBに登録されている
 * 実際のAIアプリ（Dify）と、名前・顔ぶれ・分類がずれていた。いまは役割を分けている:
 *   ・DB …… 出すかどうか（行があるか）、表示名、説明文
 *   ・types/aiSkill.ts …… アイコン・分類・並び順・入力例などの画面の作り（appKey でDBの行と結ぶ）
 * DBにあっても AI_SKILL_META に対応するスキルが無いアプリは出せない（アイコン等が無いため）。
 * その場合はコンソールに警告を出すので、AI_SKILL_META に1件足すこと。
 *
 * 一覧はページを跨いで共有するので、取得はアプリ全体で1回だけにしている。
 * 管理画面で登録内容を変えた場合は、再読み込みで反映される。
 */
import { useEffect, useMemo, useState } from 'react';
import { bffClient } from '../services/bffClient';
import type { AiApplication } from '../types/aiApplication';
import {
  AI_SKILL_META,
  APP_BACKED_AI_SKILLS,
  BUILTIN_AI_SKILLS,
  CONCRETE_AI_SKILLS,
  ConcreteAiSkillId,
} from '../types/aiSkill';

let pending: Promise<AiApplication[]> | null = null;
let loaded: AiApplication[] | null = null;

const load = (): Promise<AiApplication[]> => {
  if (!pending) {
    pending = bffClient
      .getAIApplications()
      .then((apps) => {
        // 表示用カラム追加前のAPI（app_key を返さない）では、どの行もスキルと結べず一覧が
        // 「教材について質問」だけになる。取得失敗と同じ扱いにして既定の一覧を出す
        // （フロントだけ先にデプロイされたときの保険）
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

const warnUnmappedApps = (apps: AiApplication[]) => {
  const known = new Set(APP_BACKED_AI_SKILLS.map((id) => AI_SKILL_META[id].appKey));
  const unmapped = apps.filter((a) => a.app_key && !known.has(a.app_key));
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

export interface AiSkillCatalog {
  /** 取得中。一覧は空で返す（既定の文言を一瞬出してから差し替わるのを避ける） */
  loading: boolean;
  /**
   * 一覧に出すスキル（AI_SKILL_META の宣言順）＝組み込みの機能（BUILTIN_AI_SKILLS）＋DBに行があるAIアプリ。
   * 取得に失敗したときは、appKey を持つスキルをすべて出す（一覧が消えて何も使えなくなるよりよい）。
   */
  listedSkills: ConcreteAiSkillId[];
  /** 表示名。DBの display_name → AI_SKILL_META の label の順 */
  labelOf: (skillId: ConcreteAiSkillId) => string;
  /** 説明文。DBの display_description → AI_SKILL_META の description の順 */
  descriptionOf: (skillId: ConcreteAiSkillId) => string;
}

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
    const backed = failed
      ? APP_BACKED_AI_SKILLS
      : apps
        ? APP_BACKED_AI_SKILLS.filter((id) => findAiApplication(apps, id) !== null)
        : [];
    // 宣言順を保つため、CONCRETE_AI_SKILLS から拾い直す。取得中は組み込みの機能も出さない
    const listedSkills =
      apps || failed
        ? CONCRETE_AI_SKILLS.filter((id) => BUILTIN_AI_SKILLS.includes(id) || backed.includes(id))
        : [];
    return {
      loading: !apps && !failed,
      listedSkills,
      labelOf: (id) => findAiApplication(apps, id)?.display_name || AI_SKILL_META[id].label,
      descriptionOf: (id) =>
        findAiApplication(apps, id)?.display_description || AI_SKILL_META[id].description,
    };
  }, [apps, failed]);
}
