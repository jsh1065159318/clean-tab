import { create } from 'zustand';
import { authService } from 'services/authService';
import { supabaseConfig } from 'config/supabase';

const initialState = {
  status: supabaseConfig.isConfigured ? 'loading' : 'unconfigured',
  user: null,
  error: null,
};

export const useAuth = create(() => initialState);

const setSnapshot = patch => useAuth.setState(patch);

const applySession = sessionData => {
  const user = sessionData?.user || sessionData?.session?.user || null;

  if (!user) {
    setSnapshot({ status: 'signed_out', user: null, error: null });
    return;
  }

  setSnapshot({ status: 'authenticated', user, error: null });
};

if (supabaseConfig.isConfigured) {
  authService
    .getSession()
    .then(applySession)
    .catch(error => setSnapshot({ status: 'error', error }));

  authService.onAuthStateChange(({ session, user }) => {
    applySession({ session, user });
  });
}

export const authStore = {
  getSnapshot: useAuth.getState,
  subscribe: useAuth.subscribe,
  refresh: async () => {
    const session = await authService.getSession();
    applySession(session);
  },
};
