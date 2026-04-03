import { create } from "zustand";

import type { UserOut } from "@/types/auth";

interface AuthState {
  accessToken: string | null;
  user: UserOut | null;
  setAccessToken: (token: string | null) => void;
  setUser: (user: UserOut | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  clear: () => set({ accessToken: null, user: null }),
}));
