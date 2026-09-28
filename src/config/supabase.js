const url = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  '';

export const supabaseConfig = {
  url,
  publishableKey,
  isConfigured: Boolean(url && publishableKey),
};
