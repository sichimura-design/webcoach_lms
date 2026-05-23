import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import { Badge } from '../types/mypage';
import { FilterTab } from './mypage/FilterTab';
import { BadgeCard } from './mypage/BadgeCard';
import { useAuth } from '../contexts/AuthContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { useToast } from '../contexts/ToastContext';

// Moodle API Badge types
interface MoodleBadge {
  id: number;
  name: string;
  description: string;
  badgeurl?: string;
  status?: number;
  dateissued?: number;
  courseid?: number;
}

interface MoodleUserBadge {
  id: number;
  badgeid: number;
  userid: number;
  dateissued: number;
  uniquehash: string;
}

// Map Moodle badge to our Badge type
function mapMoodleBadgeToLocal(
  moodleBadge: MoodleBadge,
  userBadges: MoodleUserBadge[]
): Badge {
  const userBadge = userBadges.find((ub) => ub.badgeid === moodleBadge.id);
  const earnedAt = userBadge ? new Date(userBadge.dateissued * 1000).toISOString() : undefined;

  // Categorize badge based on name/description
  let category: Badge['category'] = 'achievement';
  if (moodleBadge.name.includes('スキル') || moodleBadge.name.includes('マスター')) {
    category = 'skill';
  } else if (moodleBadge.name.includes('特別') || moodleBadge.name.includes('限定')) {
    category = 'special';
  }

  // Determine rarity based on some logic (can be customized)
  let rarity: Badge['rarity'] = 'common';
  if (moodleBadge.name.includes('レジェンド') || moodleBadge.name.includes('神')) {
    rarity = 'legendary';
  } else if (moodleBadge.name.includes('エピック') || moodleBadge.name.includes('上級')) {
    rarity = 'epic';
  } else if (moodleBadge.name.includes('レア') || moodleBadge.name.includes('中級')) {
    rarity = 'rare';
  }

  return {
    id: moodleBadge.id,
    name: moodleBadge.name,
    description: moodleBadge.description,
    iconUrl: moodleBadge.badgeurl,
    earnedAt,
    category,
    rarity,
    progress: earnedAt ? 100 : 0, // Simple logic: earned = 100%, not earned = 0%
  };
}

function BadgesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { showToast } = useToast();
  const [selectedFilter, setSelectedFilter] = useState<string>('すべて');

  const filters = ['すべて', '獲得済み', '未獲得', 'デザイン', '動画関連'];

  const BFF_URL = process.env.REACT_APP_BFF_URL;

  const { data, loading: isLoading, error } = useAsyncData(
    () => {
      if (!BFF_URL) throw new Error('REACT_APP_BFF_URL is not configured');
      return user?.userid
      ? Promise.all([
          fetch(`${BFF_URL}/api/moodle/badges`, { credentials: 'include' }).then(r => {
            if (!r.ok) throw new Error('バッジ一覧の取得に失敗しました');
            return r.json();
          }),
          fetch(`${BFF_URL}/api/moodle/user-badges/${user.userid}`, { credentials: 'include' }).then(r => {
            if (!r.ok) throw new Error('ユーザーバッジの取得に失敗しました');
            return r.json();
          }),
        ]).then(([allBadgesData, userBadgesData]) => {
          const moodleBadges: MoodleBadge[] = allBadgesData.badges || allBadgesData || [];
          const moodleUserBadges: MoodleUserBadge[] = userBadgesData.badges || userBadgesData || [];
          const mappedBadges = moodleBadges.map(b => mapMoodleBadgeToLocal(b, moodleUserBadges));
          const earned = mappedBadges.filter(b => b.earnedAt).length;
          return {
            badges: mappedBadges,
            stats: {
              earned,
              total: mappedBadges.length,
              rank: earned >= 40 ? 'Platinum' : earned >= 20 ? 'Gold' : earned >= 10 ? 'Silver' : 'Bronze',
            },
          };
        })
      : Promise.resolve(null);
    },
    [user?.userid, BFF_URL],
  );

  const badges: Badge[] = data?.badges ?? [];
  const badgeStats = data?.stats ?? { earned: 0, total: 0, rank: 'Gold' };

  // Filter badges based on selected filter
  const filteredBadges = badges.filter((badge) => {
    if (selectedFilter === 'すべて') return true;
    if (selectedFilter === '獲得済み') return !!badge.earnedAt;
    if (selectedFilter === '未獲得') return !badge.earnedAt;
    if (selectedFilter === 'デザイン') return badge.name.includes('デザイン') || badge.name.includes('Figma');
    if (selectedFilter === '動画関連') return badge.name.includes('動画');
    return true;
  });

  // Handle filter click
  const handleFilterClick = (filter: string) => {
    setSelectedFilter(filter);
  };

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = (path: string) => {
    navigate(path);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F3A7A7] mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-[#F3A7A7] text-white rounded-lg hover:bg-[#F08B8B]"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#F3A7A7]" style={{ fontFamily: 'Noto Serif JP, serif' }}>
            WEBCOACH
          </h1>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-md">
              <Bell className="w-5 h-5 text-gray-400" />
            </button>
            <div
              className="w-8 h-8 rounded-full border-2 border-[#F3A7A7] overflow-hidden cursor-pointer"
              onClick={() => navigate('/profile')}
            >
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username || 'User')}&background=F3A7A7&color=fff`}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
          <button
            onClick={() => handleBreadcrumbClick('/mypage')}
            className="hover:text-gray-700"
          >
            ホーム
          </button>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-700">
            バッジ画面
          </span>
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div>
              <h2
                className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2"
              >
                BADGE COLLECTION
              </h2>
              <p className="text-gray-600">
                学びの証を集めて、スキルを証明しましょう
              </p>
            </div>
            <div className="flex sm:flex-col sm:text-right gap-6 sm:gap-0">
              <div>
                <div className="text-sm text-gray-500 mb-1">獲得数</div>
                <div className="text-2xl font-bold text-[#F3A7A7] sm:mb-2">
                  {badgeStats.earned}
                  <span className="text-base text-gray-400">/{badgeStats.total}</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">ランク</div>
                <div className="text-xl font-bold text-yellow-600">
                  {badgeStats.rank}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <FilterTab filters={filters} selectedFilter={selectedFilter} onFilterClick={handleFilterClick} />

        {/* Badge Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {filteredBadges.map((badge) => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              onClick={() => {
                // TODO: Show badge detail modal
                showToast(`${badge.name}の詳細表示は準備中です`);
              }}
            />
          ))}
        </div>

        {/* Empty state */}
        {filteredBadges.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500">
              該当するバッジがありません
            </p>
          </div>
        )}
      </main>

    </div>
  );
}

export default BadgesPage;
