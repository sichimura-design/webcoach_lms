import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2 } from 'lucide-react';
import { Profile } from '../../types/api';
import { BadgeProgress } from '../../types/mypage';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
// import { Progress } from '../ui/progress'; // バッジ獲得状況で使用

interface ProfileSectionProps {
  user: Profile;
  badgeProgress?: BadgeProgress; // 一時的にoptionalに
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({ user, badgeProgress }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {/* Profile Card */}
      <Card className="border-0 shadow-none">
        <CardContent className="p-4 sm:p-6">
          {/* Profile Image with Level Badge */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div
                className="rounded-full overflow-hidden bg-white"
                style={{
                  width: '128px',
                  height: '128px',
                  border: '4px solid #FCE7F3'
                }}
              >
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.nick_name || '未設定')}&background=F3A7A7&color=fff&size=128`}
                  alt={user.nick_name || '未設定'}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Level Badge */}
              <div
                className="absolute bottom-0 right-0 bg-[#F3A7A7] text-white font-bold rounded-full px-3 py-1 text-sm"
              >
                Lv.1
              </div>
            </div>
          </div>

          {/* User Name */}
          <h2
            className="text-center font-bold text-lg mb-4"
            style={{ color: '#555555' }}
          >
            {user.nick_name || '未設定'}
          </h2>

          {/* Edit Profile Button */}
          <Button
            variant="outline"
            onClick={() => navigate('/profile')}
            className="w-full rounded-full border-[#F3A7A7] text-[#F3A7A7] hover:bg-pink-50"
          >
            <Edit2 className="w-4 h-4" />
            <span className="text-sm">プロフィール編集</span>
          </Button>
        </CardContent>
      </Card>

      {/* Badge Progress - 一時的にコメントアウト
      <Card className="border-0 shadow-none">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#F3A7A7]" style={{ fontFamily: 'Noto Sans JP, sans-serif' }}>
              バッジ獲得状況
            </h3>
            <Button
              variant="link"
              size="sm"
              onClick={() => navigate('/badges')}
              className="text-xs text-blue-500 p-0 h-auto"
            >
              一覧をみる
            </Button>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold text-gray-700">{badgeProgress.earned}</span>
            <span className="text-sm text-gray-400">/ {badgeProgress.total} 個</span>
          </div>
          <Progress
            value={(badgeProgress.earned / badgeProgress.total) * 100}
            className="h-2 mb-2"
          />
          <p className="text-xs text-gray-400">次のランクまであと{badgeProgress.nextRankRemaining}個</p>
        </CardContent>
      </Card>
      */}
    </div>
  );
};
