import { endpoints } from 'config/endpoints';
import { storageService } from './storageService';

export async function request(path, options = {}) {
  if (!endpoints.apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL is not configured.');
  }

  const token = storageService.get('cleanTab.accessToken');
  const response = await fetch(`${endpoints.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json();
}
