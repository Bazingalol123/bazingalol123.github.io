import { sb } from './api/supabase.js';
async function test() {
  console.log("Starting test");
  const { data: { session } } = await sb.auth.getSession();
  console.log("Session:", session?.user?.id);
  if (session?.user) {
    console.log("Fetching profile...");
    const res = await sb.from('profiles').select('display_name, avatar_emoji').eq('id', session.user.id).single();
    console.log("Result:", res);
  }
}
test().catch(console.error);
