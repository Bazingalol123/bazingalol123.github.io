// Lists service - CRUD operations for shopping lists
import { sb } from '../api/supabase.js';
import { state } from '../store/state.js';
import { showMessage, showLoading, hideLoading } from '../utils/helpers.js';
import { currentUser } from './auth.js';

// Group color palette from UX design (section 4.1)
export const GROUP_COLORS = [
  { value: '#8B5CF6', name: 'סגול', emoji: '🟣' },
  { value: '#10B981', name: 'ירוק', emoji: '🟢' },
  { value: '#3B82F6', name: 'כחול', emoji: '🔵' },
  { value: '#F59E0B', name: 'כתום', emoji: '🟠' },
  { value: '#EF4444', name: 'אדום', emoji: '🔴' },
  { value: '#EC4899', name: 'ורוד', emoji: '🩷' },
  { value: '#6366F1', name: 'אינדיגו', emoji: '🔮' },
  { value: '#14B8A6', name: 'טורקיז', emoji: '🩵' }
];

/**
 * Load all lists for the current user
 */
export async function loadLists() {
  if (!currentUser) return;
  
  const { data, error } = await sb
    .from('lists')
    .select(`id, name, created_by, list_members!inner(user_id, role, profiles(display_name, avatar_emoji)), items(count)`)
    .order('created_at', { ascending: true });

  if (error) {
    showMessage('שגיאה בטעינת רשימות: ' + error.message, true);
    return;
  }

  state.lists = (data || []).map(l => ({
    id: l.id,
    name: l.name,
    itemCount: l.items?.[0]?.count ?? 0,
    members: (l.list_members || []).map(m => ({
      userId: m.user_id,
      role: m.role,
      displayName: m.profiles?.display_name || '',
      avatar: m.profiles?.avatar_emoji || '👤'
    }))
  }));
  
  // Set current list if not set
  if (!state.currentListId && state.lists.length > 0) {
    state.currentListId = state.lists[0].id;
  }
}

/**
 * Create a new list
 * @param {string} name - List name
 * @returns {string} New list ID
 */
export async function createList(name) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    showMessage('יש להתחבר קודם.', true);
    return;
  }
  
  showLoading();
  try {
    const newListId = crypto.randomUUID();
    const { error } = await sb
      .from('lists')
      .insert({ id: newListId, name, created_by: user.id });

    if (error) throw error;
    
    await loadLists();
    showMessage('רשימה נוצרה.');
    return newListId;
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
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    showMessage('יש להתחבר קודם.', true);
    return;
  }

  showLoading();
  try {
    // Create new list
    const newListId = crypto.randomUUID();
    const { error: createError } = await sb
      .from('lists')
      .insert({ id: newListId, name: newName, created_by: user.id });
    
    if (createError) throw createError;

    // Copy items from source list
    const { data: sourceItems, error: fetchError } = await sb
      .from('items')
      .select('name, quantity, category, notes, price, image')
      .eq('list_id', listId);
    
    if (fetchError) throw fetchError;

    if (sourceItems && sourceItems.length) {
      const copies = sourceItems.map(item => ({
        list_id: newListId,
        name: item.name,
        quantity: item.quantity,
        category: item.category,
        notes: item.notes,
        price: item.price,
        image: item.image,
        added_by: user.id,
        updated_by: user.id
      }));
      
      const { error: insertError } = await sb.from('items').insert(copies);
      if (insertError) throw insertError;
    }

    await loadLists();
    showMessage('הרשימה שוכפלה.');
    return newListId;
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
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data, error } = await sb
    .from('list_invites')
    .insert({
      list_id: listId,
      created_by: user.id,
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
 * Load responsibility groups for the current list with item counts
 */
export async function loadResponsibilityGroups() {
  if (!state.currentListId) return [];
  
  try {
    const { data, error } = await sb
      .from('responsibility_groups')
      .select(`
        id, label, color,
        responsibility_group_members(user_id, profiles(display_name, avatar_emoji))
      `)
      .eq('list_id', state.currentListId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    // Get item counts for each group
    const groups = data || [];
    for (const group of groups) {
      const { count, error: countError } = await sb
        .from('items')
        .select('id', { count: 'exact', head: true })
        .eq('list_id', state.currentListId)
        .eq('responsible_group_id', group.id);
      
      group.assignedItemsCount = countError ? 0 : count || 0;
    }
    
    return groups;
  } catch (error) {
    console.error('[loadResponsibilityGroups] Error:', error);
    return [];
  }
}

/**
 * Get next available color from palette
 * @param {Array} existingGroups - Existing groups to avoid color collision
 * @returns {string} Color hex value
 */
function getNextAvailableColor(existingGroups = []) {
  const usedColors = new Set(existingGroups.map(g => g.color).filter(Boolean));
  const availableColor = GROUP_COLORS.find(c => !usedColors.has(c.value));
  return availableColor ? availableColor.value : GROUP_COLORS[0].value;
}

/**
 * Create a responsibility group
 * @param {string} label - Group label
 * @param {string} color - Optional color (auto-assigned if not provided)
 * @returns {string} New group ID
 */
export async function createResponsibilityGroup(label, color = null) {
  if (!state.currentListId) {
    throw new Error('אין רשימה פעילה');
  }
  
  try {
    // Load existing groups to auto-assign color
    const existingGroups = await loadResponsibilityGroups();
    const finalColor = color || getNextAvailableColor(existingGroups);
    
    const { data, error } = await sb
      .from('responsibility_groups')
      .insert({
        list_id: state.currentListId,
        label,
        color: finalColor
      })
      .select('id')
      .single();
    
    if (error) throw error;
    showMessage('קבוצה נוצרה בהצלחה');
    return data.id;
  } catch (error) {
    console.error('[createResponsibilityGroup] Error:', error);
    showMessage('שגיאה ביצירת קבוצה: ' + error.message, true);
    throw error;
  }
}

/**
 * Update a responsibility group
 * @param {string} groupId - Group ID
 * @param {Object} updates - Updates object (label, color)
 */
export async function updateResponsibilityGroup(groupId, updates) {
  try {
    const { error } = await sb
      .from('responsibility_groups')
      .update(updates)
      .eq('id', groupId);
    
    if (error) throw error;
    showMessage('הקבוצה עודכנה');
  } catch (error) {
    console.error('[updateResponsibilityGroup] Error:', error);
    showMessage('שגיאה בעדכון קבוצה: ' + error.message, true);
    throw error;
  }
}

/**
 * Get all members of a list (users who have access)
 * @param {string} listId - List ID
 * @returns {Array} List members with profile data
 */
export async function getListMembers(listId) {
  try {
    const { data, error } = await sb
      .from('list_members')
      .select(`
        user_id,
        role,
        profiles(id, display_name, avatar_emoji)
      `)
      .eq('list_id', listId);
    
    if (error) throw error;
    
    return (data || []).map(member => ({
      userId: member.user_id,
      role: member.role,
      displayName: member.profiles?.display_name || 'משתמש',
      avatarEmoji: member.profiles?.avatar_emoji || '👤'
    }));
  } catch (error) {
    console.error('[getListMembers] Error:', error);
    showMessage('שגיאה בטעינת חברי הרשימה: ' + error.message, true);
    return [];
  }
}

/**
 * Add a member to a responsibility group
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID to add
 */
export async function addGroupMember(groupId, userId) {
  try {
    const { error } = await sb
      .from('responsibility_group_members')
      .insert({
        group_id: groupId,
        user_id: userId
      });
    
    if (error) {
      // Check for duplicate
      if (error.code === '23505') {
        showMessage('המשתמש כבר חבר בקבוצה', true);
        return false;
      }
      throw error;
    }
    
    showMessage('חבר נוסף לקבוצה');
    return true;
  } catch (error) {
    console.error('[addGroupMember] Error:', error);
    showMessage('שגיאה בהוספת חבר: ' + error.message, true);
    return false;
  }
}

/**
 * Remove a member from a responsibility group
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID to remove
 */
export async function removeGroupMember(groupId, userId) {
  try {
    const { error } = await sb
      .from('responsibility_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);
    
    if (error) throw error;
    
    showMessage('חבר הוסר מהקבוצה');
    return true;
  } catch (error) {
    console.error('[removeGroupMember] Error:', error);
    showMessage('שגיאה בהסרת חבר: ' + error.message, true);
    return false;
  }
}

/**
 * Delete a responsibility group
 * @param {string} groupId - Group ID
 */
export async function deleteResponsibilityGroup(groupId) {
  try {
    // Check for assigned items
    const { count } = await sb
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('responsible_group_id', groupId);
    
    if (count > 0) {
      const confirmed = window.confirm(`⚠️ ${count} פריטים מוקצים יאבדו את האחראי. האם להמשיך?`);
      if (!confirmed) return false;
    }
    
    const { error } = await sb
      .from('responsibility_groups')
      .delete()
      .eq('id', groupId);
    
    if (error) throw error;
    showMessage('הקבוצה נמחקה');
    return true;
  } catch (error) {
    console.error('[deleteResponsibilityGroup] Error:', error);
    showMessage('שגיאה במחיקת קבוצה: ' + error.message, true);
    throw error;
  }
}
