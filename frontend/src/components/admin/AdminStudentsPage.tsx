import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, User, X, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '../ui/button';
import bffClient from '../../services/bffClient';
import { CoachingGoalApi } from '../../types/mypage';

interface Student {
  id: number;
  username: string;
  fullname: string;
  lastaccess: number;
  lastaccess_formatted: string;
  inactive_over_month: boolean;
  new_user: boolean;
  suspended: boolean;
}

type FilterType = 'all' | 'alert' | 'new';

function isAlert(s: Student): boolean {
  return s.inactive_over_month || s.lastaccess === 0;
}

interface GoalsModalProps {
  student: Student;
  onClose: () => void;
}

const GoalsModal: React.FC<GoalsModalProps> = ({ student, onClose }) => {
  const [goals, setGoals] = useState<CoachingGoalApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bffClient.getNextCoachingGoals(student.id)
      .then(data => setGoals(data))
      .catch(() => setError('目標の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [student.id]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:pl-[256px]"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{ background: '#FAF8F4', boxShadow: '0 8px 32px rgba(0,0,0,0.16)' }}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.25)' }}
            >
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-white/80">{student.username}</p>
              <p className="text-sm font-bold text-white">{student.fullname}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.2)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.35)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.2)'; }}
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Section title */}
        <div className="px-6 pt-5 pb-3">
          <h3 className="text-sm font-bold" style={{ color: '#4B3A33' }}>次回コーチングまでの目標</h3>
        </div>

        {/* Goals list */}
        <div className="px-6 pb-6">
          {loading ? (
            <p className="text-sm py-6 text-center" style={{ color: '#7E6E68' }}>読み込み中...</p>
          ) : error ? (
            <p className="text-sm py-6 text-center" style={{ color: '#E86D78' }}>{error}</p>
          ) : goals.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: '#7E6E68' }}>目標が設定されていません</p>
          ) : (
            <ul className="space-y-3">
              {goals
                .slice()
                .sort((a, b) => a.display_order - b.display_order)
                .map(goal => (
                  <li
                    key={goal.no}
                    className="flex items-start gap-3 p-3 rounded-2xl"
                    style={{ background: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                  >
                    {goal.is_completed === 1 ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#E86D78' }} />
                    ) : (
                      <Circle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#C3BAB4' }} />
                    )}
                    <span
                      className="text-sm leading-relaxed"
                      style={{
                        color: goal.is_completed === 1 ? '#C3BAB4' : '#4B3A33',
                        textDecoration: goal.is_completed === 1 ? 'line-through' : 'none',
                      }}
                    >
                      {goal.description}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export const AdminStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    bffClient.getStudents()
      .then(data => setStudents(data.students))
      .catch(() => setError('受講生情報の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = students;

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(s =>
        s.username.toLowerCase().includes(q) || s.fullname.toLowerCase().includes(q)
      );
    }

    if (filter === 'alert') list = list.filter(isAlert);
    if (filter === 'new')   list = list.filter(s => s.new_user);

    return list;
  }, [students, query, filter]);

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: 'all',   label: 'すべて' },
    { key: 'alert', label: 'アラート' },
    { key: 'new',   label: '受講開始 1ヶ月以内' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1 text-brand-text">受講生一覧</h1>
        <p className="text-sm text-brand-muted">
          登録されている受講生を確認できます。
        </p>
      </div>

      {/* Search + Filter */}
      <div
        className="rounded-2xl p-4 mb-4"
        style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#C3BAB4' }} />
          <input
            type="text"
            placeholder="受講IDまたは氏名で検索"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#FFFFFF', color: '#4B3A33', border: '1px solid #EDE8E3' }}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {filterButtons.map(({ key, label }) => (
            <Button
              key={key}
              onClick={() => setFilter(key)}
              variant={filter === key ? 'brand-gradient' : 'brand-ghost'}
              size="pill-sm"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        {/* Header */}
        <div
          className="flex items-center px-5 py-3"
          style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
        >
          <span className="flex-1 text-sm font-bold text-white">受講生</span>
          <span className="w-36 text-sm font-bold text-white text-center">最終ログイン</span>
          <span className="w-24"></span>
        </div>

        {/* Rows */}
        <div className="bg-white divide-y" style={{ borderColor: '#F5F0ED' }}>
          {loading ? (
            <div className="py-12 text-center text-sm" style={{ color: '#7E6E68' }}>読み込み中...</div>
          ) : error ? (
            <div className="py-12 text-center text-sm" style={{ color: '#E86D78' }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: '#7E6E68' }}>
              該当する受講生がいません
            </div>
          ) : (
            filtered.map(student => (
              <div key={student.id} className="flex items-center px-5 py-4 hover:bg-brand-bg transition-colors">
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mr-4"
                  style={{ background: '#EDE8E3' }}
                >
                  <User className="w-4 h-4" style={{ color: '#C3BAB4' }} />
                </div>

                {/* ID + Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs" style={{ color: '#7E6E68' }}>{student.username}</p>
                  <p className="font-bold text-sm" style={{ color: '#4B3A33' }}>{student.fullname}</p>
                </div>

                {/* Last login */}
                <span
                  className="w-36 text-sm text-center"
                  style={{ color: isAlert(student) ? '#E86D78' : '#7E6E68' }}
                >
                  {student.lastaccess === 0 ? '未ログイン' : student.lastaccess_formatted}
                </span>

                {/* Detail button */}
                <div className="w-24 flex justify-center">
                  <button
                    onClick={() => setSelectedStudent(student)}
                    className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
                    style={{ background: '#FFFFFF', color: '#7E6E68', border: '1px solid #C3BAB4' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FAF8F4'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF'; }}
                  >
                    詳しく見る &gt;
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {!loading && !error && (
        <p className="text-right text-xs mt-3" style={{ color: '#C3BAB4' }}>
          {filtered.length} 件 / 合計 {students.length} 件
        </p>
      )}

      {selectedStudent && (
        <GoalsModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
};
