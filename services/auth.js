// Authentication service - Supabase email/password auth
import { sb } from '../api/supabase.js';
import { state } from '../store/state.js';
import { showMessage } from '../utils/helpers.js';

// Current user state
export let currentUser = null;

/**
 * Sign up new user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} displayName - Optional display name
 */
export async function signUp(email, password, displayName = '') {
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName || email.split('@')[0]
      }
    }
  });
  if (error) throw error;
  return data;
}

/**
 * Sign in existing user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 */
export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
}

/**
 * Send password reset email
 * @param {string} email - User email
 */
export async function resetPassword(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/'
  });
  if (error) throw error;
}

/**
 * Update user password (for password reset flow)
 * @param {string} newPassword - New password
 */
export async function updatePassword(newPassword) {
  const { error } = await sb.auth.updateUser({
    password: newPassword
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
  
  const landingPage = document.getElementById('landingPage');
  const appLayout = document.getElementById('appLayout');
  const bottomNav = document.querySelector('.bottom-nav');
  const authDialog = document.getElementById('authDialog');
  const signedInPanel = document.getElementById('signedInPanel');
  const authStatusText = document.getElementById('authStatusText');

  if (!user) {
    console.log('[updateAuthUI] No user, showing landing page');
    if (landingPage) landingPage.style.display = 'flex';
    if (appLayout) appLayout.style.display = 'none';
    if (bottomNav) bottomNav.style.display = 'none';
    if (authStatusText) authStatusText.textContent = 'התחבר או הרשם כדי להתחיל.';
    return;
  }

  console.log('[updateAuthUI] Fetching profile from database for user:', user.id);
  
  // Use Promise.race to prevent hanging if the database fetch gets stuck
  let profile = null;
  let error = null;
  
  try {
    const fetchPromise = sb
      .from('profiles')
      .select('display_name, avatar_emoji')
      .eq('id', user.id)
      .single();
      
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
    );
    
    const result = await Promise.race([fetchPromise, timeoutPromise]);
    profile = result.data;
    error = result.error;
  } catch (err) {
    console.warn('[updateAuthUI] Profile fetch warning/timeout:', err.message);
    error = err;
  }
  
  console.log('[updateAuthUI] Profile fetch result - data:', profile, 'error:', error);

  if (landingPage) landingPage.style.display = 'none';
  if (appLayout) appLayout.style.display = ''; // Fallback to CSS display: grid
  if (bottomNav) bottomNav.style.display = ''; // Fallback to CSS display
  if (authDialog && authDialog.open) authDialog.close();
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
  
  // 1. Await explicit initial session check
  const { data: { session }, error } = await sb.auth.getSession();
  if (error) {
    console.error('[AUTH] Error fetching initial session:', error);
  }
  
  const initialUser = session?.user ?? null;
  console.log('[AUTH] Initial session user:', initialUser?.email || 'NO USER');
  
  try {
    await updateAuthUI(initialUser);
  } catch (err) {
    console.error('[AUTH] ERROR in initial updateAuthUI:', err);
  }
  
  if (onAuthChange) {
    try {
      await onAuthChange(initialUser);
    } catch (err) {
      console.error('[AUTH] ERROR in initial onAuthChange callback:', err);
    }
  }

  // 2. Set up listener for subsequent changes
  sb.auth.onAuthStateChange(async (event, currentSession) => {
    // Skip INITIAL_SESSION since we handled it above
    if (event === 'INITIAL_SESSION') return;

    console.log('[AUTH] onAuthStateChange fired:', event, 'user:', currentSession?.user?.email);
    const user = currentSession?.user ?? null;
    
    try {
      await updateAuthUI(user);
    } catch (error) {
      console.error('[AUTH] ERROR in updateAuthUI:', error);
    }
    
    if (onAuthChange) {
      try {
        await onAuthChange(user);
      } catch (error) {
        console.error('[AUTH] ERROR in onAuthChange callback:', error);
      }
    }
    
    if (!user) {
      sb.removeAllChannels();
    }
  });
}
