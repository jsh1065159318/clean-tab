const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export const backendConfig = {
  baseUrl,
  isConfigured: Boolean(baseUrl),
};
