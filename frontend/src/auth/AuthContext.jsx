import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/client';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  async function verifyCurrentToken(currentToken) {
    const resp = await authApi.post('/auth/verify', {}, {
      headers: { Authorization: `Bearer ${currentToken}` },
    });
    return resp.data.user;
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setUser(null);
        localStorage.removeItem('user');
        return;
      }

      setLoading(true);
      try {
        const u = await verifyCurrentToken(token);
        if (cancelled) return;
        setUser(u);
        localStorage.setItem('user', JSON.stringify(u));
      } catch (e) {
        if (cancelled) return;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login: (t) => {
        localStorage.setItem('token', t);
        setToken(t);
      },
      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      },
      refreshUser: async () => {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) return;
        const u = await verifyCurrentToken(currentToken);
        setUser(u);
        localStorage.setItem('user', JSON.stringify(u));
      },
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

