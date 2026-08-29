/**
 * frontend/src/mocks/aiSkillHandlers.ts
 * AIコーチの専門モードのモックAPI。
 *
 *   POST /api/webcoach/ai-skill
 *
 * 実BFFには存在しない。バックエンドは変更禁止のため、ここで「あるべきAPI」を再現する。
 * 本番ではこのエンドポイントが Dify 呼び出しの唯一の境界になる。
 *
 * 設計上の判断:
 *  1. それらしい講評文を返すのではなく、lessonHandlers.ts の searchMaterial() を
 *     そのまま使って教材ブロックを実際に検索し、観点ごとに根拠を付ける。
 *     AIコーチの回答と専門モードの添削が別の教材を根拠にしてしまう事故を防ぐため、
 *     検索は必ず共通の実装を通す。
 *  2. 教材に根拠が見つからない観点は basis を null にし、groundedInMaterial を
 *     false に落とす。「教材基準で添削した」と言いながら教材外の一般論を混ぜないため
 *     （lesson-ai の groundedInMaterial と同じ考え方）。
 *  3. 観点と文言は aiSkillCatalog.ts に寄せ、このファイルには組み立てだけを置く。
 */

import { http, HttpResponse } from 'msw';
import {
  AiSkillFinding,
  AiSkillRequest,
  AiSkillResponse,
  ConcreteAiSkillId,
  SPECIALIST_SKILLS,
} from '../types/aiSkill';
import { LessonAiRequest, LessonAiSource } from '../types/lesson';
import { AI_SKILL_MOCK, SkillAspect } from './aiSkillCatalog';
import { buildLessonDoc, excerpt, searchMaterial, ScoredBlock } from './lessonHandlers';

/**
 * 専門モードのリクエストを searchMaterial が受け取れる形へ変換する。
 * searchMaterial は LessonAiRequest を前提にしているので、ここで橋渡しする。
 */
function toLessonAiRequest(req: AiSkillRequest): LessonAiRequest {
  return {
    courseId: req.courseId ?? 0,
    lessonId: req.lessonId ?? 0,
    blockId: req.blockIds[0] ?? null,
    heading: null,
    selectedText: req.quote,
    contextBefore: null,
    contextAfter: null,
    question: req.question,
    image: req.image,
    history: req.history,
    mode: 'chat',
  };
}

/**
 * 観点ごとに、根拠になりそうな教材ブロックを1つ選ぶ。
 * 観点の terms が教材本文に出てこなければ「教材に根拠なし」として null を返す。
 */
function findBasis(aspect: SkillAspect, hits: ScoredBlock[]): ScoredBlock | null {
  if (aspect.terms.length === 0) return null;
  return (
    hits.find((h) => aspect.terms.some((term) => h.block.plain.includes(term))) ?? null
  );
}

function buildFindings(skillId: ConcreteAiSkillId, hits: ScoredBlock[]): AiSkillFinding[] {
  return AI_SKILL_MOCK[skillId].aspects.map((aspect) => {
    const basisHit = findBasis(aspect, hits);
    return {
      label: aspect.label,
      // 教材に根拠が無い観点で 'critical'（直したい）は出さない。
      // 教材外の判断を強い言葉で断定しないため、'improve' まで落とす。
      verdict:
        !basisHit && aspect.fallbackVerdict === 'critical' ? 'improve' : aspect.fallbackVerdict,
      comment: aspect.comment,
      basis: basisHit
        ? `教材「${basisHit.block.heading}」では、${excerpt(basisHit.block.plain, 110)}と説明されています。`
        : null,
      blockId: basisHit?.block.id ?? null,
    };
  });
}

/**
 * 修正案。入力文をそのまま返さず、教材の観点で並べ替えた体で示す。
 * スキルによって出す形が違う（文章改善は組み替え、コピー作成は案の並列）ので、
 * 書式は aiSkillCatalog.ts の revisionTemplate に寄せ、無い場合だけこの既定形を使う。
 */
function buildRevision(req: AiSkillRequest, topHeading: string | null): string {
  const source = (req.quote ?? req.question).trim();
  const template = AI_SKILL_MOCK[req.skillId].revisionTemplate;
  if (template) return template(source, topHeading);
  const head = source.length > 60 ? `${source.slice(0, 60)}…` : source;
  return [
    `【結論を先に】${head}`,
    '',
    `【根拠】${topHeading ? `「${topHeading}」で学んだ考え方に沿って、` : ''}判断の理由を1文で添えます。`,
    '',
    '【次の行動】読み手にしてほしいことを最後に1つだけ置きます。',
    '',
    '※ この形に沿って書き直した案です。固有名詞と数字はご自身の内容に置き換えてください。',
  ].join('\n');
}

function buildSkillAnswer(req: AiSkillRequest): AiSkillResponse {
  const config = AI_SKILL_MOCK[req.skillId];
  const hits = searchMaterial(toLessonAiRequest(req));
  const doc =
    req.courseId != null && req.lessonId != null
      ? buildLessonDoc(req.courseId, req.lessonId)
      : null;

  const findings = buildFindings(req.skillId, hits);
  const grounded = findings.some((f) => f.basis !== null);

  const sources: LessonAiSource[] = hits.map((h) => ({
    blockId: h.block.id,
    heading: h.block.heading,
  }));

  // 全体講評に出す見出しは、内容を説明しているブロックから選ぶ。
  // スコア最上位をそのまま使うと「まとめ」「次にやること」が入り、
  // 「教材『次にやること』の基準で見ると…」という意味の通らない文になる。
  const topHeading =
    hits.find((h) => h.block.kind !== 'task' && h.block.kind !== 'summary')?.block.heading ??
    doc?.title ??
    null;
  const taskBlock = doc?.blocks.find((b) => b.kind === 'task');

  return {
    skillId: req.skillId,
    summary: config.summaryTemplate(topHeading ?? 'この教材'),
    findings,
    revision: config.producesRevision ? buildRevision(req, topHeading) : null,
    next: taskBlock
      ? excerpt(taskBlock.plain, 120)
      : '直したい観点を1つ選んで、そこだけ手を入れてから、もう一度見せてください。',
    sources,
    groundedInMaterial: grounded,
  };
}

export const aiSkillHandlers = [
  // AIコーチの専門モードの実行。本番ではBFFがDifyアプリへ代理呼び出しする箇所。
  http.post('*/api/webcoach/ai-skill', async ({ request }) => {
    let req: AiSkillRequest | null = null;
    try {
      req = (await request.json()) as AiSkillRequest;
    } catch {
      /* ignore */
    }
    if (!req || typeof req.question !== 'string' || !req.skillId) {
      return new HttpResponse(null, { status: 400 });
    }
    if (!(req.skillId in AI_SKILL_MOCK)) {
      return new HttpResponse(null, { status: 400 });
    }
    // 'learning' は lesson-ai が担うので、専門モードとしては受け付けない。
    if (!(SPECIALIST_SKILLS as string[]).includes(req.skillId)) {
      return new HttpResponse(null, { status: 400 });
    }

    const answer = buildSkillAnswer(req);
    // 実際のLLM呼び出しに近い体感にするため待たせる。
    // 専門モードは「重い処理が走っている」ことが伝わる方が自然なので lesson-ai より長い。
    await new Promise((resolve) => setTimeout(resolve, AI_SKILL_MOCK[req!.skillId].latencyMs));
    return HttpResponse.json(answer);
  }),
];

export default aiSkillHandlers;
