/** React Query hook: `useAuth` — data fetching and cache keys. */
import { useAuthStore } from "@/store/authStore";

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const clear = useAuthStore((s) => s.clear);

  const isLoggedIn = !!accessToken;

  const hasRole = (role: string) => user?.role === role;

  return { user, accessToken, isLoggedIn, hasRole, clear };
}
