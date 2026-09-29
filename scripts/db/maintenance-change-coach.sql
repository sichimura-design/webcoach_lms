-- 【SEメンテ用】受講生の担当コーチを 旧コーチA → 新コーチB に変更する
--
-- 割り当て(webcoach_student_coach_mapping)と、その受講生の全コーチング回
-- (webcoach_coaching_schedule、実施済み・未実施とも)を B 名義に付け替える。
-- ノート・次回TODO・録画は coaching_schedule_id に紐づくので付け替え不要。
-- 付け替えることで次のようになる:
--   - 回数(coaching_no)は通し番号のまま続く(Aで第5回まで → Bの次回は第6回)
--   - 未実施回のリマインドはBに届く
--   - 過去回のAIノートはBが閲覧・編集でき、Aは見られなくなる
-- ※過去回を実際に担当したのがAだった記録はDBから消える。必要なら作業記録を別に残すこと。
-- ※管理画面のCSVで先に割り当てだけ差し替え済み(A解除+B登録)でも、そのまま流してよい
--   (その場合、割り当てのUPDATEは0件になり、コーチング回の付け替えだけが行われる)。
--
-- 手順: 下の3変数を書き換え → 確認1〜3を見て全部OKなら更新 → 確認4を見てCOMMIT
-- 確認でNGが出たら、更新を流さずにROLLBACKして開発へ相談すること。
-- (確認3を見落としても、回数番号が衝突する場合は更新が Duplicate entry エラーで止まる。その時もROLLBACK)
-- 2026-09-29: MySQL 8.0 の一時コンテナで、直接変更・CSV差し替え後・出戻り(NG)の3パターンを確認済み。dev/uat/prod未適用

SET @student_id   = 0;  -- 受講生のMoodleユーザーID
SET @old_coach_id = 0;  -- 旧コーチAのMoodleユーザーID
SET @new_coach_id = 0;  -- 新コーチBのMoodleユーザーID

START TRANSACTION;

-- ===== 事前確認 =====

-- 確認1: 受講生の有効な割り当て。「Aのみ」または(CSVで差し替え済みなら)「Bのみ」の1行であること
--        AとBの2行が出たら二重割り当て → 先に管理画面のCSVでAを解除(deleteFlag=1)する
SELECT coach_user_id, student_user_id, logical_deleted
  FROM webcoach_student_coach_mapping
 WHERE student_user_id = @student_id AND logical_deleted = 0;

-- 確認2: 付け替え対象のA名義のコーチング回(件数と中身を控えておく)
SELECT id, coaching_no, coaching_date, status
  FROM webcoach_coaching_schedule
 WHERE mdl_user_id = @student_id AND coach_user_id = @old_coach_id
 ORDER BY coaching_no;

-- 確認3: B名義の回が既にあると回数番号が衝突・混在する(以前Bが担当していた出戻り等)
--        → 'OK' 以外なら中止
SELECT IF(COUNT(*) = 0, 'OK', CONCAT('NG: B名義の回が ', COUNT(*), ' 件あります')) AS check_new_coach_schedules
  FROM webcoach_coaching_schedule
 WHERE mdl_user_id = @student_id AND coach_user_id = @new_coach_id;

-- ===== 更新 =====

-- 割り当ての付け替え(CSVで差し替え済みなら0件)
UPDATE webcoach_student_coach_mapping
   SET coach_user_id = @new_coach_id
 WHERE student_user_id = @student_id AND coach_user_id = @old_coach_id AND logical_deleted = 0;

-- コーチング回の付け替え(件数が確認2と一致すること)
UPDATE webcoach_coaching_schedule
   SET coach_user_id = @new_coach_id
 WHERE mdl_user_id = @student_id AND coach_user_id = @old_coach_id;

-- ===== 事後確認 =====

-- 確認4: 有効な割り当てがBの1行だけ、コーチング回が全部B名義で回数が連番になっていること
SELECT coach_user_id, student_user_id, logical_deleted
  FROM webcoach_student_coach_mapping
 WHERE student_user_id = @student_id AND logical_deleted = 0;
SELECT id, coach_user_id, coaching_no, coaching_date, status
  FROM webcoach_coaching_schedule
 WHERE mdl_user_id = @student_id
 ORDER BY coaching_no;

-- 問題なければ COMMIT; おかしければ ROLLBACK;
-- COMMIT;
