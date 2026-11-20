import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import * as auth from './api';

type AuthContextValue = {
  user: auth.User | null;
  accessToken: string | null;
  loading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {

  const [loading, setLoading] = useState(true);
  const session = useSyncExternalStore(auth.subscribeSession, auth.readSession);

  useEffect(() => {
    let active = true;
    function finishLoading() {
      if (active) setLoading(false);
    }
    auth.restoreSession().then(finishLoading, finishLoading);
    return () => { active = false; };
  }, []);

  return (
    <AuthContext.Provider value={{ ...session, loading, login: auth.login, logout: auth.logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required');
  return context;
}
