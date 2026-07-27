import { useState, useEffect } from 'react';
import { bffClient } from '../services/bffClient';
import { Badge } from '../types/mypage';
import { mapMoodleBadgeToLocal, MoodleBadge, MoodleUserBadge } from '../utils/badges';

export function useRecentBadges(userId: number | undefined) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    Promise.all([bffClient.getBadges(), bffClient.getUserBadges(userId)])
      .then(([moodleBadges, moodleUserBadges]) => {
        const mapped = (moodleBadges as unknown as MoodleBadge[]).map((b) =>
          mapMoodleBadgeToLocal(b, moodleUserBadges as unknown as MoodleUserBadge[])
        );
        const earned = mapped
          .filter((b) => b.earnedAt)
          .sort((a, b) => (b.earnedAt! > a.earnedAt! ? 1 : -1))
          .slice(0, 4);
        setBadges(earned);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  return { badges, loading };
}
