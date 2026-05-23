import React from 'react';
import { User, Settings, Bell, CreditCard, LucideIcon } from 'lucide-react';
import { ProfileTab } from '../../types/profile';
import { Card, CardContent } from '../ui/card';

interface TabItem {
  id: ProfileTab;
  label: string;
  icon: LucideIcon;
}

const tabs: TabItem[] = [
  { id: 'profile', label: 'プロフィール編集', icon: User },
  { id: 'account', label: 'アカウント設定', icon: Settings },
  { id: 'notifications', label: '通知設定', icon: Bell },
  { id: 'payment', label: 'お支払い情報', icon: CreditCard },
];

interface ProfileSidebarProps {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
}

export function ProfileSidebar({ activeTab, onTabChange }: ProfileSidebarProps) {
  return (
    <aside>
      <Card className="border-0 overflow-hidden">
        <CardContent className="p-0">
          {tabs.map(({ id, label, icon: Icon }) => (
            <div
              key={id}
              onClick={() => onTabChange(id)}
              className={`flex items-center gap-3 px-6 py-4 cursor-pointer transition-colors ${
                activeTab === id
                  ? 'bg-[#FCE7F3] text-[#F3A7A7] font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </aside>
  );
}
