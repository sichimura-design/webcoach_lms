import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Bot, BrainCircuit, FolderOpen, ImageUp, KeyRound, PlusCircle, UserCircle2, Users, Link2 } from 'lucide-react';
import { AppHeader } from '../shared/AppHeader';

const sidebarItems = [
  { to: '/admin/cognito-users', label: 'ユーザー管理', icon: KeyRound },
  { to: '/admin/students', label: '受講生一覧', icon: Users },
  { to: '/admin/coach-mapping', label: 'コーチ割り当て', icon: Link2 },
  { to: '/admin/create-course', label: 'コース作成', icon: PlusCircle },
  // { to: '/admin/courses', label: 'コース管理', icon: BookOpen },
  { to: '/admin/categories', label: 'カテゴリ管理', icon: FolderOpen },
  // { to: '/admin/enrollments', label: '受講登録', icon: UserPlus },
  { to: '/admin/image-upload', label: 'コンテンツUP', icon: ImageUp },
  { to: '/admin/ai-applications', label: 'AIアプリ登録', icon: Bot },
  { to: '/admin/avatars', label: 'アバター登録', icon: UserCircle2 },
  { to: '/admin/vector-data', label: 'Vectorデータ設定', icon: BrainCircuit },
];

export const AdminLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-brand-bg">
      <AppHeader />
      <div className="max-w-[1440px] mx-auto flex" style={{ minHeight: 'calc(100vh - 80px)' }}>
        {/* Sidebar */}
        <aside
          className="w-[240px] flex-shrink-0 border-r border-[#E8E0DA] p-4"
          style={{ backgroundColor: '#FFFFFF' }}
        >
          <h2
            className="text-lg font-bold mb-4 px-3 text-brand-text"
          >
            管理メニュー
          </h2>
          <nav className="flex flex-col gap-1">
            {sidebarItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'text-white bg-brand-gradient'
                      : 'text-brand-muted hover:bg-brand-bg'
                  }`
                }
              >
                <item.icon className="w-[18px] h-[18px]" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
