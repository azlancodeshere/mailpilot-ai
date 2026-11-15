import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  const [clientId, setClientId] = useState(() => localStorage.getItem('mailpilot.clientId') || '');

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const { user: me } = await api.get('/auth/me');
      setUser(me);
      if (me.role === 'client') setClientId(me.clientId || '');
      return me;
    } catch {
      setToken('');
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const { token, user: me } = await api.post('/auth/login', { email, password });
    setToken(token);
    setUser(me);
    if (me.role === 'client') setClientId(me.clientId || '');
    return me;
  }, []);

  const demoLogin = useCallback(async (role) => {
    const { token, user: me } = await api.post('/auth/demo', { role });
    setToken(token);
    setUser(me);
    setClientId(me.clientId || '');
    return me;
  }, []);

  const signup = useCallback(async (name, email, password) => {
    const { token, user: me } = await api.post('/auth/signup', { name, email, password });
    setToken(token);
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    setToken('');
    setUser(null);
    setClientId('');
    localStorage.removeItem('mailpilot.clientId');
  }, []);

  const switchClient = useCallback((id) => {
    setClientId(id);
    localStorage.setItem('mailpilot.clientId', id);
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    signup,
    demoLogin,
    refresh,
    clientId: user?.role === 'client' ? user.clientId : clientId,
    switchClient,
    isAssistant: user?.role === 'assistant',
    isClient: user?.role === 'client',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
