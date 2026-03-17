const storageKeys = {
  apiUrl: 'shopping_list_api_url',
  sharedSecret: 'shopping_list_shared_secret',
  autoRefresh: 'shopping_list_auto_refresh'
};

const state = {
  items: [],
  filters: { search: '', status: 'all', sort: 'created_desc' },
  syncTimer: null,
  lastLoadedAt: null,
  remoteVersion: '',
  syncing: false,
  activeTab: 'list',
  lists: [],
  currentListId: null
};

const els = {
  apiUrl: document.getElementById('apiUrl'),
  sharedSecret: document.getElementById('sharedSecret'),
  toggleSecretBtn: document.getElementById('toggleSecretBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  testConnectionBtn: document.getElementById('testConnectionBtn'),
  addItemForm: document.getElementById('addItemForm'),
  addDialog: document.getElementById('addDialog'),
  openAddDialogBtn: document.getElementById('openAddDialogBtn'),
  closeAddDialogBtn: document.getElementById('closeAddDialogBtn'),
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  sortSelect: document.getElementById('sortSelect'),
  autoRefreshSelect: document.getElementById('autoRefreshSelect'),
  itemsList: document.getElementById('itemsList'),
  itemTemplate: document.getElementById('itemTemplate'),
  loading: document.getElementById('loading'),
  stats: document.getElementById('stats'),
  statusMessage: document.getElementById('statusMessage'),
  editDialog: document.getElementById('editDialog'),
  editItemForm: document.getElementById('editItemForm'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  editRowId: document.getElementById('editRowId'),
  editName: document.getElementById('editName'),
  editQuantity: document.getElementById('editQuantity'),
  editCategory: document.getElementById('editCategory'),
  editNotes: document.getElementById('editNotes'),
  editPrice: document.getElementById('editPrice'),
  editImage: document.getElementById('editImage'),
  metricTotal: document.getElementById('metricTotal'),
  metricDone: document.getElementById('metricDone'),
  metricLeft: document.getElementById('metricLeft'),
  metricPrice: document.getElementById('metricPrice'),
  connectionChip: document.getElementById('connectionChip'),
  connectionChipMirror: document.getElementById('connectionChipMirror'),
  syncChip: document.getElementById('syncChip'),
  navBtns: [...document.querySelectorAll('.nav-btn')],
  tabPanels: [...document.querySelectorAll('.tab-panel')],
  hamburgerBtn: document.getElementById('hamburgerBtn'),
  sidemenu: document.getElementById('sidemenu'),
  closeSidemenuBtn: document.getElementById('closeSidemenuBtn'),
  appBackdrop: document.getElementById('appBackdrop'),
  listsList: document.getElementById('listsList'),
  addListBtn: document.getElementById('addListBtn'),
  searchProductBtn: document.getElementById('searchProductBtn'),
  currentListName: document.getElementById('currentListName'),
  // Prompt dialog elements
  promptDialog: document.getElementById('promptDialog'),
  promptDialogTitle: document.getElementById('promptDialogTitle'),
  promptDialogInput: document.getElementById('promptDialogInput'),
  promptDialogCancel: document.getElementById('promptDialogCancel'),
  promptDialogOk: document.getElementById('promptDialogOk'),
  // List actions dialog elements
  listActionsDialog: document.getElementById('listActionsDialog'),
  listActionsTitle: document.getElementById('listActionsTitle'),
  listActionRename: document.getElementById('listActionRename'),
  listActionDuplicate: document.getElementById('listActionDuplicate'),
  listActionClear: document.getElementById('listActionClear'),
  listActionDelete: document.getElementById('listActionDelete'),
  listActionsClose: document.getElementById('listActionsClose'),
  // Categories tab elements
  categoriesList: document.getElementById('categoriesList')
};

function showLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.hidden = false;
}
function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.hidden = true;
}

function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirmDialog');
    const titleEl = document.getElementById('confirmDialogTitle');
    const messageEl = document.getElementById('confirmDialogMessage');
    const cancelBtn = document.getElementById('confirmCancel');
    const okBtn = document.getElementById('confirmOk');

    titleEl.textContent = title;
    messageEl.textContent = message;

    function cleanup() {
      cancelBtn.removeEventListener('click', onCancel);
      okBtn.removeEventListener('click', onOk);
      dialog.removeEventListener('close', onClose);
      dialog.close();
    }

    function onCancel() { cleanup(); resolve(false); }
    function onOk() { cleanup(); resolve(true); }
    function onClose() { cleanup(); resolve(false); }

    cancelBtn.addEventListener('click', onCancel);
    okBtn.addEventListener('click', onOk);
    dialog.addEventListener('close', onClose);

    dialog.showModal();
  });
}

/**
 * Reusable prompt dialog — returns Promise<string|null>.
 * Opens #promptDialog as a modal, resolves with input value on OK,
 * resolves with null on Cancel or dialog close.
 * @param {string} title - Dialog title text
 * @param {string} placeholder - Input placeholder text
 * @param {string} defaultValue - Pre-filled input value
 * @returns {Promise<string|null>}
 */
function showPromptDialog(title, placeholder, defaultValue) {
  return new Promise((resolve) => {
    els.promptDialogTitle.textContent = title;
    els.promptDialogInput.placeholder = placeholder || '';
    els.promptDialogInput.value = defaultValue || '';

    function cleanup() {
      els.promptDialogCancel.removeEventListener('click', onCancel);
      els.promptDialogOk.removeEventListener('click', onOk);
      els.promptDialog.removeEventListener('close', onClose);
      els.promptDialog.close();
    }

    function onCancel() { cleanup(); resolve(null); }
    function onOk() {
      const value = els.promptDialogInput.value.trim();
      cleanup();
      resolve(value || null);
    }
    function onClose() { cleanup(); resolve(null); }

    els.promptDialogCancel.addEventListener('click', onCancel);
    els.promptDialogOk.addEventListener('click', onOk);
    els.promptDialog.addEventListener('close', onClose);

    els.promptDialog.showModal();
    // Focus and select input for quick editing
    els.promptDialogInput.focus();
    els.promptDialogInput.select();
  });
}

function getConfig() {
  return {
    apiUrl: localStorage.getItem(storageKeys.apiUrl) || '',
    sharedSecret: localStorage.getItem(storageKeys.sharedSecret) || '',
    autoRefresh: localStorage.getItem(storageKeys.autoRefresh) || '5'
  };
}
function setConfig(apiUrl, sharedSecret, autoRefresh) {
  localStorage.setItem(storageKeys.apiUrl, apiUrl.trim());
  localStorage.setItem(storageKeys.sharedSecret, sharedSecret);
  if (autoRefresh !== undefined) localStorage.setItem(storageKeys.autoRefresh, String(autoRefresh));
}
function hydrateSettings() {
  const config = getConfig();
  els.apiUrl.value = config.apiUrl;
  els.sharedSecret.value = config.sharedSecret;
  els.autoRefreshSelect.value = config.autoRefresh;
  updateConnectionChip(Boolean(config.apiUrl), false);
}
function updateConnectionChip(hasUrl, connected) {
  [els.connectionChip, els.connectionChipMirror].forEach(chip => {
    chip.classList.remove('connected', 'disconnected');
    if (!hasUrl) chip.textContent = 'לא מחובר';
    else if (connected) {
      chip.textContent = 'מחובר';
      chip.classList.add('connected');
    } else {
      chip.textContent = 'מוגדר';
      chip.classList.add('disconnected');
    }
  });
}
function setSyncChip(text, mode='disconnected') {
  els.syncChip.textContent = text;
  els.syncChip.classList.remove('connected', 'disconnected');
  if (mode) els.syncChip.classList.add(mode);
}
function showMessage(message, isError = false) {
  els.statusMessage.textContent = message;
  els.statusMessage.classList.remove('hidden', 'error');
  if (isError) els.statusMessage.classList.add('error');
}
function hideMessage() { els.statusMessage.classList.add('hidden'); }
function requireApiUrl() {
  const apiUrl = (els.apiUrl.value || '').trim();
  if (!apiUrl) throw new Error('צריך להכניס URL של Apps Script לפני שממשיכים.');
  return apiUrl;
}

async function callApi(action, payload = {}, method = 'POST') {
  const apiUrl = requireApiUrl();
  const sharedSecret = els.sharedSecret.value || '';
  if (method === 'GET') {
    const url = new URL(apiUrl);
    url.searchParams.set('action', action);
    if (sharedSecret) url.searchParams.set('secret', sharedSecret);
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    }
    const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
    return handleResponse(response);
  }
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, secret: sharedSecret, ...payload })
  });
  return handleResponse(response);
}
async function handleResponse(response) {
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`תגובת שרת לא תקינה: ${text.slice(0, 200)}`); }
  if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed with status ${response.status}`);
  return data;
}
function normalizeItem(item) {
  return {
    rowId: String(item.rowId), name: item.name || '', quantity: item.quantity || '',
    category: item.category || '', notes: item.notes || '', price: item.price || '',
    image: item.image || '',
    purchased: String(item.purchased).toLowerCase() === 'true',
    createdAt: item.createdAt || '', updatedAt: item.updatedAt || ''
  };
}
function sortItems(items) {
  const sorted = [...items];
  switch (state.filters.sort) {
    case 'created_asc': sorted.sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||'')); break;
    case 'category_asc': sorted.sort((a,b)=>`${a.category}|${a.name}`.localeCompare(`${b.category}|${b.name}`,'he')); break;
    case 'name_asc': sorted.sort((a,b)=>a.name.localeCompare(b.name,'he')); break;
    default: sorted.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  }
  return sorted;
}
function getVisibleItems() {
  const search = state.filters.search.trim().toLowerCase();
  return sortItems(state.items).filter(item => {
    const matchesSearch = !search || [item.name,item.quantity,item.category,item.notes].join(' ').toLowerCase().includes(search);
    const matchesStatus = state.filters.status === 'all' || (state.filters.status==='done' && item.purchased) || (state.filters.status==='active' && !item.purchased);
    return matchesSearch && matchesStatus;
  });
}
function renderItems() {
  const items = getVisibleItems();
  els.itemsList.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'אין פריטים להצגה.';
    els.itemsList.appendChild(empty);
  }
  for (const item of items) {
    const node = els.itemTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.rowId = item.rowId;
    if (item.purchased) node.classList.add('done');
    const checkbox = node.querySelector('.toggle-item');
    checkbox.checked = item.purchased;
    checkbox.addEventListener('change', () => toggleItem(item.rowId, checkbox.checked));
    node.querySelector('.item-name').textContent = item.name;
    node.querySelector('.item-quantity').textContent = `כמות: ${item.quantity || '-'}`;
    const priceEl = node.querySelector('.item-price');
    if (item.price) {
      priceEl.textContent = `₪${item.price}`;
      priceEl.style.display = 'inline-flex';
    } else {
      priceEl.style.display = 'none';
    }
    const imageEl = node.querySelector('.item-image');
    if (item.image) {
      imageEl.src = item.image;
      imageEl.style.display = 'block';
    } else {
      imageEl.style.display = 'none';
    }
    const notesEl = node.querySelector('.item-notes');
    if (item.notes) notesEl.textContent = item.notes; else notesEl.remove();
    const categoryEl = node.querySelector('.item-category');
    if (item.category) categoryEl.textContent = item.category; else categoryEl.remove();
    node.querySelector('.item-date').textContent = item.updatedAt ? `עודכן: ${formatDate(item.updatedAt)}` : '';
    node.querySelector('.edit-btn').addEventListener('click', () => openEditDialog(item));
    node.querySelector('.delete-btn').addEventListener('click', () => deleteItem(item.rowId));
    els.itemsList.appendChild(node);
  }
  const doneCount = state.items.filter(item => item.purchased).length;
  const leftCount = state.items.length - doneCount;
  const refreshText = state.lastLoadedAt ? ` • נטען ${formatTimeOnly(state.lastLoadedAt)}` : '';
  els.stats.textContent = `${state.items.length} פריטים • ${doneCount} נקנו • ${leftCount} נשארו${refreshText}`;
  els.metricTotal.textContent = state.items.length;
  els.metricDone.textContent = doneCount;
  els.metricLeft.textContent = leftCount;

  // Calculate total price of unpurchased items
  const totalPrice = state.items
    .filter(i => !i.purchased && i.price)
    .reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0);
  if (els.metricPrice) {
    els.metricPrice.textContent = `₪${totalPrice.toFixed(2)}`;
  }
}
function formatDate(value) {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('he-IL',{dateStyle:'short',timeStyle:'short'}).format(date);
}
function formatTimeOnly(value) {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('he-IL',{timeStyle:'short'}).format(date);
}
async function loadItems(showSuccess = false, {silent=false} = {}) {
  if (!silent) els.loading.classList.remove('hidden');
  showLoading();
  try {
    const data = await callApi('list', { listId: state.currentListId }, 'GET');
    state.items = (data.items || []).map(normalizeItem);
    state.remoteVersion = data.version || state.remoteVersion;
    state.lastLoadedAt = new Date().toISOString();
    renderItems();
    // Re-render categories if that tab is active
    if (state.activeTab === 'categories') renderCategories();
    hideMessage();
    updateConnectionChip(true, true);
    setSyncChip('מסונכרן', 'connected');
    if (showSuccess) showMessage('הרשימה נטענה בהצלחה.');
  } catch (error) {
    updateConnectionChip(Boolean((els.apiUrl.value || '').trim()), false);
    setSyncChip('שגיאת סנכרון', 'disconnected');
    showMessage(error.message, true);
  } finally {
    els.loading.classList.add('hidden');
    hideLoading();
  }
}
async function checkVersionAndSync() {
  if (document.hidden || !(els.apiUrl.value || '').trim() || state.syncing) return;
  state.syncing = true;
  try {
    const data = await callApi('version', {}, 'GET');
    if (data.version && state.remoteVersion && data.version !== state.remoteVersion) {
      setSyncChip('נמצא שינוי', 'disconnected');
      await loadItems(false, {silent:true});
    } else {
      state.remoteVersion = data.version || state.remoteVersion;
      setSyncChip('אין שינוי חדש', 'connected');
    }
  } catch {
    setSyncChip('בדיקת שינוי נכשלה', 'disconnected');
  } finally {
    state.syncing = false;
  }
}
function optimisticSet(rowId, patch) {
  state.items = state.items.map(item => item.rowId === rowId ? {...item, ...patch, updatedAt:new Date().toISOString()} : item);
  renderItems();
}
async function addItem(event) {
  event.preventDefault();
  const form = new FormData(els.addItemForm);
  const payload = {
    listId: state.currentListId,
    name: form.get('name'),
    quantity: form.get('quantity'),
    category: form.get('category'),
    notes: form.get('notes'),
    price: form.get('price'),
    image: form.get('image')
  };
  const submitBtn = els.addItemForm.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'שומר...'; }
  showLoading();
  try {
    setSyncChip('מוסיף...', 'disconnected');
    await callApi('add', payload);
    els.addItemForm.reset();
    await loadItems();
    showMessage('הפריט נוסף לרשימה.');
  } catch (error) { showMessage(error.message, true); }
  finally {
    hideLoading();
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'הוסף לרשימה'; }
  }
}
async function toggleItem(rowId, purchased) {
  const previous = state.items.find(i=>i.rowId===rowId)?.purchased;
  optimisticSet(rowId, { purchased });
  try {
    setSyncChip('שומר...', 'disconnected');
    const data = await callApi('toggle', { rowId, purchased });
    if (data.version) state.remoteVersion = data.version;
    setSyncChip('נשמר', 'connected');
  } catch (error) {
    optimisticSet(rowId, { purchased: previous });
    showMessage(error.message, true);
  }
}
function openEditDialog(item) {
  els.editRowId.value = item.rowId; 
  els.editName.value = item.name; 
  els.editQuantity.value = item.quantity; 
  els.editCategory.value = item.category; 
  els.editNotes.value = item.notes; 
  els.editPrice.value = item.price;
  els.editImage.value = item.image;
  els.editDialog.showModal();
}
async function saveEditedItem(event) {
  event.preventDefault();
  const patch = {
    rowId: els.editRowId.value,
    name: els.editName.value,
    quantity: els.editQuantity.value,
    category: els.editCategory.value,
    notes: els.editNotes.value,
    price: els.editPrice.value,
    image: els.editImage.value
  };
  const prev = state.items.find(i=>i.rowId===patch.rowId);
  optimisticSet(patch.rowId, patch);
  const submitBtn = els.editItemForm.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'שומר...'; }
  showLoading();
  try {
    const data = await callApi('update', patch);
    if (data.version) state.remoteVersion = data.version;
    els.editDialog.close();
    setSyncChip('נשמר', 'connected');
  } catch (error) {
    if (prev) optimisticSet(prev.rowId, prev);
    showMessage(error.message, true);
  } finally {
    hideLoading();
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'שמור'; }
  }
}
async function deleteItem(rowId) {
  const confirmed = await showConfirmDialog('אישור מחיקה', 'האם למחוק את הפריט?');
  if (!confirmed) return;
  const prev = [...state.items];
  state.items = state.items.filter(i=>i.rowId !== rowId); renderItems();
  showLoading();
  try {
    const data = await callApi('delete', { rowId });
    if (data.version) state.remoteVersion = data.version;
    setSyncChip('נמחק', 'connected');
  } catch (error) {
    state.items = prev; renderItems(); showMessage(error.message, true);
  } finally {
    hideLoading();
  }
}
function setAutoRefresh(seconds) {
  if (state.syncTimer) clearInterval(state.syncTimer);
  state.syncTimer = null;
  const sec = Number(seconds);
  if (!sec || sec <= 0) { setSyncChip('בדיקת שינוי כבויה', 'disconnected'); return; }
  setSyncChip(`בדיקה כל ${sec}ש׳`, 'connected');
  state.syncTimer = setInterval(checkVersionAndSync, sec * 1000);
}
function switchTab(tab) {
  if (!tab) return;
  state.activeTab = tab;
  els.navBtns.forEach(btn => {
    const btnTab = btn.dataset.targetTab || btn.dataset.tab;
    btn.classList.toggle('active', btnTab === tab);
  });
  els.tabPanels.forEach(panel => panel.classList.toggle('active', panel.dataset.tab === tab));
  // Update aria-selected on all tab buttons
  document.querySelectorAll('.nav-btn[role="tab"]').forEach(btn => {
    btn.setAttribute('aria-selected', btn.dataset.targetTab === tab ? 'true' : 'false');
  });
  // Render categories when that tab is activated
  if (tab === 'categories') renderCategories();
}

async function loadLists() {
  try {
    const data = await callApi('getLists', {}, 'GET');
    state.lists = (data.lists || []).map(l => ({
      id: l.id,
      name: l.name,
      itemCount: l.itemCount || 0
    }));
    if (!state.lists.length) {
      // Create default list
      await createList('רשימת קניות');
      return;
    }
    if (!state.currentListId && state.lists.length) {
      state.currentListId = state.lists[0].id;
    }
    renderLists();
  } catch (error) {
    showMessage('שגיאה בטעינת רשימות: ' + error.message, true);
  }
}

function renderLists() {
  els.listsList.innerHTML = '';
  state.lists.forEach(list => {
    const isActive = list.id == state.currentListId;
    const li = document.createElement('li');
    li.className = `drawer-list-item${isActive ? ' active' : ''}`;
    li.innerHTML = `
      <button class="list-name-btn" data-list-id="${list.id}">
        ${escapeHtml(list.name)}
        <span class="list-item-count">${list.itemCount || 0}</span>
      </button>
      <button class="list-more-btn" data-list-id="${list.id}" data-list-name="${escapeHtml(list.name)}">⋮</button>
    `;
    els.listsList.appendChild(li);
  });
  const currentList = state.lists.find(l => l.id == state.currentListId);
  els.currentListName.textContent = currentList ? currentList.name : '';
}

/**
 * Escape HTML special characters to prevent XSS in innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Close the side menu drawer explicitly.
 */
function closeSidemenu() {
  els.sidemenu.classList.remove('open');
  els.appBackdrop.classList.remove('open');
}

/**
 * Open the side menu drawer explicitly.
 */
function openSidemenu() {
  els.sidemenu.classList.add('open');
  els.appBackdrop.classList.add('open');
}

function toggleSidemenu() {
  const isOpen = els.sidemenu.classList.toggle('open');
  els.appBackdrop.classList.toggle('open', isOpen);
}

async function switchList(listId) {
  state.currentListId = listId;
  renderLists();
  closeSidemenu();
  await loadItems();
}

async function createList(name) {
  try {
    showLoading();
    const data = await callApi('createList', { name });
    await loadLists();
    // Switch to the newly created list
    if (data.listId) {
      await switchList(data.listId);
    }
    showMessage('רשימה נוצרה.');
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    hideLoading();
  }
}

// ─── List Actions Dialog ─────────────────────────────────────────────

/** Context for the currently targeted list in the actions dialog */
let listActionsContext = { listId: null, listName: '' };

/**
 * Open the list actions dialog for a specific list.
 * @param {string} listId
 * @param {string} listName
 */
function openListActions(listId, listName) {
  listActionsContext = { listId, listName };
  els.listActionsTitle.textContent = `פעולות — "${listName}"`;
  els.listActionsDialog.showModal();
}

/**
 * Rename a list via prompt dialog + API call.
 * @param {string} listId
 * @param {string} currentName
 */
async function renameList(listId, currentName) {
  els.listActionsDialog.close();
  const newName = await showPromptDialog('שינוי שם רשימה', 'שם חדש לרשימה', currentName);
  if (!newName) return;
  showLoading();
  try {
    const data = await callApi('renameList', { listId, newName });
    // Update local state
    if (state.currentListId === listId) {
      state.currentListId = data.listId;
    }
    await loadLists();
    renderLists();
    showMessage('שם הרשימה שונה.');
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    hideLoading();
  }
}

/**
 * Duplicate a list via prompt dialog + API call.
 * @param {string} listId
 * @param {string} listName
 */
async function duplicateList(listId, listName) {
  els.listActionsDialog.close();
  const newName = await showPromptDialog('שכפול רשימה', 'שם הרשימה החדשה', listName + ' - עותק');
  if (!newName) return;
  showLoading();
  try {
    const data = await callApi('duplicateList', { sourceListId: listId, newName });
    await loadLists();
    // Switch to the duplicated list
    if (data.listId) {
      await switchList(data.listId);
    }
    showMessage('הרשימה שוכפלה.');
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    hideLoading();
  }
}

/**
 * Clear all completed (purchased) items from a list.
 * @param {string} listId
 */
async function clearCompleted(listId) {
  els.listActionsDialog.close();
  const purchasedCount = state.items.filter(i => i.purchased).length;
  if (purchasedCount === 0) {
    showMessage('אין פריטים שנרכשו לניקוי.');
    return;
  }
  const confirmed = await showConfirmDialog(
    'ניקוי פריטים שנרכשו',
    `למחוק ${purchasedCount} פריטים שנקנו?`
  );
  if (!confirmed) return;
  // Optimistic removal
  const prevItems = [...state.items];
  state.items = state.items.filter(i => !i.purchased);
  renderItems();
  showLoading();
  try {
    const data = await callApi('clearCompleted', { listId });
    if (data.version) state.remoteVersion = data.version;
    setSyncChip('נוקה', 'connected');
    showMessage(`${data.deletedCount || purchasedCount} פריטים נמחקו.`);
    // Reload to get fresh data
    await loadLists();
  } catch (error) {
    // Rollback on error
    state.items = prevItems;
    renderItems();
    showMessage(error.message, true);
  } finally {
    hideLoading();
  }
}

/**
 * Delete a list after confirmation.
 * @param {string} listId
 * @param {string} listName
 */
async function deleteListAction(listId, listName) {
  els.listActionsDialog.close();
  if (state.lists.length <= 1) {
    showMessage('אי אפשר למחוק את הרשימה האחרונה.', true);
    return;
  }
  const confirmed = await showConfirmDialog(
    'מחיקת רשימה',
    `האם למחוק את הרשימה "${listName}"? פעולה זו לא ניתנת לביטול.`
  );
  if (!confirmed) return;
  showLoading();
  try {
    await callApi('deleteList', { listId });
    await loadLists();
    // If the deleted list was the active one, switch to the first available
    if (state.currentListId === listId && state.lists.length) {
      await switchList(state.lists[0].id);
    }
    showMessage('הרשימה נמחקה.');
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    hideLoading();
  }
}

// ─── Categories View ─────────────────────────────────────────────────

/**
 * Render items grouped by category in the categories tab panel.
 */
function renderCategories() {
  if (!els.categoriesList) return;

  const items = state.items;
  const groups = {};

  items.forEach(item => {
    const cat = item.category || 'ללא קטגוריה';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  if (Object.keys(groups).length === 0) {
    els.categoriesList.innerHTML = '<p class="empty-state-text">אין פריטים עדיין.</p>';
    return;
  }

  els.categoriesList.innerHTML = Object.entries(groups).map(([cat, catItems]) => `
    <div class="category-group">
      <div class="category-header">
        <span>${escapeHtml(cat)}</span>
        <span class="category-count">${catItems.length} פריטים</span>
      </div>
      <div class="category-items">
        ${catItems.map(item => `
          <div class="category-item ${item.purchased ? 'purchased' : ''}">
            <span class="category-item-name">${escapeHtml(item.name)}</span>
            ${item.quantity ? `<span class="category-item-qty">${escapeHtml(item.quantity)}</span>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ─── Product Search ──────────────────────────────────────────────────

async function fetchProductData(name) {
  try {
    const response = await fetch(`https://api.shufersal.co.il/v1/products?q=${encodeURIComponent(name)}`);
    const data = await response.json();
    if (data.products && data.products.length) {
      const product = data.products[0];
      return { price: product.price, image: product.image };
    }
  } catch (error) {
    console.log('Error fetching product data:', error);
  }
  return null;
}

// ─── Event Binding ───────────────────────────────────────────────────

function bindEvents() {
  els.toggleSecretBtn.addEventListener('click', () => { els.sharedSecret.type = els.sharedSecret.type === 'password' ? 'text' : 'password'; });
  els.saveSettingsBtn.addEventListener('click', () => {
    setConfig(els.apiUrl.value, els.sharedSecret.value, els.autoRefreshSelect.value);
    updateConnectionChip(Boolean(els.apiUrl.value.trim()), false);
    setAutoRefresh(els.autoRefreshSelect.value);
    showMessage('ההגדרות נשמרו בדפדפן שלך.');
  });
  els.testConnectionBtn.addEventListener('click', async () => { 
    setConfig(els.apiUrl.value, els.sharedSecret.value, els.autoRefreshSelect.value); 
    setAutoRefresh(els.autoRefreshSelect.value); 
    await loadLists();
    await loadItems(true); 
  });
  els.autoRefreshSelect.addEventListener('change', () => { 
    setConfig(els.apiUrl.value, els.sharedSecret.value, els.autoRefreshSelect.value); 
    setAutoRefresh(els.autoRefreshSelect.value); 
  });
  els.addItemForm.addEventListener('submit', async (e) => {
    await addItem(e);
    if (els.addDialog && typeof els.addDialog.close === 'function') els.addDialog.close();
  });
  if (els.openAddDialogBtn) els.openAddDialogBtn.addEventListener('click', () => els.addDialog?.showModal());
  if (els.closeAddDialogBtn) els.closeAddDialogBtn.addEventListener('click', () => els.addDialog?.close());
  els.searchInput.addEventListener('input', e => { state.filters.search = e.target.value; renderItems(); });
  els.statusFilter.addEventListener('change', e => { state.filters.status = e.target.value; renderItems(); });
  els.sortSelect.addEventListener('change', e => { state.filters.sort = e.target.value; renderItems(); });
  els.editItemForm.addEventListener('submit', saveEditedItem);
  els.cancelEditBtn.addEventListener('click', () => els.editDialog.close());

  // Nav buttons — support both data-target-tab and data-tab attributes
  els.navBtns.forEach(btn => btn.addEventListener('click', () => {
    const tab = btn.dataset.targetTab || btn.dataset.tab;
    if (tab) switchTab(tab);
  }));

  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersionAndSync(); });

  // Side menu events
  els.hamburgerBtn.addEventListener('click', toggleSidemenu);
  els.closeSidemenuBtn.addEventListener('click', closeSidemenu);
  els.appBackdrop.addEventListener('click', toggleSidemenu);

  // Create list — use styled prompt dialog instead of native prompt()
  els.addListBtn.addEventListener('click', async () => {
    const name = await showPromptDialog('רשימה חדשה', 'שם הרשימה', '');
    if (name) await createList(name);
  });

  // Event delegation for drawer list buttons
  els.listsList.addEventListener('click', (e) => {
    // Handle list name button click → switch list
    const nameBtn = e.target.closest('.list-name-btn');
    if (nameBtn) {
      const listId = nameBtn.dataset.listId;
      if (listId) switchList(listId);
      return;
    }
    // Handle more button click → open list actions
    const moreBtn = e.target.closest('.list-more-btn');
    if (moreBtn) {
      const listId = moreBtn.dataset.listId;
      const listName = moreBtn.dataset.listName;
      if (listId) openListActions(listId, listName);
      return;
    }
  });

  // List actions dialog buttons
  els.listActionsClose.addEventListener('click', () => els.listActionsDialog.close());
  els.listActionRename.addEventListener('click', () => {
    renameList(listActionsContext.listId, listActionsContext.listName);
  });
  els.listActionDuplicate.addEventListener('click', () => {
    duplicateList(listActionsContext.listId, listActionsContext.listName);
  });
  els.listActionClear.addEventListener('click', () => {
    clearCompleted(listActionsContext.listId);
  });
  els.listActionDelete.addEventListener('click', () => {
    deleteListAction(listActionsContext.listId, listActionsContext.listName);
  });

  // Product search
  els.searchProductBtn.addEventListener('click', async () => {
    const name = els.addItemForm.querySelector('[name="name"]').value;
    if (!name) return;
    const data = await fetchProductData(name);
    if (data) {
      els.addItemForm.querySelector('[name="price"]').value = data.price;
      els.addItemForm.querySelector('[name="image"]').value = data.image;
      showMessage('נתונים נטענו מרמי לוי.');
    } else {
      showMessage('לא נמצאו נתונים.', true);
    }
  });
}
function boot() {
  hydrateSettings(); bindEvents(); switchTab('list'); setAutoRefresh(getConfig().autoRefresh || '5');
  if (getConfig().apiUrl) {
    loadLists().then(() => loadItems());
  } else { 
    els.loading.classList.add('hidden'); 
    showMessage('הכנס URL של Apps Script ולחץ על בדיקת חיבור כדי להתחיל.'); 
  }
}

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  // Unregister all old service workers first
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister();
    });
  });
  
  // Then register the new one
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=5')
      .then(registration => {
        console.log('Service Worker registered successfully:', registration.scope);
      })
      .catch(error => {
        console.log('Service Worker registration failed:', error);
      });
  });
}

boot();
