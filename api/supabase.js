export const SUPABASE_URL = 'https://bnfwqtptidjhushkaxdk.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuZndxdHB0aWRqaHVzaGtheGRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDEyMzgsImV4cCI6MjA5MDIxNzIzOH0.-_eZd6LPgvt9cCK5ncgsE0G1HId9njZw6TEGbKENf9Q';
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
