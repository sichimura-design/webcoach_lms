import { mappingConflictMessage, parseCoachMappingCsv, toUploadResult } from './coachMappingCsv';

describe('parseCoachMappingCsv', () => {
  it('フラグを読み取り、BOMと空行を無視する', () => {
    const rows = parseCoachMappingCsv(
      '﻿coach_user_id,student_user_id,updateFlag,deleteFlag\n5,10,0,0\n\n6,12,0,1\n7,13,1,\n'
    );
    expect(rows).toEqual([
      { coach_user_id: 5, student_user_id: 10, updateFlag: false, deleteFlag: false, row: 2 },
      { coach_user_id: 6, student_user_id: 12, updateFlag: false, deleteFlag: true, row: 4 },
      { coach_user_id: 7, student_user_id: 13, updateFlag: true, deleteFlag: false, row: 5 },
    ]);
  });

  it('フラグ列が無くても読める', () => {
    expect(parseCoachMappingCsv('coach_user_id,student_user_id\n5,10')).toEqual([
      { coach_user_id: 5, student_user_id: 10, updateFlag: false, deleteFlag: false, row: 2 },
    ]);
  });

  it('両方のフラグが1ならエラー', () => {
    expect(() => parseCoachMappingCsv('coach_user_id,student_user_id,updateFlag,deleteFlag\n5,10,1,1'))
      .toThrow('行 2');
  });

  it('IDが数値でなければエラー', () => {
    expect(() => parseCoachMappingCsv('coach_user_id,student_user_id\nabc,10')).toThrow('行 2');
  });
});

describe('toUploadResult', () => {
  const rows = parseCoachMappingCsv(
    'coach_user_id,student_user_id,updateFlag,deleteFlag\n5,10,0,0\n6,12,0,1\n7,13,1,0'
  );

  it('操作ごとの件数を出す', () => {
    const result = toUploadResult(rows, { created: 1, updated: 1, deleted: 1, errors: [] });
    expect(result.success).toBe(true);
    expect(result.recordsProcessed).toBe(3);
    expect(result.message).toBe('登録 1件 / 復元 1件 / 解除 1件 / 失敗 0件');
  });

  it('BFFのエラーをCSVの行番号に戻す', () => {
    const result = toUploadResult(rows, {
      created: 1, updated: 1, deleted: 0,
      errors: [{ operation: 'delete', coach_user_id: 6, student_user_id: 12, message: 'Active mapping not found' }],
    });
    expect(result.success).toBe(false);
    expect(result.recordsFailed).toBe(1);
    expect(result.errors).toEqual([{ row: 3, message: '解除: 有効な割り当てが見つかりません' }]);
  });
});

describe('mappingConflictMessage', () => {
  it('受講生に別コーチがいる場合', () => {
    expect(mappingConflictMessage('Student already has an active coach: student=12, coach=5'))
      .toBe('この受講生には既に別のコーチ（ID: 5）が割り当てられています。先に解除してください');
  });

  it('同じ組み合わせが有効な場合', () => {
    expect(mappingConflictMessage('Active mapping already exists: coach=5, student=12'))
      .toBe('既に有効な割り当てがあります');
  });

  it('CSVの登録行でも使われる', () => {
    const rows = parseCoachMappingCsv('coach_user_id,student_user_id\n6,12');
    const result = toUploadResult(rows, {
      created: 0, updated: 0, deleted: 0,
      errors: [{ operation: 'create', coach_user_id: 6, student_user_id: 12, message: 'Student already has an active coach: student=12, coach=5' }],
    });
    expect(result.errors).toEqual([{ row: 2, message: '登録: この受講生には既に別のコーチ（ID: 5）が割り当てられています。先に解除してください' }]);
  });
});
