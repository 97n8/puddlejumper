import { create } from 'zustand';

export const useCaseStore = create((set) => ({
  activeCaseId: null,
  setActiveCase:  (id) => set({ activeCaseId: id }),
  clearActiveCase: () => set({ activeCaseId: null }),
}));
