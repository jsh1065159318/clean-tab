import { useSyncExternalStore } from 'react';
import { settingsService } from 'services/settingsService';

let settings = settingsService.getAll();
const listeners = new Set();

const emit = () => {
  listeners.forEach((listener) => listener());
};

export const settingsStore = {
  getSnapshot() {
    return settings;
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  update(patch) {
    settings = settingsService.saveAll({ ...settings, ...patch });
    emit();
  },

  reset() {
    settings = settingsService.reset();
    emit();
  },
};

export function useSettings() {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.getSnapshot);
}
