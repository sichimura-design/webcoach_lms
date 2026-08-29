import { Badge } from '../types/mypage';

// Moodle API Badge types
export interface MoodleBadge {
  id: number;
  name: string;
  description: string;
  badgeurl?: string;
  status?: number;
  dateissued?: number;
  courseid?: number;
}

export interface MoodleUserBadge {
  id: number;
  badgeid: number;
  userid: number;
  dateissued: number;
  uniquehash: string;
}

// Map Moodle badge to our Badge type
export function mapMoodleBadgeToLocal(
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
