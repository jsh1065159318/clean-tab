import { request } from './apiClient';
import { settingsService } from './settingsService';

export const syncService = {
  async pullSettings() {
    const remoteSettings = await request('/me/settings');
    return settingsService.saveAll(remoteSettings);
  },

  async pushSettings(settings = settingsService.getAll()) {
    return request('/me/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};
