import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export const AuthContext = createContext<{
  session: Session | null;
  user: User | null;
  loading: boolean;
}>({ session: null, user: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}
