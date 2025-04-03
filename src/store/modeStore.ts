import { create } from 'zustand';

type Mode = 'grant' | 'research';

interface ModeState {
  currentMode: Mode;
  setMode: (mode: Mode) => void;
}

export const useModeStore = create<ModeState>((set) => ({
  currentMode: 'research', // default mode
  setMode: (mode) => set({ currentMode: mode }),
})); 