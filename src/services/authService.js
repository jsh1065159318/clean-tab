import { request } from './apiClient';
import { storageService } from './storageService';

const TOKEN_KEY = 'cleanTab.accessToken';
const USER_KEY = 'cleanTab.user';

export const authService = {
  getSession() {
    return {
      accessToken: storageService.get(TOKEN_KEY),
      user: storageService.getJSON(USER_KEY),
    };
  },

  async login(credentials) {
    const session = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    storageService.set(TOKEN_KEY, session.accessToken);
    storageService.setJSON(USER_KEY, session.user);
    return session;
  },

  logout() {
    storageService.remove(TOKEN_KEY);
    storageService.remove(USER_KEY);
  },

  async me() {
    return request('/auth/me');
  },
};
