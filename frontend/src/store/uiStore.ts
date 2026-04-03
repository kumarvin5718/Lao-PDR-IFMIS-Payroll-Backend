import { create } from "zustand";

interface UiState {
  language: string;
  sidebarCollapsed: boolean;
  setLanguage: (lang: string) => void;
  setSidebarCollapsed: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  language: "en",
  sidebarCollapsed: false,
  setLanguage: (language) => set({ language }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
}));
