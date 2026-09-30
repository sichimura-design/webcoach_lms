/**
 * コースのアナウンスメント（Moodle がコース作成時に自動で置くお知らせフォーラム）の見分け。
 *
 * 🔴 アナウンスメントは教材ではない。これを「開いた教材」「続きのレッスン」として扱うと、
 *    アナウンスメントしか無い空のコースがマイページ「続きから学習」に出たり、
 *    レッスン名の欄に「アナウンスメント」と出たりする。
 *
 * Moodle の目次（core_course_get_contents）はフォーラムの種類（news 等）を返さないので、
 * 「先頭のセクション（セクション0）に置かれたフォーラム」をアナウンスメントとみなす。
 * 目次のセクションはセクション番号順に並んで返る。
 */
export function announcementModuleIds(
  sections: ReadonlyArray<{ modules?: ReadonlyArray<{ id: number; modname?: string }> }>,
): Set<number> {
  return new Set(
    (sections[0]?.modules ?? []).filter((m) => m.modname === 'forum').map((m) => m.id),
  );
}
