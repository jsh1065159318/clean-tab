import { create } from 'zustand';
import { authService } from 'services/authService';
import { supabase } from 'services/supabaseClient';
import { supabaseConfig } from 'config/supabase';

const initialState = {
  status: supabaseConfig.isConfigured ? 'loading' : 'unconfigured',
  user: null,
  roles: [],
  error: null,
};

export const useAuth = create(() => initialState);

const setSnapshot = patch => useAuth.setState(patch);
let sessionRevision = 0;

const loadRoles = async userId => {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  if (error) throw error;
  return data.map(item => item.role);
};

const applySession = async sessionData => {
  const revision = ++sessionRevision;
  const user = sessionData?.user || sessionData?.session?.user || null;

  if (!user) {
    setSnapshot({ status: 'signed_out', user: null, roles: [], error: null });
    return;
  }

  const current = useAuth.getState();
  setSnapshot({
    status: 'authenticated',
    user,
    roles: current.user?.id === user.id ? current.roles : [],
    error: null,
  });

  try {
    const roles = await loadRoles(user.id);
    if (revision !== sessionRevision || useAuth.getState().user?.id !== user.id) return;
    setSnapshot({ roles, error: null });
  } catch (error) {
    if (revision !== sessionRevision || useAuth.getState().user?.id !== user.id) return;
    setSnapshot({ roles: [], error });
  }
};

if (supabaseConfig.isConfigured) {
  authService
    .getSession()
    .then(applySession)
    .catch(error => setSnapshot({ status: 'error', error }));

  authService.onAuthStateChange(({ session, user }) => {
    void applySession({ session, user });
  });
}

export const authStore = {
  getSnapshot: useAuth.getState,
  subscribe: useAuth.subscribe,
  refresh: async () => {
    const session = await authService.getSession();
    await applySession(session);
  },
};
