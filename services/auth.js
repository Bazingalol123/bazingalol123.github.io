// Authentication service - Supabase magic link auth
import { sb } from '../api/supabase.js';
import { state } from '../store/state.js';
import { showMessage } from '../utils/helpers.js';

// Current user state
export let currentUser = null;

/**
 * Send magic link to email for passwordless authentication
 * @param {string} email - User email
 */
export async function sendMagicLink(email) {
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href }
  });
  if (error) throw error;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  await sb.auth.signOut();
  currentUser = null;
  state.items = [];
  state.lists = [];
  state.currentListId = null;
}

/**
 * Update auth UI based on user state
 * @param {Object|null} user - Supabase user object
 */
export async function updateAuthUI(user) {
  console.log('[updateAuthUI] START, user:', user?.email);
  currentUser = user;
  const signInForm = document.getElementById('signInForm');
  const signedInPanel = document.getElementById('signedInPanel');
  const authStatusText = document.getElementById('authStatusText');

  if (!user) {
    console.log('[updateAuthUI] No user, showing sign-in form');
    if (signInForm) signInForm.style.display = 'block';
    if (signedInPanel) signedInPanel.style.display = 'none';
    if (authStatusText) authStatusText.textContent = 'התחברו עם קישור קסם שנשלח לאימייל שלכם.';
    return;
  }

  console.log('[updateAuthUI] Fetching profile from database for user:', user.id);
  const { data: profile, error } = await sb
    .from('profiles')
    .select('display_name, avatar_emoji')
    .eq('id', user.id)
    .single();
  
  console.log('[updateAuthUI] Profile fetch result - data:', profile, 'error:', error);

  if (signInForm) signInForm.style.display = 'none';
  if (signedInPanel) signedInPanel.style.display = 'block';
  if (authStatusText) authStatusText.textContent = 'מחובר ✓';

  const userDisplayName = document.getElementById('userDisplayName');
  const userEmail = document.getElementById('userEmail');
  const userAvatarEmoji = document.getElementById('userAvatarEmoji');
  const displayNameInput = document.getElementById('displayNameInput');

  if (userDisplayName) userDisplayName.textContent = profile?.display_name || user.email;
  if (userEmail) userEmail.textContent = user.email;
  if (userAvatarEmoji) userAvatarEmoji.textContent = profile?.avatar_emoji || '🛒';
  if (displayNameInput) displayNameInput.value = profile?.display_name || '';
  
  console.log('[updateAuthUI] COMPLETE');
}

/**
 * Update user display name
 * @param {string} name - New display name
 */
export async function updateDisplayName(name) {
  if (!name || !currentUser) return;
  const { error } = await sb
    .from('profiles')
    .update({ display_name: name })
    .eq('id', currentUser.id);
  if (error) throw error;
  await updateAuthUI(currentUser);
}

/**
 * Initialize authentication - set up auth state listener
 * @param {Function} onAuthChange - Callback for auth state changes
 */
export async function initAuth(onAuthChange) {
  console.log('[AUTH] initAuth called');
  
  // Set up listener for future auth state changes
  sb.auth.onAuthStateChange(async (event, session) => {
    console.log('[AUTH] onAuthStateChange fired:', event, 'user:', session?.user?.email);
    console.log('[AUTH] onAuthChange exists?', typeof onAuthChange, !!onAuthChange);
    const user = session?.user ?? null;
    
    try {
      console.log('[AUTH] About to call updateAuthUI...');
      await updateAuthUI(user);
      console.log('[AUTH] updateAuthUI completed');
    } catch (error) {
      console.error('[AUTH] ERROR in updateAuthUI:', error);
    }
    
    console.log('[AUTH] Checking if onAuthChange exists:', !!onAuthChange);
    if (onAuthChange) {
      try {
        console.log('[AUTH] Calling onAuthChange callback with user:', user?.email);
        await onAuthChange(user);
        console.log('[AUTH] onAuthChange callback completed');
      } catch (error) {
        console.error('[AUTH] ERROR in onAuthChange callback:', error);
      }
    } else {
      console.error('[AUTH] ERROR: onAuthChange callback is missing!');
    }
    
    if (!user) {
      sb.removeAllChannels();
    }
  });
  
  // CRITICAL FIX: Check for existing session on initialization
  console.log('[AUTH] Checking for existing session...');
  const { data: { session } } = await sb.auth.getSession();
  console.log('[AUTH] getSession result:', session?.user?.email || 'NO USER');
  
  if (session?.user) {
    console.log('[AUTH] Found existing session, calling updateAuthUI and callback');
    await updateAuthUI(session.user);
    if (onAuthChange) {
      console.log('[AUTH] Calling onAuthChange callback with existing user');
      await onAuthChange(session.user);
    }
  } else {
    console.log('[AUTH] No existing session found');
  }
}
