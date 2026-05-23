import { useEffect, useRef } from 'react';
import { bffClient } from '../services/bffClient';
import { useNotificationStore } from '../store/notificationStore';
import { useAuth } from '../contexts/AuthContext';

const POLL_INTERVAL = 5 * 60 * 1000; // 5分

export function useNewContentNotification() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const { lastCheckedAt, setItems } = useNotificationStore();
  const lastCheckedAtRef = useRef(lastCheckedAt);

  useEffect(() => {
    lastCheckedAtRef.current = lastCheckedAt;
  }, [lastCheckedAt]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const check = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const result = await bffClient.getNewContent(lastCheckedAtRef.current);
        if (result.count > 0) setItems(result.items);
      } catch {
        // ネットワークエラーは無視
      }
    };

    check();
    const timer = setInterval(check, POLL_INTERVAL);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [isAuthenticated, setItems]);
}
