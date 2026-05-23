import { create } from 'zustand';

interface NavigationState {
  selectedCareerPath: string;
  selectedSkillId: number;
  setSelectedCareerPath: (path: string) => void;
  setSelectedSkillId: (id: number) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  selectedCareerPath: 'web-designer',
  selectedSkillId: 1,
  setSelectedCareerPath: (path: string) => set({ selectedCareerPath: path }),
  setSelectedSkillId: (id: number) => set({ selectedSkillId: id }),
}));
