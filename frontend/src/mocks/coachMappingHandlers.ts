/**
 * 管理画面「コーチ割り当て」用のモック（実BFFにはあるが MSW には無かったので足した）。
 *   GET  /api/admin/users/by-role/:role   … コーチ一覧（Cognito）
 *   GET  /api/coaching/mappings           … 割り当て一覧
 *   POST /api/coaching/mappings           … 1件登録
 *   POST /api/coaching/manage-mappings    … 解除 → 復元 → 登録の順に一括処理（CSV・画面の解除ボタン）
 *
 * 🔴 実BFF・api-server と同じ決まりを真似る：受講生1人にコーチ1人（528118a）。
 *    別のコーチが付いている受講生への登録は 409 の
 *    「Student already has an active coach (coach=N)」で返す（utils/coachMappingCsv.ts が日本語にする）。
 * 受講生の ID は handlers.ts の studentsStore（501〜505）に合わせる。
 */
import { http, HttpResponse } from 'msw';

interface Mapping {
  coach_user_id: number;
  student_user_id: number;
  logical_deleted: number;
  created_at: string;
  updated_at: string;
}

const COACHES = [
  { userId: 'coach-1', username: 'coach_kimura', email: 'kimura@example.com', status: 'CONFIRMED', enabled: true, createdAt: '2026-09-01T00:00:00Z', lastModified: '2026-09-01T00:00:00Z', moodleUserId: 32 },
  { userId: 'coach-2', username: 'coach_hayashi', email: 'hayashi@example.com', status: 'CONFIRMED', enabled: true, createdAt: '2026-09-01T00:00:00Z', lastModified: '2026-09-01T00:00:00Z', moodleUserId: 40 },
];

const stamp = '2026-09-20T00:00:00Z';
const mappings: Mapping[] = [
  { coach_user_id: 32, student_user_id: 501, logical_deleted: 0, created_at: stamp, updated_at: stamp },
  { coach_user_id: 32, student_user_id: 502, logical_deleted: 0, created_at: stamp, updated_at: stamp },
  { coach_user_id: 40, student_user_id: 503, logical_deleted: 0, created_at: stamp, updated_at: stamp },
];

const activeOf = (studentId: number) => mappings.find((m) => m.student_user_id === studentId && !m.logical_deleted);
const find = (coachId: number, studentId: number) =>
  mappings.find((m) => m.coach_user_id === coachId && m.student_user_id === studentId);

type Op = { coach_user_id: number; student_user_id: number; updateFlag: boolean; deleteFlag: boolean };

export const coachMappingHandlers = [
  http.get('*/api/admin/users/by-role/:role', ({ params }) =>
    HttpResponse.json({ role: params.role, count: COACHES.length, users: params.role === 'coach' ? COACHES : [] })
  ),

  http.get('*/api/coaching/mappings', ({ request }) => {
    const includeDeleted = new URL(request.url).searchParams.get('include_deleted') === 'true';
    return HttpResponse.json(includeDeleted ? mappings : mappings.filter((m) => !m.logical_deleted));
  }),

  http.post('*/api/coaching/mappings', async ({ request }) => {
    const { coach_user_id, student_user_id } = (await request.json()) as { coach_user_id: number; student_user_id: number };
    const active = activeOf(student_user_id);
    if (active && active.coach_user_id !== coach_user_id) {
      return HttpResponse.json({ detail: `Student already has an active coach (coach=${active.coach_user_id})` }, { status: 409 });
    }
    if (active) return HttpResponse.json({ detail: 'Mapping already exists' }, { status: 409 });
    const now = new Date().toISOString();
    const existing = find(coach_user_id, student_user_id);
    if (existing) Object.assign(existing, { logical_deleted: 0, updated_at: now });
    else mappings.push({ coach_user_id, student_user_id, logical_deleted: 0, created_at: now, updated_at: now });
    return HttpResponse.json({ success: true });
  }),

  http.post('*/api/coaching/manage-mappings', async ({ request }) => {
    const { mappings: ops } = (await request.json()) as { mappings: Op[] };
    const result = { created: 0, updated: 0, deleted: 0, errors: [] as Array<{ operation: string; coach_user_id: number; student_user_id: number; message: string }> };
    const now = new Date().toISOString();
    const err = (operation: string, o: Op, message: string) =>
      result.errors.push({ operation, coach_user_id: o.coach_user_id, student_user_id: o.student_user_id, message });
    // 実装と同じく 解除 → 復元 → 登録 の順
    for (const o of ops.filter((x) => x.deleteFlag)) {
      const m = find(o.coach_user_id, o.student_user_id);
      if (!m || m.logical_deleted) err('delete', o, 'Mapping not found');
      else { m.logical_deleted = 1; m.updated_at = now; result.deleted += 1; }
    }
    for (const o of ops.filter((x) => x.updateFlag)) {
      const m = find(o.coach_user_id, o.student_user_id);
      const active = activeOf(o.student_user_id);
      if (!m || !m.logical_deleted) err('update', o, 'Mapping not found');
      else if (active) err('update', o, `Student already has an active coach (coach=${active.coach_user_id})`);
      else { m.logical_deleted = 0; m.updated_at = now; result.updated += 1; }
    }
    for (const o of ops.filter((x) => !x.deleteFlag && !x.updateFlag)) {
      const active = activeOf(o.student_user_id);
      if (active) err('create', o, active.coach_user_id === o.coach_user_id ? 'Mapping already exists' : `Student already has an active coach (coach=${active.coach_user_id})`);
      else { mappings.push({ coach_user_id: o.coach_user_id, student_user_id: o.student_user_id, logical_deleted: 0, created_at: now, updated_at: now }); result.created += 1; }
    }
    return HttpResponse.json(result);
  }),
];
