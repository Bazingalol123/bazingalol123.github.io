// Items service - CRUD operations and realtime subscriptions
import { sb } from '../api/supabase.js';
import { state } from '../store/state.js';
import { showMessage, showLoading, hideLoading } from '../utils/helpers.js';
import { currentUser } from './auth.js';

// Realtime subscription channel
let realtimeChannel = null;

// Optimistic UI guards
let isSyncing = false;
export const qtyDebounceTimers = new Map();
export const qtyOriginalValues = new Map();

/**
 * Map Supabase row to item object
 * @param {Object} row - Database row
 * @returns {Object} Normalized item
 */
export function mapRowToItem(row) {
  return {
    rowId: row.id,
    name: row.name,
    quantity: row.quantity,
    category: row.category,
    notes: row.notes,
    purchased: row.purchased,
    price: row.price ?? '',
    image: row.image,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    addedBy: row.added_by ?? '',
    updatedBy: row.updated_by ?? '',
    responsibleGroup: null
  };
}

/**
 * Load items from Supabase for the current list
 * @param {boolean} showSuccess - Show success message
 * @param {Object} options - Options object
 * @param {boolean} options.silent - Silent mode (no spinner)
 */
export async function loadItems(showSuccess = false, { silent = false } = {}) {
  if (!currentUser || !state.currentListId) return;
  
  const loading = document.getElementById('loading');
  if (!silent) {
    loading?.classList.remove('hidden');
    showLoading();
  }
  
  try {
    const { data, error } = await sb
      .from('items')
      .select(`
        id, name, quantity, category, notes, purchased, price, image,
        created_at, updated_at, added_by, updated_by, responsible_group_id,
        adder:profiles!added_by(display_name, avatar_emoji),
        updater:profiles!updated_by(display_name, avatar_emoji),
        responsible_group:responsibility_groups(id, label, color)
      `)
      .eq('list_id', state.currentListId)
      .order('created_at', { ascending: false });

    if (error) {
      showMessage(error.message, true);
      return;
    }

    state.items = (data || []).map(row => ({
      rowId: row.id,
      name: row.name,
      quantity: row.quantity,
      category: row.category,
      notes: row.notes,
      purchased: row.purchased,
      price: row.price ?? '',
      image: row.image,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      addedBy: row.adder?.display_name || '',
      updatedBy: row.updater?.display_name || '',
      responsibleGroup: row.responsible_group
    }));

    state.lastLoadedAt = new Date().toISOString();
    
    if (showSuccess) showMessage('הרשימה נטענה בהצלחה.');
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    if (!silent) {
      hideLoading();
    }
    loading?.classList.add('hidden');
  }
}

/**
 * Silent refresh - reconcile state without UI blocking
 */
export async function silentRefresh() {
  if (isSyncing) return;
  isSyncing = true;
  try {
    await loadItems(false, { silent: true });
  } finally {
    isSyncing = false;
  }
}

/**
 * Add item to Supabase
 * @param {Object} payload - Item data
 * @returns {Object} Created item with rowId
 */
export async function addItemToSupabase(payload) {
  const responsibleGroupId = document.getElementById('addResponsibleGroup')?.value || null;
  const { data, error } = await sb
    .from('items')
    .insert({
      list_id: state.currentListId,
      name: payload.name,
      quantity: payload.quantity || '1',
      category: payload.category || '',
      notes: payload.notes || '',
      price: payload.price ? parseFloat(payload.price) : null,
      image: payload.image || '',
      added_by: currentUser.id,
      updated_by: currentUser.id,
      responsible_group_id: responsibleGroupId || null
    })
    .select('id')
    .single();
  if (error) throw error;
  return { rowId: data.id };
}

/**
 * Toggle item purchased status
 * @param {string} rowId - Item ID
 * @param {boolean} purchased - New purchased state
 */
export async function toggleItem(rowId, purchased) {
  const { error } = await sb
    .from('items')
    .update({ purchased, updated_by: currentUser.id })
    .eq('id', rowId);
  if (error) throw error;
}

/**
 * Update item in Supabase
 * @param {Object} patch - Item update data
 */
export async function updateItemInSupabase(patch) {
  const responsibleGroupId = document.getElementById('editResponsibleGroup')?.value || null;
  const { error } = await sb
    .from('items')
    .update({
      name: patch.name,
      quantity: patch.quantity,
      category: patch.category,
      notes: patch.notes,
      price: patch.price ? parseFloat(patch.price) : null,
      image: patch.image || '',
      updated_by: currentUser.id,
      responsible_group_id: responsibleGroupId || null
    })
    .eq('id', patch.rowId);
  if (error) throw error;
}

/**
 * Delete item from Supabase
 * @param {string} rowId - Item ID
 */
export async function deleteItemFromSupabase(rowId) {
  const { error } = await sb.from('items').delete().eq('id', rowId);
  if (error) throw error;
}

/**
 * Subscribe to real-time changes for a list
 * @param {string} listId - List ID
 * @param {Function} onItemChange - Callback for item changes
 * @param {Function} setSyncChip - Callback to update sync status
 */
export function subscribeToList(listId, onItemChange, setSyncChip) {
  if (realtimeChannel) {
    sb.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  realtimeChannel = sb
    .channel(`list-${listId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` },
      (payload) => { 
        if (onItemChange) onItemChange(payload); 
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

/**
 * Handle realtime item change from Supabase
 * @param {Object} payload - Realtime payload
 */
export function handleRealtimeItemChange(payload) {
  const { eventType, new: newRow, old: oldRow } = payload;

  if (eventType === 'INSERT') {
    if (state.items.find(i => i.rowId === newRow.id)) return;
    state.items = [mapRowToItem(newRow), ...state.items];
  } else if (eventType === 'UPDATE') {
    state.items = state.items.map(i =>
      i.rowId === newRow.id ? { ...i, ...mapRowToItem(newRow) } : i
    );
  } else if (eventType === 'DELETE') {
    state.items = state.items.filter(i => i.rowId !== oldRow.id);
  }
}
