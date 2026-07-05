import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronRight, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../shared/AppHeader';
import { Button } from '../ui/button';
import { useAuth } from '../../contexts/AuthContext';
import bffClient from '../../services/bffClient';

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

export function CoachStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

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
        s.username.toLowerCase().includes(q) || s.fullname.includes(q)
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
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader userName={user?.username} />

      {/* Background decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20" style={{ zIndex: 0 }}>
        <div className="absolute w-[900px] h-[900px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(225,112,121,0.3) 0%, transparent 70%)', top: '-200px', left: '-300px', filter: 'blur(40px)' }} />
        <div className="absolute w-[900px] h-[900px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(253,234,226,0.5) 0%, transparent 70%)', top: '-100px', right: '-400px', filter: 'blur(40px)' }} />
        <div className="absolute w-[900px] h-[900px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(242,147,103,0.3) 0%, transparent 70%)', bottom: '-300px', left: '30%', filter: 'blur(40px)' }} />
      </div>

      <div className="relative flex-1 max-w-[860px] w-full mx-auto px-4 sm:px-6 py-8 pb-24 sm:pb-8" style={{ zIndex: 1 }}>

        <h1 className="text-xl sm:text-2xl font-bold mb-6" style={{ color: '#4B3A33' }}>受講生一覧</h1>

        {/* Search + Filter card */}
        <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#C3BAB4' }} />
            <input
              type="text"
              placeholder="受講IDまたは氏名で検索"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: '#FAF8F4', color: '#4B3A33', border: '1px solid #EDE8E3' }}
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
        <div className="rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {/* Header */}
          <div
            className="flex items-center px-5 py-3"
            style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
          >
            <span className="flex-1 text-sm font-bold text-white">受講生</span>
            <span className="w-28 text-sm font-bold text-white text-center">最終ログイン</span>
            <span className="w-32" />
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
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mr-4"
                    style={{ background: '#EDE8E3' }}
                  >
                    <User className="w-5 h-5" style={{ color: '#C3BAB4' }} />
                  </div>

                  {/* ID + Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs" style={{ color: '#7E6E68' }}>{student.username}</p>
                    <p className="font-bold text-sm" style={{ color: '#4B3A33' }}>{student.fullname}</p>
                  </div>

                  {/* Last login */}
                  <span
                    className="w-28 text-sm text-center"
                    style={{ color: isAlert(student) ? '#E86D78' : '#7E6E68' }}
                  >
                    {student.lastaccess === 0 ? '未ログイン' : student.lastaccess_formatted}
                  </span>

                  {/* Detail button */}
                  <div className="w-32 flex justify-end">
                    <Button
                      variant="brand-ghost"
                      size="pill-sm"
                      onClick={() => navigate(`/coach/students/${student.id}`)}
                    >
                      詳しく見る
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <p className="text-center text-xs mt-8" style={{ color: '#C3BAB4' }}>2026 © WEBCOACH</p>
      </div>
    </div>
  );
}
