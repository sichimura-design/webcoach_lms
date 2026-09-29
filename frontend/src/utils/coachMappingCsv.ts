/**
 * コーチ割り当てCSV(coach_user_id,student_user_id,updateFlag,deleteFlag)の読み込みと、
 * BFF POST /coaching/manage-mappings の結果を画面表示用に詰め替えるヘルパー。
 */
import type { UploadResult } from '../types/admin';

export interface CoachMappingCsvRow {
  coach_user_id: number;
  student_user_id: number;
  updateFlag: boolean;
  deleteFlag: boolean;
  /** CSV上の行番号(ヘッダーが1行目) */
  row: number;
}

export interface ManageMappingsError {
  operation: 'create' | 'update' | 'delete';
  coach_user_id: number;
  student_user_id: number;
  message: string;
}

export interface ManageMappingsResult {
  created: number;
  updated: number;
  deleted: number;
  errors: ManageMappingsError[];
}

const OPERATION_LABEL: Record<ManageMappingsError['operation'], string> = {
  create: '登録',
  update: '復元',
  delete: '解除',
};

export function parseCoachMappingCsv(text: string): CoachMappingCsvRow[] {
  const lines = text.split(/\r?\n/).map((line, i) => ({ line, row: i + 1 })).filter(l => l.line.trim());
  if (lines.length < 2) throw new Error('データ行がありません（ヘッダー行のみです）');

  const headers = lines[0].line.split(',').map(h => h.trim().replace(/^﻿/, ''));
  const coachIdx = headers.indexOf('coach_user_id');
  const studentIdx = headers.indexOf('student_user_id');
  if (coachIdx < 0 || studentIdx < 0) {
    throw new Error('CSVに coach_user_id と student_user_id カラムが必要です');
  }
  const updateIdx = headers.indexOf('updateFlag');
  const deleteIdx = headers.indexOf('deleteFlag');
  const flag = (values: string[], idx: number) => idx >= 0 && values[idx] === '1';

  return lines.slice(1).map(({ line, row }) => {
    const values = line.split(',').map(v => v.trim());
    const coachId = Number(values[coachIdx]);
    const studentId = Number(values[studentIdx]);
    if (!Number.isInteger(coachId) || !Number.isInteger(studentId) || !values[coachIdx] || !values[studentIdx]) {
      throw new Error(`行 ${row}: coach_user_id と student_user_id は数値で入力してください`);
    }
    const updateFlag = flag(values, updateIdx);
    const deleteFlag = flag(values, deleteIdx);
    if (updateFlag && deleteFlag) {
      throw new Error(`行 ${row}: updateFlag と deleteFlag の両方を 1 にすることはできません`);
    }
    return { coach_user_id: coachId, student_user_id: studentId, updateFlag, deleteFlag, row };
  });
}

/** api-serverの409 detail(英語)を画面向けの文言にする。該当しなければnull */
export function mappingConflictMessage(detail: string): string | null {
  const otherCoach = detail.match(/already has an active coach.*coach=(\d+)/i);
  if (otherCoach) return `この受講生には既に別のコーチ（ID: ${otherCoach[1]}）が割り当てられています。先に解除してください`;
  if (/already exists/i.test(detail)) return '既に有効な割り当てがあります';
  return null;
}

function toErrorMessage(err: ManageMappingsError): string {
  const label = OPERATION_LABEL[err.operation] ?? err.operation;
  const conflict = mappingConflictMessage(err.message);
  if (conflict) return `${label}: ${conflict}`;
  if (/not found/i.test(err.message)) return `${label}: 有効な割り当てが見つかりません`;
  return `${label}に失敗しました`;
}

export function toUploadResult(rows: CoachMappingCsvRow[], result: ManageMappingsResult): UploadResult {
  const operationOf = (r: CoachMappingCsvRow) => (r.deleteFlag ? 'delete' : r.updateFlag ? 'update' : 'create');
  const used = new Set<number>();
  const errors = result.errors.map(err => {
    // BFFは行番号を返さないので、操作・コーチ・受講生が一致する最初の未使用行に戻す
    const match = rows.find(r => !used.has(r.row) && operationOf(r) === err.operation
      && r.coach_user_id === err.coach_user_id && r.student_user_id === err.student_user_id);
    if (match) used.add(match.row);
    return { row: match?.row ?? 0, message: toErrorMessage(err) };
  });

  const processed = result.created + result.updated + result.deleted;
  return {
    success: errors.length === 0,
    recordsProcessed: processed,
    recordsFailed: errors.length,
    message: `登録 ${result.created}件 / 復元 ${result.updated}件 / 解除 ${result.deleted}件 / 失敗 ${errors.length}件`,
    errors: errors.length > 0 ? errors : undefined,
  };
}
