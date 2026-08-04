import { create } from 'zustand';

interface UIState {
  showWelcomeOverlay: boolean;
  openWelcomeOverlay: () => void;
  closeWelcomeOverlay: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  showWelcomeOverlay: true,
  openWelcomeOverlay: () => set({ showWelcomeOverlay: true }),
  closeWelcomeOverlay: () => set({ showWelcomeOverlay: false }),
}));
