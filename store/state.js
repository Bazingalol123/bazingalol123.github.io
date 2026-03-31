// Centralized application state
export const state = {
  items: [],
  filters: { search: '', status: 'all', sort: 'created_desc', responsibility: 'all' },
  lastLoadedAt: null,
  syncing: false,
  activeTab: 'home',
  lists: [],
  currentListId: null,
  responsibilityGroups: []
};

// Cache key for localStorage
export const LIST_CACHE_KEY = 'shopping_list_items_cache';

// Legacy storage keys (kept for compatibility)
export const storageKeys = {};
