import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, User, Users, X, CheckCircle, AlertCircle, ChevronDown, Link2 } from 'lucide-react';
import { Button } from '../ui/button';
import { bffClient } from '../../services/bffClient';
import { UploadHistory as UploadHistoryType, UploadResult as UploadResultType } from '../../types/admin';
import { CsvUploader } from './CsvUploader';
import { UploadResult } from './UploadResult';
import { UploadHistory } from './UploadHistory';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CoachUser {
  userId: string;
  username: string;
  email: string;
  status: string;
  enabled: boolean;
  moodleUserId?: number;
}

interface StudentUser {
  id: number;
  username: string;
  fullname: string;
  email: string;
  suspended: boolean;
}

// ─── UserSearchBox ────────────────────────────────────────────────────────────

interface UserSearchBoxProps<T> {
  label: string;
  placeholder: string;
  items: T[];
  selected: T | null;
  onSelect: (item: T | null) => void;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getSublabel: (item: T) => string;
  loading: boolean;
  accentColor?: string;
}

function UserSearchBox<T>({
  label,
  placeholder,
  items,
  selected,
  onSelect,
  getKey,
  getLabel,
  getSublabel,
  loading,
  accentColor = '#E86D78',
}: UserSearchBoxProps<T>) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 20);
    return items.filter(
      item =>
        getLabel(item).toLowerCase().includes(q) ||
        getSublabel(item).toLowerCase().includes(q)
    ).slice(0, 20);
  }, [items, query, getLabel, getSublabel]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (selected) {
    return (
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold mb-1.5" style={{ color: '#7E6E68' }}>{label}</p>
        <div
          className="flex items-center gap-3 p-3 rounded-2xl"
          style={{ background: '#FAF8F4', border: `1.5px solid ${accentColor}` }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: `${accentColor}22` }}
          >
            <User className="w-4 h-4" style={{ color: accentColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs" style={{ color: '#7E6E68' }}>{getSublabel(selected)}</p>
            <p className="font-bold text-sm truncate" style={{ color: '#4B3A33' }}>{getLabel(selected)}</p>
          </div>
          <button
            onClick={() => { onSelect(null); setQuery(''); }}
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
            style={{ background: '#EDE8E3' }}
          >
            <X className="w-3.5 h-3.5" style={{ color: '#7E6E68' }} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 relative" ref={containerRef}>
      <p className="text-xs font-semibold mb-1.5" style={{ color: '#7E6E68' }}>{label}</p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#C3BAB4' }} />
        <input
          type="text"
          placeholder={loading ? '読み込み中...' : placeholder}
          value={query}
          disabled={loading}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none transition-all"
          style={{
            background: '#FFFFFF',
            color: '#4B3A33',
            border: open ? `1.5px solid ${accentColor}` : '1.5px solid #EDE8E3',
          }}
        />
        <ChevronDown
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-transform"
          style={{ color: '#C3BAB4', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </div>

      {open && !loading && (
        <div
          className="absolute z-50 w-full mt-1 rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid #EDE8E3' }}
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm" style={{ color: '#7E6E68' }}>
              該当するユーザーがいません
            </div>
          ) : (
            <ul className="max-h-52 overflow-y-auto divide-y" style={{ borderColor: '#F5F0ED' }}>
              {filtered.map(item => (
                <li
                  key={getKey(item)}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                  style={{ color: '#4B3A33' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAF8F4')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onMouseDown={e => {
                    e.preventDefault();
                    onSelect(item);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: '#EDE8E3' }}
                  >
                    <User className="w-3.5 h-3.5" style={{ color: '#C3BAB4' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs" style={{ color: '#7E6E68' }}>{getSublabel(item)}</p>
                    <p className="text-sm font-medium truncate">{getLabel(item)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

const TEMPLATE_CONTENT = [
  'coach_user_id,student_user_id,updateFlag,deleteFlag',
  '5,10,0,0',
  '5,11,0,0',
  '6,12,0,1',
].join('\n');

const CSV_FORMAT = [
  { col: 'coach_user_id',   required: true,  desc: 'コーチのMoodleユーザーID' },
  { col: 'student_user_id', required: true,  desc: '受講生のMoodleユーザーID' },
  { col: 'updateFlag',      required: false, desc: '1 の場合、既存マッピングを更新する' },
  { col: 'deleteFlag',      required: false, desc: '1 の場合、該当マッピングを削除する' },
];

function downloadCsvContent(content: string, filename: string) {
  const BOM = '﻿';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(values: unknown[]): string {
  return values.map(escapeCsvValue).join(',');
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  type: 'success' | 'error';
  message: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const AdminCoachMappingPage: React.FC = () => {
  const [coaches, setCoaches] = useState<CoachUser[]>([]);
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);

  const [selectedCoach, setSelectedCoach] = useState<CoachUser | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentUser | null>(null);
  const [registering, setRegistering] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const [lookupCoach, setLookupCoach] = useState<CoachUser | null>(null);
  const [lookupStudents, setLookupStudents] = useState<StudentUser[]>([]);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupDone, setLookupDone] = useState(false);

  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResultType | null>(null);
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryType[]>([]);

  useEffect(() => {
    bffClient.getUsersByRole('coach')
      .then(data => setCoaches(data.users))
      .catch(() => setCoaches([]))
      .finally(() => setLoadingCoaches(false));

    bffClient.getStudents()
      .then(data => setStudents(data.students))
      .catch(() => setStudents([]))
      .finally(() => setLoadingStudents(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleRegister = async () => {
    if (!selectedCoach || !selectedStudent) return;

    // Moodle IDはcoach APIのmoodleUserIdを優先。なければcallMoodleAPIで取得
    let coachMoodleId = selectedCoach.moodleUserId;

    if (!coachMoodleId) {
      try {
        const result = await bffClient.callMoodleAPI<Array<{ id: number; username: string }>>(
          'core_user_get_users_by_field',
          { field: 'username', 'values[0]': selectedCoach.username }
        );
        coachMoodleId = result?.[0]?.id;
      } catch {
        setToast({ type: 'error', message: 'コーチのMoodleユーザーIDを取得できませんでした' });
        return;
      }
    }

    if (!coachMoodleId) {
      setToast({ type: 'error', message: `コーチ "${selectedCoach.username}" はMoodleに存在しません` });
      return;
    }

    setRegistering(true);
    try {
      await bffClient.createCoachingMapping(coachMoodleId, selectedStudent.id);
      setToast({
        type: 'success',
        message: `${selectedCoach.username} → ${selectedStudent.fullname} の割り当てを登録しました`,
      });
      setSelectedCoach(null);
      setSelectedStudent(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? '登録に失敗しました';
      setToast({ type: 'error', message: msg });
    } finally {
      setRegistering(false);
    }
  };

  const handleLookupCoach = async (coach: CoachUser | null) => {
    setLookupCoach(coach);
    setLookupStudents([]);
    setLookupError(null);
    setLookupDone(false);
    if (!coach) return;

    let coachMoodleId = coach.moodleUserId;
    if (!coachMoodleId) {
      try {
        const result = await bffClient.callMoodleAPI<Array<{ id: number; username: string }>>(
          'core_user_get_users_by_field',
          { field: 'username', 'values[0]': coach.username }
        );
        coachMoodleId = result?.[0]?.id;
      } catch {
        setLookupError('コーチのMoodleユーザーIDを取得できませんでした');
        return;
      }
    }

    if (!coachMoodleId) {
      setLookupError(`コーチ "${coach.username}" はMoodleに存在しません`);
      return;
    }

    setLoadingLookup(true);
    try {
      const mappings = await bffClient.getAllCoachingMappings();
      const studentIds = new Set(
        mappings
          .filter(m => m.coach_user_id === coachMoodleId && !m.logical_deleted)
          .map(m => m.student_user_id)
      );
      setLookupStudents(students.filter(s => studentIds.has(s.id)));
      setLookupDone(true);
    } catch {
      setLookupError('データの取得に失敗しました');
    } finally {
      setLoadingLookup(false);
    }
  };

  const handleDownloadTemplate = () => {
    downloadCsvContent(TEMPLATE_CONTENT, 'template_coach_mapping.csv');
  };

  const handleDownloadAll = async () => {
    setIsDownloadingAll(true);
    const today = new Date().toISOString().split('T')[0];
    try {
      const mappings = await bffClient.getAllCoachingMappings();
      const header = 'coach_user_id,student_user_id,logical_deleted,created_at,updated_at';
      const rows = mappings.map(m => toCsvRow([m.coach_user_id, m.student_user_id, m.logical_deleted, m.created_at, m.updated_at]));
      downloadCsvContent([header, ...rows].join('\n'), `all_coach_mappings_${today}.csv`);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadResult(null);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) throw new Error('データ行がありません（ヘッダー行のみです）');

      const headers = lines[0].split(',').map(h => h.trim().replace(/^﻿/, ''));
      if (!headers.includes('coach_user_id') || !headers.includes('student_user_id')) {
        throw new Error('CSVに coach_user_id と student_user_id カラムが必要です');
      }

      const coachIdx   = headers.indexOf('coach_user_id');
      const studentIdx = headers.indexOf('student_user_id');
      const updateIdx  = headers.indexOf('updateFlag');
      const deleteIdx  = headers.indexOf('deleteFlag');

      interface MappingRecord { coach_user_id: number; student_user_id: number; updateFlag: number; deleteFlag: number; row: number; }
      const records: MappingRecord[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const coachId   = parseInt(values[coachIdx], 10);
        const studentId = parseInt(values[studentIdx], 10);
        if (isNaN(coachId) || isNaN(studentId)) throw new Error(`行 ${i + 1}: coach_user_id と student_user_id は数値で入力してください`);
        const updateFlag = updateIdx >= 0 ? parseInt(values[updateIdx] || '0', 10) : 0;
        const deleteFlag = deleteIdx >= 0 ? parseInt(values[deleteIdx] || '0', 10) : 0;
        if (updateFlag === 1 && deleteFlag === 1) throw new Error(`行 ${i + 1}: updateFlag と deleteFlag の両方を 1 にすることはできません`);
        records.push({ coach_user_id: coachId, student_user_id: studentId, updateFlag, deleteFlag, row: i + 1 });
      }

      let successCount = 0;
      const errors: Array<{ row: number; message: string }> = [];

      await Promise.allSettled(
        records.map(async ({ coach_user_id, student_user_id, updateFlag, deleteFlag, row }) => {
          try {
            await bffClient.createCoachingMapping(coach_user_id, student_user_id, updateFlag, deleteFlag);
            successCount++;
          } catch (err: any) {
            errors.push({ row, message: err?.response?.data?.message ?? err?.message ?? '登録に失敗しました' });
          }
        })
      );

      const result: UploadResultType = {
        success: errors.length === 0,
        recordsProcessed: successCount,
        recordsFailed: errors.length,
        message: `登録成功: ${successCount}件 / 失敗: ${errors.length}件`,
        errors: errors.length > 0 ? errors : undefined,
      };
      setUploadResult(result);
      setUploadHistory(prev => [{
        id: Date.now().toString(),
        dataType: 'coach-mapping',
        filename: file.name,
        uploadedAt: new Date(),
        status: result.success ? 'success' : 'failed',
        recordsProcessed: result.recordsProcessed,
        recordsFailed: result.recordsFailed,
        errorMessage: result.success ? undefined : result.message,
      }, ...prev]);
    } catch (error) {
      setUploadResult({
        success: false,
        recordsProcessed: 0,
        recordsFailed: 0,
        message: error instanceof Error ? error.message : 'アップロード中にエラーが発生しました',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const canRegister = selectedCoach !== null && selectedStudent !== null && !registering;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1 text-brand-text">コーチ割り当て</h1>
        <p className="text-sm text-brand-muted">コーチと受講生を検索して割り当てを登録します</p>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg transition-all"
          style={{
            background: toast.type === 'success' ? '#FFFFFF' : '#FFF5F5',
            border: `1.5px solid ${toast.type === 'success' ? '#E86D78' : '#FFAAAA'}`,
            maxWidth: 360,
          }}
        >
          {toast.type === 'success'
            ? <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#E86D78' }} />
            : <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#E86D78' }} />
          }
          <p className="text-sm" style={{ color: '#4B3A33' }}>{toast.message}</p>
        </div>
      )}

      {/* ── Manual Registration Card ── */}
      <div
        className="rounded-3xl mb-6"
        style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        {/* Card header */}
        <div
          className="flex items-center gap-3 px-6 py-4 rounded-t-3xl"
          style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.25)' }}
          >
            <Link2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">名前で検索して登録</p>
            <p className="text-white/70 text-xs">コーチと受講生を選択して割り当てを登録</p>
          </div>
        </div>

        <div className="px-6 py-5">
          {/* Search boxes */}
          <div className="flex gap-4 mb-5 flex-col sm:flex-row">
            <UserSearchBox
              label="コーチ"
              placeholder="コーチ名または IDで検索"
              items={coaches}
              selected={selectedCoach}
              onSelect={setSelectedCoach}
              getKey={c => c.userId}
              getLabel={c => c.email ? `${c.username} (${c.email})` : c.username}
              getSublabel={c => c.username}
              loading={loadingCoaches}
              accentColor="#E86D78"
            />

            {/* Arrow indicator */}
            <div className="flex items-center justify-center flex-shrink-0 pt-5">
              <div
                className="hidden sm:flex w-8 h-8 rounded-full items-center justify-center"
                style={{ background: '#FAF8F4' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke="#C3BAB4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            <UserSearchBox
              label="受講生"
              placeholder="氏名または IDで検索"
              items={students}
              selected={selectedStudent}
              onSelect={setSelectedStudent}
              getKey={s => String(s.id)}
              getLabel={s => s.fullname}
              getSublabel={s => s.username}
              loading={loadingStudents}
              accentColor="#FA9262"
            />
          </div>

          {/* Register button */}
          <div className="flex justify-end">
            <Button
              onClick={handleRegister}
              disabled={!canRegister}
              variant={canRegister ? 'brand-gradient' : 'brand-ghost'}
              size="pill-sm"
              className="px-6"
            >
              {registering ? '登録中...' : '割り当てを登録する'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Coach Student Lookup Card ── */}
      <div
        className="rounded-3xl mb-6"
        style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        <div
          className="flex items-center gap-3 px-6 py-4 rounded-t-3xl"
          style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.25)' }}
          >
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">コーチで紐づき生徒を確認</p>
            <p className="text-white/70 text-xs">コーチを選択して現在割り当てられている受講生を表示</p>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="mb-5 max-w-sm">
            <UserSearchBox
              label="コーチ"
              placeholder="コーチ名または IDで検索"
              items={coaches}
              selected={lookupCoach}
              onSelect={handleLookupCoach}
              getKey={c => c.userId}
              getLabel={c => c.email ? `${c.username} (${c.email})` : c.username}
              getSublabel={c => c.username}
              loading={loadingCoaches}
              accentColor="#E86D78"
            />
          </div>

          {loadingLookup && (
            <p className="text-sm text-brand-muted">読み込み中...</p>
          )}

          {lookupError && (
            <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#FFF5F5', border: '1px solid #FFAAAA' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#E86D78' }} />
              <p className="text-sm" style={{ color: '#4B3A33' }}>{lookupError}</p>
            </div>
          )}

          {!loadingLookup && lookupDone && (
            lookupStudents.length === 0 ? (
              <p className="text-sm text-brand-muted">現在紐づいている受講生はいません</p>
            ) : (
              <div>
                <p className="text-xs font-semibold mb-3" style={{ color: '#7E6E68' }}>
                  紐づき受講生 ({lookupStudents.length}人)
                </p>
                <ul className="space-y-2">
                  {lookupStudents.map(s => (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 p-3 rounded-2xl"
                      style={{ background: '#FAF8F4', border: '1.5px solid #EDE8E3' }}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: '#FA926222' }}
                      >
                        <User className="w-4 h-4" style={{ color: '#FA9262' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs" style={{ color: '#7E6E68' }}>{s.username} (ID: {s.id})</p>
                        <p className="font-bold text-sm truncate" style={{ color: '#4B3A33' }}>{s.fullname}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── CSV Bulk Upload Card ── */}
      <div
        className="rounded-3xl p-6 sm:p-8"
        style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        <h2 className="text-sm font-bold mb-4 text-brand-text">CSVで一括登録</h2>

        <div className="mb-6 p-4 rounded-xl bg-brand-bg" style={{ border: '1px solid #E8E0DA' }}>
          <h3 className="text-xs font-bold mb-2 text-brand-text">CSVフォーマット</h3>
          <div className="text-xs mb-3 text-brand-muted overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E8E0DA]">
                  <th className="text-left py-1 pr-4 whitespace-nowrap">カラム</th>
                  <th className="text-left py-1 pr-4 whitespace-nowrap">必須</th>
                  <th className="text-left py-1">説明</th>
                </tr>
              </thead>
              <tbody>
                {CSV_FORMAT.map((row, i) => (
                  <tr key={row.col} className={i < CSV_FORMAT.length - 1 ? 'border-b border-[#E8E0DA]' : ''}>
                    <td className="py-1 pr-4 font-mono whitespace-nowrap">{row.col}</td>
                    <td className="py-1 pr-4 whitespace-nowrap">
                      {row.required
                        ? <span className="text-[#E86D78] font-semibold">必須</span>
                        : '任意'}
                    </td>
                    <td className="py-1">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleDownloadTemplate} variant="brand-outline" size="pill-sm">
              テンプレート
            </Button>
            <Button
              onClick={handleDownloadAll}
              disabled={isDownloadingAll}
              variant="brand-outline"
              size="pill-sm"
              className="text-green-700 border-green-600 hover:bg-green-50"
            >
              {isDownloadingAll ? '取得中...' : '全件ダウンロード'}
            </Button>
          </div>
        </div>

        <UploadResult result={uploadResult} onClose={() => setUploadResult(null)} />
        <CsvUploader onUpload={handleUpload} isUploading={isUploading} />
        <UploadHistory history={uploadHistory} />
      </div>
    </div>
  );
};
