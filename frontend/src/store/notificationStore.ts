import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NotificationItem {
  type: string;
  id: number;
  name: string;
  timemodified: number;
}

interface NotificationState {
  items: NotificationItem[];
  lastCheckedAt: number;
  setItems: (items: NotificationItem[]) => void;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      items: [],
      lastCheckedAt: Date.now(),
      setItems: (items) => set({ items, lastCheckedAt: Date.now() }),
      markAllRead: () => set({ items: [], lastCheckedAt: Date.now() }),
    }),
    {
      name: 'notification-store',
      partialize: (state) => ({ lastCheckedAt: state.lastCheckedAt }),
    }
  )
);
