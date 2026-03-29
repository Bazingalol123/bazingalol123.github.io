# Roo Code Prompt — Migrate Shopping List PWA to Supabase

## Project Overview

This is a **pure HTML/CSS/JS Progressive Web App** — no build tools, no framework, no npm. It is a Hebrew RTL shared shopping list backed by **Google Apps Script + Google Sheets**. The goal of this migration is to replace the entire backend with **Supabase**, adding:

- Magic link authentication (users identified by email)
- Real-time sync (replacing the 3-second version polling)
- Multi-household data isolation via Row Level Security
- Named identity on items ("added by Yossi")
- Responsibility groups (for trip lists — "יוסי ודנה are responsible for drinks")

The database schema and RLS policies have already been written and deployed to Supabase. Your job is to rewrite the client-side code in `app.js`, `index.html`, and `styles.css` to use Supabase instead of the Apps Script backend.

---

## Prerequisites (Already Done — Do Not Redo)

- [ ] Supabase project created
- [ ] `supabase-schema.sql` has been run in the Supabase SQL Editor
- [ ] `supabase-rls-policies.sql` has been run in the Supabase SQL Editor
- [ ] Magic link auth is enabled in Supabase Dashboard → Authentication → Providers → Email
- [ ] The following constants will be provided by the developer and must be placed at the top of `app.js`:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY'; // safe to expose in client-side code
```

---

## Constraints — Read These First

- **No build tools.** No webpack, vite, rollup, npm. Everything runs as plain static files.
- **No Hebrew string changes.** All UI text must remain in Hebrew exactly as-is.
- **No new CDN dependencies** beyond the Supabase JS client (added below).
- **Remove** the Apps Script backend entirely — no more `callApi()`, no more `apiUrl` / `sharedSecret` settings fields.
- **Preserve** all existing UI features: dark mode, shop mode, barcode scanner, QR scanner, categories view, quick-add carousel, quantity steppers, swipe actions, all dialogs.
- **Comment every changed block** with `// MIGRATION: <what and why>`.

---

## Step 0 — Add Supabase Client CDN

In `index.html`, add this script tag **before** `app.js` is loaded:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

Then at the very top of `app.js`, after the constants, initialise the client:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// MIGRATION: Replace all callApi() calls with this Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

---

## Step 1 — Auth: Replace Settings Tab with Sign-In

### What to remove
Remove the entire **🔄 Sync tab** panel (`#panel-sync`) from `index.html` — specifically:
- The API URL input field
- The shared secret input field
- The "Save Settings", "Test Connection" buttons
- The auto-refresh select
- The QR code generator section (replaced by invite-based sharing — see Step 6)

Keep the **Push Notifications** section in the Sync tab — just remove the connection fields.

### What to add
Replace the removed fields with a sign-in section. Add this HTML inside `#panel-sync` at the top:

```html
<!-- MIGRATION: Auth section replacing Apps Script connection fields -->
<section class="card settings-card" id="authSection">
  <div class="section-head">
    <div>
      <h2>כניסה לחשבון</h2>
      <p class="muted" id="authStatusText">התחברו עם קישור קסם שנשלח לאימייל שלכם.</p>
    </div>
  </div>

  <!-- Sign-in form (shown when logged out) -->
  <div id="signInForm">
    <label class="field">
      <span>כתובת אימייל</span>
      <input id="authEmailInput" type="email" placeholder="your@email.com" autocomplete="email" />
    </label>
    <button id="sendMagicLinkBtn" class="btn-primary">שלח קישור כניסה</button>
  </div>

  <!-- Signed-in state (shown when logged in) -->
  <div id="signedInPanel" style="display:none;">
    <div class="sync-line" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <strong id="userDisplayName"></strong>
        <p class="muted" style="margin:4px 0 0; font-size:0.85rem;" id="userEmail"></p>
      </div>
      <span id="userAvatarEmoji" style="font-size:2rem;">🛒</span>
    </div>
    <label class="field" style="margin-top:16px;">
      <span>שם תצוגה</span>
      <input id="displayNameInput" type="text" placeholder="השם שלך" />
    </label>
    <div class="dialog-actions">
      <button id="saveDisplayNameBtn" class="btn-primary small-btn" style="width:auto;">שמור שם</button>
      <button id="signOutBtn" class="btn-secondary small-btn" style="width:auto;">התנתקות</button>
    </div>
  </div>
</section>
```

### Auth logic in `app.js`

Add the following auth functions:

```javascript
// ─── AUTH ─────────────────────────────────────────────────────

let currentUser = null; // Supabase User object

/**
 * Send a magic link to the given email address.
 */
async function sendMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.href
    }
  });
  if (error) throw error;
}

/**
 * Sign the current user out.
 */
async function signOut() {
  await supabase.auth.signOut();
  currentUser = null;
  state.items = [];
  state.lists = [];
  state.currentListId = null;
  renderItems();
  renderLists();
  updateAuthUI(null);
}

/**
 * Update the auth UI based on the current session.
 * @param {import('@supabase/supabase-js').User|null} user
 */
async function updateAuthUI(user) {
  currentUser = user;

  const signInForm   = document.getElementById('signInForm');
  const signedInPanel = document.getElementById('signedInPanel');
  const authStatusText = document.getElementById('authStatusText');

  if (!user) {
    signInForm.style.display    = 'block';
    signedInPanel.style.display = 'none';
    authStatusText.textContent  = 'התחברו עם קישור קסם שנשלח לאימייל שלכם.';
    return;
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_emoji')
    .eq('id', user.id)
    .single();

  signInForm.style.display    = 'none';
  signedInPanel.style.display = 'block';
  authStatusText.textContent  = 'מחובר ✓';

  document.getElementById('userDisplayName').textContent = profile?.display_name || user.email;
  document.getElementById('userEmail').textContent       = user.email;
  document.getElementById('userAvatarEmoji').textContent = profile?.avatar_emoji || '🛒';
  document.getElementById('displayNameInput').value      = profile?.display_name || '';
}

/**
 * Initialise auth: listen for session changes and handle
 * the magic link redirect (Supabase handles the token in the URL hash).
 */
function initAuth() {
  supabase.auth.onAuthStateChange(async (event, session) => {
    const user = session?.user ?? null;
    await updateAuthUI(user);

    if (user) {
      // Signed in — load lists and subscribe to real-time
      await loadLists();
      if (state.currentListId) {
        await loadItems();
        subscribeToList(state.currentListId);
      }
    } else {
      // Signed out — tear down real-time subscriptions
      supabase.removeAllChannels();
    }
  });
}
```

Bind the auth buttons in `bindEvents()`:

```javascript
// MIGRATION: Auth button bindings
document.getElementById('sendMagicLinkBtn')?.addEventListener('click', async () => {
  const email = document.getElementById('authEmailInput').value.trim();
  if (!email) return showMessage('נא להזין כתובת אימייל.', true);
  try {
    await sendMagicLink(email);
    showMessage('קישור כניסה נשלח לאימייל שלך! בדוק את תיבת הדואר.');
  } catch (err) {
    showMessage(err.message, true);
  }
});

document.getElementById('signOutBtn')?.addEventListener('click', signOut);

document.getElementById('saveDisplayNameBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('displayNameInput').value.trim();
  if (!name || !currentUser) return;
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name })
    .eq('id', currentUser.id);
  if (error) { showMessage(error.message, true); return; }
  showMessage('השם עודכן.');
  await updateAuthUI(currentUser);
});
```

Call `initAuth()` at the end of `boot()` instead of the `getConfig().apiUrl` block.

---

## Step 2 — Replace `callApi()` with Supabase Queries

Remove the entire `callApi()`, `handleResponse()`, `requireApiUrl()`, `getConfig()`, `setConfig()`, and `hydrateSettings()` functions.

Replace each action with a direct Supabase query:

### `getLists` → `loadLists()`

```javascript
async function loadLists() {
  if (!currentUser) return;
  const { data, error } = await supabase
    .from('lists')
    .select(`
      id,
      name,
      created_by,
      list_members!inner(user_id),
      items(count)
    `)
    .order('created_at', { ascending: true });

  if (error) { showMessage('שגיאה בטעינת רשימות: ' + error.message, true); return; }

  state.lists = (data || []).map(l => ({
    id: l.id,
    name: l.name,
    itemCount: l.items?.[0]?.count ?? 0
  }));

  if (!state.lists.length) {
    await createList('רשימת קניות');
    return;
  }
  if (!state.currentListId) state.currentListId = state.lists[0].id;
  renderLists();
}
```

### `list` → `loadItems()`

```javascript
async function loadItems(showSuccess = false, { silent = false } = {}) {
  if (!currentUser || !state.currentListId) return;
  if (!silent) showLoading();

  const { data, error } = await supabase
    .from('items')
    .select(`
      id,
      name,
      quantity,
      category,
      notes,
      purchased,
      price,
      image,
      created_at,
      updated_at,
      added_by,
      updated_by,
      responsible_group_id,
      adder:profiles!added_by(display_name, avatar_emoji),
      updater:profiles!updated_by(display_name, avatar_emoji),
      responsible_group:responsibility_groups(id, label, color)
    `)
    .eq('list_id', state.currentListId)
    .order('created_at', { ascending: false });

  if (!silent) hideLoading();

  if (error) { showMessage(error.message, true); return; }

  state.items = (data || []).map(row => ({
    rowId:              row.id,
    name:               row.name,
    quantity:           row.quantity,
    category:           row.category,
    notes:              row.notes,
    purchased:          row.purchased,
    price:              row.price ?? '',
    image:              row.image,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
    addedBy:            row.adder?.display_name ?? '',
    updatedBy:          row.updater?.display_name ?? '',
    responsibleGroup:   row.responsible_group ?? null
  }));

  // Cache for instant cold start (from optimization PR)
  try {
    localStorage.setItem(LIST_CACHE_KEY, JSON.stringify({
      items: state.items,
      listId: state.currentListId,
      cachedAt: Date.now()
    }));
  } catch(e) {}

  state.lastLoadedAt = new Date().toISOString();
  renderItems();
  renderQuickAddCarousel();
  if (state.activeTab === 'categories') renderCategories();
  if (showSuccess) showMessage('הרשימה נטענה בהצלחה.');
}
```

### `add` → `addItem()` / `quickAddItem()`

```javascript
async function addItemToSupabase(payload) {
  const { data, error } = await supabase
    .from('items')
    .insert({
      list_id:   state.currentListId,
      name:      payload.name,
      quantity:  payload.quantity || '1',
      category:  payload.category || '',
      notes:     payload.notes || '',
      price:     payload.price ? parseFloat(payload.price) : null,
      image:     payload.image || '',
      added_by:  currentUser.id,
      updated_by: currentUser.id
    })
    .select('id')
    .single();

  if (error) throw error;
  return { rowId: data.id };
}
```

### `toggle` → `toggleItem()`

```javascript
async function toggleItem(rowId, purchased) {
  const previous = state.items.find(i => i.rowId === rowId)?.purchased;
  optimisticSet(rowId, { purchased });
  const { error } = await supabase
    .from('items')
    .update({ purchased, updated_by: currentUser.id })
    .eq('id', rowId);
  if (error) {
    optimisticSet(rowId, { purchased: previous });
    showMessage(error.message, true);
  }
}
```

### `update` → `saveEditedItem()`

```javascript
async function updateItemInSupabase(patch) {
  const { error } = await supabase
    .from('items')
    .update({
      name:       patch.name,
      quantity:   patch.quantity,
      category:   patch.category,
      notes:      patch.notes,
      price:      patch.price ? parseFloat(patch.price) : null,
      image:      patch.image || '',
      updated_by: currentUser.id
    })
    .eq('id', patch.rowId);
  if (error) throw error;
}
```

### `delete` → `deleteItem()`

```javascript
async function deleteItemFromSupabase(rowId) {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', rowId);
  if (error) throw error;
}
```

### `createList` / `renameList` / `deleteList` / `duplicateList` / `clearCompleted`

```javascript
async function createList(name) {
  showLoading();
  try {
    const { data, error } = await supabase
      .from('lists')
      .insert({ name, created_by: currentUser.id })
      .select('id')
      .single();
    if (error) throw error;
    await loadLists();
    await switchList(data.id);
    showMessage('רשימה נוצרה.');
  } catch(e) { showMessage(e.message, true); }
  finally { hideLoading(); }
}

async function renameList(listId, currentName) {
  const newName = await showPromptDialog('שינוי שם רשימה', 'שם חדש לרשימה', currentName);
  if (!newName) return;
  showLoading();
  try {
    const { error } = await supabase.from('lists').update({ name: newName }).eq('id', listId);
    if (error) throw error;
    await loadLists();
    showMessage('שם הרשימה שונה.');
  } catch(e) { showMessage(e.message, true); }
  finally { hideLoading(); }
}

async function deleteListAction(listId, listName) {
  if (state.lists.length <= 1) { showMessage('אי אפשר למחוק את הרשימה האחרונה.', true); return; }
  const confirmed = await showConfirmDialog('מחיקת רשימה', `האם למחוק את הרשימה "${listName}"?`);
  if (!confirmed) return;
  showLoading();
  try {
    const { error } = await supabase.from('lists').delete().eq('id', listId);
    if (error) throw error;
    await loadLists();
    if (state.currentListId === listId && state.lists.length) {
      await switchList(state.lists[0].id);
    }
    showMessage('הרשימה נמחקה.');
  } catch(e) { showMessage(e.message, true); }
  finally { hideLoading(); }
}

async function clearCompleted(listId) {
  const purchasedCount = state.items.filter(i => i.purchased).length;
  if (!purchasedCount) { showMessage('אין פריטים שנרכשו לניקוי.'); return; }
  const confirmed = await showConfirmDialog('ניקוי', `למחוק ${purchasedCount} פריטים שנקנו?`);
  if (!confirmed) return;
  const prevItems = [...state.items];
  state.items = state.items.filter(i => !i.purchased);
  renderItems();
  showLoading();
  try {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('list_id', listId)
      .eq('purchased', true);
    if (error) throw error;
    showMessage(`${purchasedCount} פריטים נמחקו.`);
  } catch(e) { state.items = prevItems; renderItems(); showMessage(e.message, true); }
  finally { hideLoading(); }
}
```

---

## Step 3 — Replace Version Polling with Real-Time Subscriptions

Remove `checkVersionAndSync()`, `setAutoRefresh()`, `adaptPollingRate()`, and `state.syncTimer`.

Remove the auto-refresh select element from the Sync tab UI.

Add a real-time subscription system:

```javascript
// MIGRATION: Replace polling with Supabase real-time subscriptions
let realtimeChannel = null;

function subscribeToList(listId) {
  // Unsubscribe from any previous list
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  realtimeChannel = supabase
    .channel(`list-${listId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` },
      (payload) => {
        handleRealtimeItemChange(payload);
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setSyncChip('סנכרון חי ✓', 'connected');
      } else if (status === 'CHANNEL_ERROR') {
        setSyncChip('שגיאת סנכרון', 'disconnected');
      }
    });
}

function handleRealtimeItemChange(payload) {
  const { eventType, new: newRow, old: oldRow } = payload;

  if (eventType === 'INSERT') {
    // Don't duplicate if we already have this item optimistically
    if (state.items.find(i => i.rowId === newRow.id)) return;
    state.items = [mapRowToItem(newRow), ...state.items];
  } else if (eventType === 'UPDATE') {
    state.items = state.items.map(i =>
      i.rowId === newRow.id ? { ...i, ...mapRowToItem(newRow) } : i
    );
  } else if (eventType === 'DELETE') {
    state.items = state.items.filter(i => i.rowId !== oldRow.id);
  }

  renderItems();
  renderQuickAddCarousel();
  if (state.activeTab === 'categories') renderCategories();
  setSyncChip('מסונכרן', 'connected');
}

// Map a raw Supabase items row to the app's internal item shape
function mapRowToItem(row) {
  return {
    rowId:            row.id,
    name:             row.name,
    quantity:         row.quantity,
    category:         row.category,
    notes:            row.notes,
    purchased:        row.purchased,
    price:            row.price ?? '',
    image:            row.image,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
    addedBy:          row.added_by ?? '',
    updatedBy:        row.updated_by ?? '',
    responsibleGroup: null  // fetched separately when needed
  };
}
```

In `switchList()`, call `subscribeToList(listId)` after loading items.

In `bindEvents()`, replace the visibility change / focus handlers:

```javascript
// MIGRATION: No more polling — just reload on visibility change
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentUser && state.currentListId) {
    loadItems(false, { silent: true });
  }
});
```

---

## Step 4 — Responsibility Groups UI

### In `index.html`

Add a responsibility group selector to both the **Add Item** dialog and the **Edit Item** dialog, after the category select:

```html
<label class="field">
  <span>אחראי</span>
  <select name="responsibleGroup" id="addResponsibleGroup">
    <option value="">ללא אחראי</option>
    <!-- Options populated dynamically by renderResponsibilityOptions() -->
  </select>
</label>
```

Add a **"Manage Responsibilities"** section inside the list actions dialog:

```html
<button id="listActionManageGroups" class="list-action-btn">
  <span class="action-icon">👥</span>
  <span>ניהול אחריות</span>
</button>
```

Add a manage-groups dialog:

```html
<dialog id="manageGroupsDialog" class="app-dialog">
  <div class="dialog-content">
    <h3>ניהול אחריות</h3>
    <p class="muted">הגדר מי אחראי לאילו פריטים</p>
    <div id="groupsList"></div>
    <button id="addGroupBtn" class="btn-secondary" style="margin-top:16px;">+ הוסף קבוצה</button>
    <button id="closeManageGroupsBtn" class="btn-secondary" style="margin-top:8px;">סגירה</button>
  </div>
</dialog>
```

### In `app.js`

```javascript
// ─── RESPONSIBILITY GROUPS ────────────────────────────────────

let cachedGroups = []; // responsibility_groups for current list

async function loadResponsibilityGroups() {
  if (!state.currentListId) return;
  const { data, error } = await supabase
    .from('responsibility_groups')
    .select(`
      id, label, color,
      responsibility_group_members(
        user_id,
        profiles(display_name, avatar_emoji)
      )
    `)
    .eq('list_id', state.currentListId);

  if (!error) {
    cachedGroups = data || [];
    renderResponsibilityOptions();
  }
}

function renderResponsibilityOptions() {
  ['addResponsibleGroup', 'editResponsibleGroup'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = '<option value="">ללא אחראי</option>';
    cachedGroups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.label;
      el.appendChild(opt);
    });
    el.value = current;
  });
}

async function createResponsibilityGroup(label) {
  const { data, error } = await supabase
    .from('responsibility_groups')
    .insert({ list_id: state.currentListId, label })
    .select('id')
    .single();
  if (error) throw error;
  await loadResponsibilityGroups();
  return data.id;
}

async function deleteResponsibilityGroup(groupId) {
  const { error } = await supabase
    .from('responsibility_groups')
    .delete()
    .eq('id', groupId);
  if (error) throw error;
  await loadResponsibilityGroups();
}

function renderManageGroupsDialog() {
  const container = document.getElementById('groupsList');
  if (!container) return;
  container.innerHTML = '';

  if (!cachedGroups.length) {
    container.innerHTML = '<p class="muted" style="text-align:center;">אין קבוצות עדיין.</p>';
    return;
  }

  cachedGroups.forEach(group => {
    const members = group.responsibility_group_members || [];
    const memberNames = members.map(m => m.profiles?.display_name ?? '').filter(Boolean).join(', ');

    const row = document.createElement('div');
    row.className = 'sync-line';
    row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;';
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(group.label)}</strong>
        ${memberNames ? `<p class="muted" style="margin:2px 0 0; font-size:0.8rem;">${escapeHtml(memberNames)}</p>` : ''}
      </div>
      <button class="delete-btn" data-group-id="${group.id}" title="מחק קבוצה">🗑</button>
    `;
    row.querySelector('.delete-btn').addEventListener('click', async () => {
      const confirmed = await showConfirmDialog('מחיקת קבוצה', `למחוק את "${group.label}"?`);
      if (confirmed) {
        await deleteResponsibilityGroup(group.id);
        renderManageGroupsDialog();
      }
    });
    container.appendChild(row);
  });
}
```

Bind the manage-groups buttons in `bindEvents()`:

```javascript
document.getElementById('listActionManageGroups')?.addEventListener('click', async () => {
  els.listActionsDialog.close();
  await loadResponsibilityGroups();
  renderManageGroupsDialog();
  document.getElementById('manageGroupsDialog')?.showModal();
});

document.getElementById('addGroupBtn')?.addEventListener('click', async () => {
  const label = await showPromptDialog('קבוצה חדשה', 'שם הקבוצה (למשל: יוסי ודנה)', '');
  if (!label) return;
  await createResponsibilityGroup(label);
  renderManageGroupsDialog();
});

document.getElementById('closeManageGroupsBtn')?.addEventListener('click', () => {
  document.getElementById('manageGroupsDialog')?.close();
});
```

### Render responsibility badge on each item card

In `renderItems()`, after rendering the category badge, add:

```javascript
// MIGRATION: Show responsibility group badge if assigned
const respBadge = node.querySelector('.item-responsibility');
if (item.responsibleGroup) {
  respBadge.textContent = `👤 ${item.responsibleGroup.label}`;
  respBadge.style.display = 'inline-flex';
  respBadge.style.background = item.responsibleGroup.color + '22';
  respBadge.style.color = item.responsibleGroup.color;
} else {
  respBadge.style.display = 'none';
}
```

Add the `.item-responsibility` span to the item template in `index.html`:

```html
<span class="item-responsibility meta-pill" style="display:none;"></span>
```

Add a CSS rule in `styles.css`:

```css
.item-responsibility {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid currentColor;
}
```

---

## Step 5 — Show "Added By" Attribution on Items

In the item template in `index.html`, add after `.item-date`:

```html
<span class="item-added-by meta-pill"></span>
```

In `renderItems()` in `app.js`, populate it:

```javascript
const addedByEl = node.querySelector('.item-added-by');
if (item.addedBy) {
  addedByEl.textContent = `נוסף ע״י ${item.addedBy}`;
} else {
  addedByEl.remove();
}
```

---

## Step 6 — Replace QR Share with Invite Token System

Remove the old QR share code that embedded the Apps Script URL + shared secret.

Replace with invite token generation:

```javascript
// MIGRATION: Generate a Supabase invite token instead of sharing the Apps Script URL
async function generateInviteQr(listId) {
  const { data, error } = await supabase
    .from('list_invites')
    .insert({
      list_id:    listId,
      created_by: currentUser.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select('token')
    .single();

  if (error) { showMessage(error.message, true); return; }

  // The QR encodes the app URL with the invite token as a query param
  const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${data.token}`;

  els.showQrContainer.innerHTML = '';
  new QRCode(els.showQrContainer, {
    text: inviteUrl,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
  els.showQrDialog.showModal();
}
```

In `boot()`, check for an invite token in the URL and redeem it after auth:

```javascript
// MIGRATION: Handle invite token from QR scan redirect
async function checkInviteToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('invite');
  if (!token || !currentUser) return;

  // Clean the URL
  window.history.replaceState({}, '', window.location.pathname);

  const { data, error } = await supabase.rpc('redeem_invite', { invite_token: token });
  if (data?.ok) {
    showMessage(`הצטרפת לרשימה "${data.listName}" בהצלחה!`);
    await loadLists();
    await switchList(data.listId);
  } else {
    showMessage(data?.error || 'הזמנה לא תקפה.', true);
  }
}
```

Call `checkInviteToken()` inside `initAuth()` after the user is confirmed signed-in.

---

## Step 7 — Update `boot()`

Replace the current `boot()` function with:

```javascript
function boot() {
  // Apply cached items instantly (zero-flicker cold start)
  hydrateFromCache();

  bindEvents();
  initFilterToggle();
  initQuickAddToggle();
  switchTab('home');

  // Start auth — this drives everything else (loadLists, loadItems, realtime)
  initAuth();
}
```

Remove all references to `getConfig()`, `setConfig()`, `hydrateSettings()`, `requireApiUrl()`.

---

## Step 8 — Remove Apps Script References

Search the entire codebase for the following and remove every occurrence:

- `callApi(`
- `handleResponse(`
- `requireApiUrl(`
- `getConfig(`
- `setConfig(`
- `hydrateSettings(`
- `checkVersionAndSync(`
- `adaptPollingRate(`
- `setAutoRefresh(`
- `state.syncTimer`
- `state.remoteVersion`
- `storageKeys.apiUrl`
- `storageKeys.sharedSecret`
- `storageKeys.autoRefresh`
- `els.apiUrl`
- `els.sharedSecret`
- `els.saveSettingsBtn`
- `els.testConnectionBtn`
- `els.autoRefreshSelect`

---

## Verification Checklist

After all steps are applied, confirm:

- [ ] Supabase CDN script tag is present in `index.html` before `app.js`
- [ ] `SUPABASE_URL` and `SUPABASE_ANON_KEY` constants are set at top of `app.js`
- [ ] Magic link sign-in UI renders in the Sync tab
- [ ] Signing in with a valid email sends a magic link (check Supabase Auth logs)
- [ ] After clicking the magic link, the user is shown as signed in
- [ ] Lists load from Supabase after sign-in
- [ ] Adding an item writes to the `items` table in Supabase
- [ ] Toggling an item updates `purchased` in Supabase
- [ ] A second browser tab / device sees changes in real-time without refreshing
- [ ] `callApi()` no longer exists anywhere in `app.js`
- [ ] No Hebrew strings were changed
- [ ] No new CDN dependencies were added beyond Supabase
- [ ] Responsibility groups can be created and assigned to items
- [ ] Item cards show "נוסף ע״י [name]" attribution
- [ ] QR share generates an invite URL (not the Apps Script URL)
- [ ] Scanning the QR and signing in joins the correct list
- [ ] `apps-script/Code.gs` is no longer referenced anywhere in the frontend
