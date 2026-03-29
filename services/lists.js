// Lists service - CRUD operations for shopping lists
import { sb } from '../api/supabase.js';
import { state } from '../store/state.js';
import { showMessage, showLoading, hideLoading } from '../utils/helpers.js';
import { currentUser } from './auth.js';

/**
 * Load all lists for the current user
 */
export async function loadLists() {
  if (!currentUser) return;
  
  const { data, error } = await sb
    .from('lists')
    .select(`id, name, created_by, list_members!inner(user_id), items(count)`)
    .order('created_at', { ascending: true });

  if (error) {
    showMessage('שגיאה בטעינת רשימות: ' + error.message, true);
    return;
  }

  state.lists = (data || []).map(l => ({
    id: l.id,
    name: l.name,
    itemCount: l.items?.[0]?.count ?? 0
  }));

  // Create default list if none exists
  if (!state.lists.length) {
    await createList('רשימת קניות');
    return;
  }
  
  // Set current list if not set
  if (!state.currentListId) {
    state.currentListId = state.lists[0].id;
  }
}

/**
 * Create a new list
 * @param {string} name - List name
 * @returns {string} New list ID
 */
export async function createList(name) {
  if (!currentUser) {
    showMessage('יש להתחבר קודם.', true);
    return;
  }
  
  showLoading();
  try {
    const { data, error } = await sb
      .from('lists')
      .insert({ name, created_by: currentUser.id })
      .select('id')
      .single();

    if (error) throw error;
    
    await loadLists();
    showMessage('רשימה נוצרה.');
    return data.id;
  } catch (e) {
    showMessage(e.message, true);
    console.error('[createList error]', e);
  } finally {
    hideLoading();
  }
}

/**
 * Rename a list
 * @param {string} listId - List ID
 * @param {string} newName - New list name
 */
export async function renameList(listId, newName) {
  showLoading();
  try {
    const { error } = await sb
      .from('lists')
      .update({ name: newName })
      .eq('id', listId);
    
    if (error) throw error;
    
    await loadLists();
    showMessage('שם הרשימה שונה.');
  } catch (e) {
    showMessage(e.message, true);
  } finally {
    hideLoading();
  }
}

/**
 * Duplicate a list
 * @param {string} listId - Source list ID
 * @param {string} newName - New list name
 */
export async function duplicateList(listId, newName) {
  showLoading();
  try {
    // Create new list
    const { data: newList, error: createError } = await sb
      .from('lists')
      .insert({ name: newName, created_by: currentUser.id })
      .select('id')
      .single();
    
    if (createError) throw createError;

    // Copy items from source list
    const { data: sourceItems, error: fetchError } = await sb
      .from('items')
      .select('name, quantity, category, notes, price, image')
      .eq('list_id', listId);
    
    if (fetchError) throw fetchError;

    if (sourceItems && sourceItems.length) {
      const copies = sourceItems.map(item => ({
        list_id: newList.id,
        name: item.name,
        quantity: item.quantity,
        category: item.category,
        notes: item.notes,
        price: item.price,
        image: item.image,
        added_by: currentUser.id,
        updated_by: currentUser.id
      }));
      
      const { error: insertError } = await sb.from('items').insert(copies);
      if (insertError) throw insertError;
    }

    await loadLists();
    showMessage('הרשימה שוכפלה.');
    return newList.id;
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    hideLoading();
  }
}

/**
 * Clear completed (purchased) items from a list
 * @param {string} listId - List ID
 */
export async function clearCompleted(listId) {
  const purchasedCount = state.items.filter(i => i.purchased).length;
  if (!purchasedCount) {
    showMessage('אין פריטים שנרכשו לניקוי.');
    return;
  }

  const prevItems = [...state.items];
  state.items = state.items.filter(i => !i.purchased);
  
  showLoading();
  try {
    const { error } = await sb
      .from('items')
      .delete()
      .eq('list_id', listId)
      .eq('purchased', true);
    
    if (error) throw error;
    
    showMessage(`${purchasedCount} פריטים נמחקו.`);
  } catch (e) {
    state.items = prevItems;
    showMessage(e.message, true);
  } finally {
    hideLoading();
  }
}

/**
 * Delete a list
 * @param {string} listId - List ID
 */
export async function deleteList(listId) {
  if (state.lists.length <= 1) {
    showMessage('אי אפשר למחוק את הרשימה האחרונה.', true);
    return;
  }

  showLoading();
  try {
    const { error } = await sb.from('lists').delete().eq('id', listId);
    if (error) throw error;
    
    await loadLists();
    
    // Switch to first list if current was deleted
    if (state.currentListId === listId && state.lists.length) {
      return state.lists[0].id; // Return new list ID to switch to
    }
    
    showMessage('הרשימה נמחקה.');
  } catch (e) {
    showMessage(e.message, true);
  } finally {
    hideLoading();
  }
}

/**
 * Generate invite QR code for a list
 * @param {string} listId - List ID
 * @returns {string} Invite URL
 */
export async function generateInviteQr(listId) {
  const { data, error } = await sb
    .from('list_invites')
    .insert({
      list_id: listId,
      created_by: currentUser.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select('token')
    .single();

  if (error) {
    showMessage(error.message, true);
    return null;
  }

  return `${window.location.origin}${window.location.pathname}?invite=${data.token}`;
}

/**
 * Check for invite token in URL and redeem it
 */
export async function checkInviteToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('invite');
  if (!token || !currentUser) return;

  // Clean URL
  window.history.replaceState({}, '', window.location.pathname);

  const { data, error } = await sb.rpc('redeem_invite', { invite_token: token });
  if (data?.ok) {
    showMessage(`הצטרפת לרשימה "${data.listName}" בהצלחה!`);
    await loadLists();
    return data.listId; // Return list ID to switch to
  } else {
    showMessage(data?.error || 'הזמנה לא תקפה.', true);
  }
}

/**
 * Load responsibility groups for the current list
 */
export async function loadResponsibilityGroups() {
  if (!state.currentListId) return;
  
  const { data, error } = await sb
    .from('responsibility_groups')
    .select(`id, label, color, responsibility_group_members(user_id, profiles(display_name, avatar_emoji))`)
    .eq('list_id', state.currentListId);

  if (!error) {
    return data || [];
  }
  return [];
}

/**
 * Create a responsibility group
 * @param {string} label - Group label
 */
export async function createResponsibilityGroup(label) {
  const { data, error } = await sb
    .from('responsibility_groups')
    .insert({ list_id: state.currentListId, label })
    .select('id')
    .single();
  
  if (error) throw error;
  return data.id;
}

/**
 * Delete a responsibility group
 * @param {string} groupId - Group ID
 */
export async function deleteResponsibilityGroup(groupId) {
  const { error } = await sb
    .from('responsibility_groups')
    .delete()
    .eq('id', groupId);
  
  if (error) throw error;
}
