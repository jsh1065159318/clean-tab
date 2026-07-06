import { useSyncExternalStore } from 'react';
import { authService } from 'services/authService';

let authState = {
  ...authService.getSession(),
  status: 'idle',
};

const listeners = new Set();

const emit = () => {
  listeners.forEach((listener) => listener());
};

export const authStore = {
  getSnapshot() {
    return authState;
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setState(patch) {
    authState = { ...authState, ...patch };
    emit();
  },

  logout() {
    authService.logout();
    authState = { user: null, accessToken: null, status: 'idle' };
    emit();
  },
};

export function useAuth() {
  return useSyncExternalStore(authStore.subscribe, authStore.getSnapshot);
}
