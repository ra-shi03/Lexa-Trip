import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokens, onUnauthorized, endSession, TOKEN_KEYS } from '../lib/api';
import { syncPush } from '../lib/push';

/**
 * Three independent sessions (guest user, vendor, admin) so one browser can be
 * logged into the guest app and a panel at the same time during testing.
 */
const Ctx = createContext(null);
const ME = { user: '/auth/user/me', vendor: '/auth/vendor/me', admin: '/auth/admin/me' };

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, vendor: null, admin: null });
  const [ready, setReady] = useState({ user: false, vendor: false, admin: false });

  const loadRole = useCallback(async (role) => {
    if (!tokens.get(role)) { setReady((r) => ({ ...r, [role]: true })); return; }
    try {
      const { data } = await api.get(ME[role]);
      setState((s) => ({ ...s, [role]: data }));
      syncPush(role);
    } catch {
      tokens.clear(role);
    } finally {
      setReady((r) => ({ ...r, [role]: true }));
    }
  }, []);

  useEffect(() => {
    ['user', 'vendor', 'admin'].forEach(loadRole);
    const offUnauth = onUnauthorized((role) => setState((s) => ({ ...s, [role]: null })));
    // Other tabs: signing out there signs out here; signing in there loads the account here
    const onStorage = (e) => {
      const role = Object.keys(TOKEN_KEYS).find((r) => TOKEN_KEYS[r] === e.key);
      if (!role) return;
      if (!e.newValue) setState((s) => ({ ...s, [role]: null }));
      else if (!e.oldValue) loadRole(role);
    };
    window.addEventListener('storage', onStorage);
    return () => { offUnauth(); window.removeEventListener('storage', onStorage); };
  }, [loadRole]);

  const login = useCallback((role, token, account) => {
    tokens.set(role, token);
    setState((s) => ({ ...s, [role]: account }));
  }, []);
  const logout = useCallback((role) => {
    setState((s) => ({ ...s, [role]: null }));
    return endSession(role); // revokes the refresh token server-side + clears the cookie
  }, []);
  const refresh = useCallback((role) => loadRole(role), [loadRole]);
  const update = useCallback((role, patch) => setState((s) => ({ ...s, [role]: { ...s[role], ...patch } })), []);

  const value = useMemo(() => {
    const perms = state.admin?.effectivePermissions || [];
    return {
      ...state,
      ready,
      login,
      logout,
      refresh,
      update,
      isMaster: state.admin?.role === 'master',
      can: (...p) => state.admin?.role === 'master' || p.some((x) => perms.includes(x)),
    };
  }, [state, ready, login, logout, refresh, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
