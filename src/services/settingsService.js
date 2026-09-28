import { defaultSettings } from 'config/defaults';
import { STORAGE_KEYS } from 'constants/storageKeys';
import { storageService } from './storageService';

const allowedThemes = new Set(['auto', 'light', 'dark']);
const allowedSearchEngines = new Set(['google', 'bing', 'duckduckgo']);
const allowedBackgroundModes = new Set(['gradient', 'color', 'image']);

const normalizeSettings = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    ...defaultSettings,
    theme: allowedThemes.has(value.theme) ? value.theme : defaultSettings.theme,
    greetingName: typeof value.greetingName === 'string' ? value.greetingName : '',
    searchEngine: allowedSearchEngines.has(value.searchEngine) ? value.searchEngine : defaultSettings.searchEngine,
    saveSearchHistory: typeof value.saveSearchHistory === 'boolean' ? value.saveSearchHistory : defaultSettings.saveSearchHistory,
    backgroundMode: allowedBackgroundModes.has(value.backgroundMode) ? value.backgroundMode : defaultSettings.backgroundMode,
    backgroundColor: typeof value.backgroundColor === 'string' ? value.backgroundColor : defaultSettings.backgroundColor,
    backgroundImageUrl: typeof value.backgroundImageUrl === 'string' ? value.backgroundImageUrl : '',
    showGreeting: typeof value.showGreeting === 'boolean' ? value.showGreeting : defaultSettings.showGreeting,
    showQuicklinks: typeof value.showQuicklinks === 'boolean' ? value.showQuicklinks : defaultSettings.showQuicklinks,
    version: typeof value.version === 'number' ? value.version : undefined,
  };
};

const mergeSettings = (settings) => ({
  ...defaultSettings,
  ...(settings || {}),
});

export const settingsService = {
  getAll() {
    return storageService.getValidatedJSON(STORAGE_KEYS.settings, defaultSettings, normalizeSettings);
  },

  saveAll(settings) {
    return storageService.setJSON(STORAGE_KEYS.settings, mergeSettings(settings));
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
};
