import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, User, Users, X, CheckCircle, AlertCircle, ChevronDown, Link2, Unlink } from 'lucide-react';
import { Button } from '../ui/button';
import { bffClient } from '../../services/bffClient';
import { UploadHistory as UploadHistoryType, UploadResult as UploadResultType } from '../../types/admin';
import { CsvUploader } from './CsvUploader';
import { UploadResult } from './UploadResult';
import { UploadHistory } from './UploadHistory';
import { getUserMessage } from '../../utils/errorMessage';
import { conflictCoachId, mappingConflictMessage, parseCoachMappingCsv, toUploadResult } from '../../utils/coachMappingCsv';
import { ConfirmDialog } from '../shared/ConfirmDialog';

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
  { col: 'updateFlag',      required: false, desc: '1 の場合、解除済みの割り当てを復元する（有効な割り当てがあればエラー）' },
  { col: 'deleteFlag',      required: false, desc: '1 の場合、該当の割り当てを解除する。コーチ変更は「旧コーチの行を deleteFlag=1」+「新コーチの行」の2行で行う' },
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

/**
 * 登録の失敗はトーストにせず、カードの中に残す（M-2）。
 * 以前は3.5秒で消えるトーストだけで、1人1コーチのエラーのような長い文を読み切れなかった。
 */
interface RegisterError {
  message: string;
  /** 1人1コーチに当たったとき、いま付いているコーチ（担当一覧へ飛ぶ導線に使う） */
  currentCoach?: CoachUser;
}

/** 失敗を知らせる枠。閉じるまで残る */
function ErrorPanel({ message, onClose, children }: { message: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 p-3 rounded-xl mb-4" style={{ background: '#FFF5F5', border: '1px solid #FFAAAA' }}>
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#E86D78' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: '#4B3A33' }}>{message}</p>
        {children}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: '#FFE3E3' }}
      >
        <X className="w-3.5 h-3.5" style={{ color: '#7E6E68' }} />
      </button>
    </div>
  );
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
  const [registerError, setRegisterError] = useState<RegisterError | null>(null);

  const [lookupCoach, setLookupCoach] = useState<CoachUser | null>(null);
  const [lookupStudents, setLookupStudents] = useState<StudentUser[]>([]);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupCoachMoodleId, setLookupCoachMoodleId] = useState<number | null>(null);
  // 画面から解除する受講生（確認ダイアログを出しているあいだ）。M-1
  const [unassignTarget, setUnassignTarget] = useState<StudentUser | null>(null);
  const [unassigning, setUnassigning] = useState(false);
  const lookupCardRef = useRef<HTMLDivElement>(null);

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
    setRegisterError(null);

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
        setRegisterError({ message: 'コーチのMoodleユーザーIDを取得できませんでした' });
        return;
      }
    }

    if (!coachMoodleId) {
      setRegisterError({ message: `コーチ "${selectedCoach.username}" はMoodleに存在しません` });
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
      console.error('Failed to create coaching mapping:', err);
      const detail: string | null = err?.response?.status === 409 && typeof err.response.data?.detail === 'string'
        ? err.response.data.detail
        : null;
      const conflict = detail ? mappingConflictMessage(detail) : null;
      const currentId = detail ? conflictCoachId(detail) : null;
      setRegisterError({
        message: conflict ?? getUserMessage(err, '登録に失敗しました'),
        currentCoach: currentId != null ? coaches.find(c => c.moodleUserId === currentId) : undefined,
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleLookupCoach = async (coach: CoachUser | null) => {
    setLookupCoach(coach);
    setLookupStudents([]);
    setLookupError(null);
    setLookupDone(false);
    setLookupCoachMoodleId(null);
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

    setLookupCoachMoodleId(coachMoodleId);
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

  /** 1人1コーチのエラーから、いま付いているコーチの担当一覧を開く（そこで解除できる） */
  const openCurrentCoach = (coach: CoachUser) => {
    setRegisterError(null);
    void handleLookupCoach(coach);
    lookupCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /**
   * 画面から割り当てを解除する（M-1）。CSV と同じ manage-mappings に deleteFlag の1件を送る。
   * 以前は解除が CSV でしかできず、「先に解除してください」と言われても画面に手段が無かった。
   */
  const handleUnassign = async () => {
    if (!unassignTarget || lookupCoachMoodleId == null || !lookupCoach) return;
    setUnassigning(true);
    try {
      const res = await bffClient.manageCoachingMappings([
        { coach_user_id: lookupCoachMoodleId, student_user_id: unassignTarget.id, updateFlag: false, deleteFlag: true },
      ]);
      if (res.errors.length > 0 || res.deleted === 0) {
        setLookupError(`${unassignTarget.fullname} の割り当てを解除できませんでした（有効な割り当てが見つかりません）`);
      } else {
        setToast({ type: 'success', message: `${lookupCoach.username} の担当から ${unassignTarget.fullname} を外しました` });
        await handleLookupCoach(lookupCoach);
      }
    } catch (err) {
      setLookupError(getUserMessage(err, '解除に失敗しました'));
    } finally {
      setUnassigning(false);
      setUnassignTarget(null);
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
      // 解除→復元→登録の順にBFFが処理するので、「旧コーチを解除+新コーチを登録」の2行で差し替えられる
      const rows = parseCoachMappingCsv(await file.text());
      const response = await bffClient.manageCoachingMappings(
        rows.map(({ coach_user_id, student_user_id, updateFlag, deleteFlag }) =>
          ({ coach_user_id, student_user_id, updateFlag, deleteFlag }))
      );
      const result = toUploadResult(rows, response);
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
      console.error('CSV upload failed:', error);
      setUploadResult({
        success: false,
        recordsProcessed: 0,
        recordsFailed: 0,
        message: getUserMessage(error, 'アップロード中にエラーが発生しました'),
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
        <p className="text-sm text-brand-muted">
          コーチと受講生の割り当てを登録・解除します。受講生1人に付けられるコーチは1人です。
          コーチを替えるときは、今のコーチの担当から外してから登録してください。
        </p>
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

          {registerError && (
            <ErrorPanel message={registerError.message} onClose={() => setRegisterError(null)}>
              {registerError.currentCoach && (
                <button
                  type="button"
                  onClick={() => openCurrentCoach(registerError.currentCoach!)}
                  className="mt-2 p-0 text-xs font-bold underline bg-transparent border-0 cursor-pointer"
                  style={{ color: '#E86D78' }}
                >
                  今のコーチ（{registerError.currentCoach.username}）の担当一覧を開いて外す
                </button>
              )}
            </ErrorPanel>
          )}

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
        ref={lookupCardRef}
        className="rounded-3xl mb-6 scroll-mt-6"
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
            <p className="text-white font-bold text-sm">コーチの担当受講生を確認・解除</p>
            <p className="text-white/70 text-xs">コーチを選ぶと、いま担当している受講生が出ます。ここから担当を外せます</p>
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

          {lookupError && <ErrorPanel message={lookupError} onClose={() => setLookupError(null)} />}

          {!loadingLookup && lookupDone && (
            lookupStudents.length === 0 ? (
              <p className="text-sm text-brand-muted">いま担当している受講生はいません</p>
            ) : (
              <div>
                <p className="text-xs font-semibold mb-3" style={{ color: '#7E6E68' }}>
                  担当している受講生（{lookupStudents.length}人）
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
                      <Button
                        onClick={() => setUnassignTarget(s)}
                        disabled={unassigning || lookupCoachMoodleId == null}
                        variant="brand-outline"
                        size="pill-sm"
                        className="flex-shrink-0 gap-1"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        担当から外す
                      </Button>
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
        <h2 className="text-sm font-bold mb-1 text-brand-text">CSVで登録・解除・復元</h2>
        <p className="text-xs mb-4 text-brand-muted">
          まとめて処理するときに使います。ID は Moodle のユーザーIDです。今の割り当ては「全件ダウンロード」で確認できます。
        </p>

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

      {unassignTarget && lookupCoach && (
        // 確認ダイアログの色（--dc-*）は .wc-warm の中で決まる。管理画面の外枠には無いので包む
        <div className="wc-warm">
          <ConfirmDialog
            title={`${unassignTarget.fullname} を ${lookupCoach.username} の担当から外しますか？`}
            description="割り当てを解除するだけで、これまでのコーチングの記録は消えません。あとから CSV の updateFlag で復元できます。"
            confirmLabel="担当から外す"
            busy={unassigning}
            onConfirm={() => void handleUnassign()}
            onCancel={() => setUnassignTarget(null)}
          />
        </div>
      )}
    </div>
  );
};
