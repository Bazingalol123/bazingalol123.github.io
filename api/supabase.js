export const SUPABASE_URL = 'https://bnfwqtptidjhushkaxdk.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuZndxdHB0aWRqaHVzaGtheGRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDEyMzgsImV4cCI6MjA5MDIxNzIzOH0.-_eZd6LPgvt9cCK5ncgsE0G1HId9njZw6TEGbKENf9Q';

// DEBUG: Log Supabase availability for iOS Safari debugging
console.log('[SUPABASE] Module loading, checking window.supabase:', typeof window.supabase);

// FIX: Check if Supabase SDK is loaded before accessing it
if (typeof window.supabase === 'undefined') {
  console.error('[SUPABASE] ERROR: window.supabase is undefined! CDN script may not have loaded yet.');
  throw new Error('Supabase SDK not loaded. Please refresh the page.');
}

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

console.log('[SUPABASE] Client created successfully');
