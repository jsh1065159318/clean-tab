import { defaultSettings } from 'config/defaults';
import { storageService } from './storageService';

const SETTINGS_KEY = 'cleanTab.settings';

const mergeSettings = (settings) => ({
  ...defaultSettings,
  ...(settings || {}),
});

export const settingsService = {
  getAll() {
    return mergeSettings(storageService.getJSON(SETTINGS_KEY, {}));
  },

  saveAll(settings) {
    return storageService.setJSON(SETTINGS_KEY, mergeSettings(settings));
  },

  get(key) {
    return this.getAll()[key];
  },

  set(key, value) {
    const settings = this.getAll();
    return this.saveAll({ ...settings, [key]: value });
  },

  reset() {
    return this.saveAll(defaultSettings);
  },

  export() {
    return this.getAll();
  },

  import(settings) {
    return this.saveAll(settings);
  },
};
