import { create } from 'zustand';
import { settingsService } from 'services/settingsService';

export const useSettings = create(() => settingsService.getAll());

let localEpoch = 0;

export const settingsStore = {
  getSnapshot: useSettings.getState,
  subscribe: useSettings.subscribe,
  getLocalEpoch: () => localEpoch,

  update(patch) {
    localEpoch += 1;
    useSettings.setState((current) => settingsService.saveAll({ ...current, ...patch }));
  },

  replaceFromSync(patch) {
    useSettings.setState((current) => settingsService.saveAll({ ...current, ...patch }));
  },

  reset() {
    localEpoch += 1;
    useSettings.setState(() => settingsService.reset());
  },
};
