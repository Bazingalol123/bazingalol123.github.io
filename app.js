// Main application controller - ES Module entry point
import { sb } from './api/supabase.js';
import { state, LIST_CACHE_KEY } from './store/state.js';
import { els, initElements } from './store/elements.js';
import {
  formatDate,
  formatTimeOnly,
  escapeHtml,
  showLoading,
  hideLoading,
  showMessage,
  hideMessage,
  normalizeItem,
  isPWA,
  isMobileDevice,
  getPlatform,
  shouldShowInstallPrompt,
  initDesktopMode,
  isDesktop
} from './utils/helpers.js';
import {
  currentUser,
  signUp,
  signIn,
  resetPassword,
  updatePassword,
  signOut,
  updateAuthUI,
  updateDisplayName,
  initAuth
} from './services/auth.js';
import { 
  loadItems, 
  silentRefresh,
  addItemToSupabase, 
  toggleItem, 
  updateItemInSupabase, 
  deleteItemFromSupabase,
  subscribeToList,
  handleRealtimeItemChange,
  qtyDebounceTimers,
  qtyOriginalValues
} from './services/items.js';
import {
  loadLists,
  createList,
  renameList,
  duplicateList,
  clearCompleted,
  deleteList,
  generateInviteQr,
  checkInviteToken,
  loadResponsibilityGroups,
  createResponsibilityGroup,
  updateResponsibilityGroup,
  deleteResponsibilityGroup,
  getListMembers,
  addGroupMember,
  removeGroupMember,
  GROUP_COLORS
} from './services/lists.js';
import { 
  renderItems, 
  renderLists, 
  renderCategories, 
  renderQuickAddCarousel,
  setQuickAddMode
} from './components/render.js';
import {
  showConfirmDialog,
  showPromptDialog,
  updateConnectionChip,
  setSyncChip,
  initFilterToggle,
  openListActions,
  renderResponsibilityOptions,
  renderResponsibilityFilter,
  renderManageGroupsDialog,
  showMemberPicker
} from './components/ui.js';

// OneSignal App ID
const ONESIGNAL_APP_ID = 'bfa7608a-9ec5-49f8-93e9-9f57823db28b';

// Cached responsibility groups and list members
let cachedGroups = [];
let cachedListMembers = [];

// List actions context
let listActionsContext = { listId: null, listName: '' };

// Share dialog state
let currentShareUrl = null;

/**
 * Open the multi-option share dialog for a list.
 * Exported so Task 5 (enhanced list creation) can call it.
 */
export async function openShareDialog(listId, listName) {
  const url = await generateInviteQr(listId);
  if (!url) return;
  currentShareUrl = url;

  // Set list name in subtitle
  els.shareListName.textContent = listName;

  // Reset QR section (hide it initially)
  els.shareQrSection.style.display = 'none';
  els.shareQrContainer.innerHTML = '';

  // Show/hide native share button based on browser support
  if (els.shareNative) {
    els.shareNative.style.display = navigator.share ? 'flex' : 'none';
  }

  els.shareDialog.showModal();
}

// PWA Install Prompt
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const installBtn = document.getElementById('pwaInstallButton');
  if (installBtn) installBtn.style.display = 'block';
});

// ─── GROCERY DICTIONARY FOR CATEGORY PREDICTION ────────────────────
const GROCERY_DICTIONARY = {
  'עגבניה': 'ירקות ופירות', 'עגבניות': 'ירקות ופירות', 'שרי': 'ירקות ופירות',
  'מלפפון': 'ירקות ופירות', 'מלפפונים': 'ירקות ופירות',
  'פלפל': 'ירקות ופירות', 'גמבה': 'ירקות ופירות',
  'בצל': 'ירקות ופירות', 'שום': 'ירקות ופירות',
  'תפוח אדמה': 'ירקות ופירות', 'תפוחי אדמה': 'ירקות ופירות', 'תפודים': 'ירקות ופירות',
  'בטטה': 'ירקות ופירות', 'גזר': 'ירקות ופירות',
  'חסה': 'ירקות ופירות', 'כרוב': 'ירקות ופירות', 'כרובית': 'ירקות ופירות', 'ברוקולי': 'ירקות ופירות',
  'לימון': 'ירקות ופירות', 'לימונים': 'ירקות ופירות',
  'תפוח': 'ירקות ופירות', 'תפוחים': 'ירקות ופירות', 'תפוח עץ': 'ירקות ופירות',
  'בננה': 'ירקות ופירות', 'בננות': 'ירקות ופירות',
  'תפוז': 'ירקות ופירות', 'תפוזים': 'ירקות ופירות', 'קלמנטינה': 'ירקות ופירות',
  'אבטיח': 'ירקות ופירות', 'מלון': 'ירקות ופירות', 'ענבים': 'ירקות ופירות',
  'פטריות': 'ירקות ופירות', 'קישוא': 'ירקות ופירות', 'חציל': 'ירקות ופירות',
  'פטרוזיליה': 'ירקות ופירות', 'כוסברה': 'ירקות ופירות', 'שמיר': 'ירקות ופירות', 'נענע': 'ירקות ופירות',
  'חלב': 'מוצרי חלב', 'חלב שיבולת שועל': 'מוצרי חלב', 'חלב סויה': 'מוצרי חלב', 'חלב שקדים': 'מוצרי חלב',
  'גבינה': 'מוצרי חלב', 'גבינה צהובה': 'מוצרי חלב', 'גלבוע': 'מוצרי חלב', 'עמק': 'מוצרי חלב',
  'גבינה לבנה': 'מוצרי חלב', 'סקי': 'מוצרי חלב', 'קוטג': 'מוצרי חלב', 'קוטג\'': 'מוצרי חלב',
  'יוגורט': 'מוצרי חלב', 'דנונה': 'מוצרי חלב', 'מולר': 'מוצרי חלב',
  'שמנת': 'מוצרי חלב', 'שמנת לבישול': 'מוצרי חלב', 'שמנת מתוקה': 'מוצרי חלב', 'שמנת חמוצה': 'מוצרי חלב',
  'חמאה': 'מוצרי חלב', 'מרגרינה': 'מוצרי חלב', 'ביצים': 'מוצרי חלב', 'ביצה': 'מוצרי חלב',
  'מעדן': 'מוצרי חלב', 'מילקי': 'מוצרי חלב', 'קרלו': 'מוצרי חלב',
  'גבינת עזים': 'מוצרי חלב', 'גבינת כבשים': 'מוצרי חלב', 'בולגרית': 'מוצרי חלב', 'צפתית': 'מוצרי חלב',
  'עוף': 'בשר ודגים', 'חזה עוף': 'בשר ודגים', 'שניצל': 'בשר ודגים', 'כרעיים': 'בשר ודגים', 'שוקיים': 'בשר ודגים',
  'בשר': 'בשר ודגים', 'בשר טחון': 'בשר ודגים', 'בקר': 'בשר ודגים', 'אסאדו': 'בשר ודגים',
  'דג': 'בשר ודגים', 'סלמון': 'בשר ודגים', 'אמנון': 'בשר ודגים', 'דניס': 'בשר ודגים',
  'נקניקיות': 'בשר ודגים', 'נקניק': 'בשר ודגים', 'פסטרמה': 'בשר ודגים', 'סלמי': 'בשר ודגים',
  'לחם': 'לחם ומאפים', 'לחם אחיד': 'לחם ומאפים', 'לחם מלא': 'לחם ומאפים',
  'פיתה': 'לחם ומאפים', 'פיתות': 'לחם ומאפים', 'לחמניה': 'לחם ומאפים', 'לחמניות': 'לחם ומאפים',
  'חלה': 'לחם ומאפים', 'בייגל': 'לחם ומאפים', 'בורקס': 'לחם ומאפים',
  'אורז': 'מזון יבש', 'פסטה': 'מזון יבש', 'ספגטי': 'מזון יבש', 'מקרוני': 'מזון יבש', 'פתיתים': 'מזון יבש',
  'קמח': 'מזון יבש', 'קמח תופח': 'מזון יבש', 'סוכר': 'מזון יבש', 'מלח': 'מזון יבש',
  'שמן': 'מזון יבש', 'שמן זית': 'מזון יבש', 'שמן קנולה': 'מזון יבש',
  'קטשופ': 'מזון יבש', 'מיונז': 'מזון יבש', 'חרדל': 'מזון יבש',
  'טחינה': 'מזון יבש', 'דבש': 'מזון יבש', 'סילאן': 'מזון יבש',
  'תבלין': 'מזון יבש', 'פלפל שחור': 'מזון יבש', 'פפריקה': 'מזון יבש', 'כורכום': 'מזון יבש', 'כמון': 'מזון יבש',
  'שקדי מרק': 'מזון יבש', 'אטריות': 'מזון יבש',
  'קורנפלקס': 'מזון יבש', 'דגני בוקר': 'מזון יבש', 'שיבולת שועל': 'מזון יבש',
  'טונה': 'שימורים', 'תירס': 'שימורים', 'אפונה': 'שימורים', 'רסק עגבניות': 'שימורים', 
  'מלפפון חמוץ': 'שימורים', 'זיתים': 'שימורים', 'שעועית': 'שימורים',
  'מים': 'משקאות', 'מים מינרליים': 'משקאות', 'שישיית מים': 'משקאות',
  'קוקה קולה': 'משקאות', 'קולה': 'משקאות', 'ספרייט': 'משקאות', 'פנטה': 'משקאות',
  'מיץ': 'משקאות', 'מיץ תפוזים': 'משקאות', 'מיץ תפוחים': 'משקאות',
  'קפה': 'משקאות', 'קפה שחור': 'משקאות', 'נס קפה': 'משקאות', 'קפסולות': 'משקאות',
  'תה': 'משקאות', 'תיון': 'משקאות', 'תיונים': 'משקאות', 'בירה': 'משקאות', 'יין': 'משקאות',
  'במבה': 'חטיפים ומתוקים', 'ביסלי': 'חטיפים ומתוקים', 'תפוצ\'יפס': 'חטיפים ומתוקים', 
  'דוריטוס': 'חטיפים ומתוקים', 'אפרופו': 'חטיפים ומתוקים',
  'שוקולד': 'חטיפים ומתוקים', 'פרה': 'חטיפים ומתוקים', 'פסק זמן': 'חטיפים ומתוקים', 'מקופלת': 'חטיפים ומתוקים',
  'עוגיות': 'חטיפים ומתוקים', 'וופלים': 'חטיפים ומתוקים', 'בפלות': 'חטיפים ומתוקים',
  'סוכריות': 'חטיפים ומתוקים', 'מסטיק': 'חטיפים ומתוקים',
  'גרעינים': 'חטיפים ומתוקים', 'בוטנים': 'חטיפים ומתוקים', 'אגוזים': 'חטיפים ומתוקים', 'שקדים': 'חטיפים ומתוקים',
  'צ\'יפס': 'קפואים', 'פיצה': 'קפואים', 'גלידה': 'קפואים', 'ארטיק': 'קפואים', 'קרח': 'קפואים', 
  'בורקס קפוא': 'קפואים', 'מלאווח': 'קפואים', 'ג\'חנון': 'קפואים',
  'סבון כלים': 'ניקיון', 'נוזל כלים': 'ניקיון', 'פיירי': 'ניקיון',
  'אקונומיקה': 'ניקיון', 'נוזל רצפות': 'ניקיון', 'מסיר שומנים': 'ניקיון',
  'נייר טואלט': 'ניקיון', 'נייר סופג': 'ניקיון', 'מגבונים': 'ניקיון', 
  'שקיות זבל': 'ניקיון', 'שקיות אשפה': 'ניקיון',
  'ספוג': 'ניקיון', 'סקוצ': 'ניקיון', 'סמרטוט': 'ניקיון',
  'אבקת כביסה': 'ניקיון', 'מרכך כביסה': 'ניקיון', 'ג\'ל כביסה': 'ניקיון',
  'שמפו': 'פארם ותינוקות', 'מרכך': 'פארם ותינוקות', 'סבון נוזלי': 'פארם ותינוקות', 'סבון גוף': 'פארם ותינוקות',
  'משחת שיניים': 'פארם ותינוקות', 'מברשת שיניים': 'פארם ותינוקות',
  'דאודורנט': 'פארם ותינוקות', 'סכיני גילוח': 'פארם ותינוקות', 'קצף גילוח': 'פארם ותינוקות',
  'טיטולים': 'פארם ותינוקות', 'חיתולים': 'פארם ותינוקות', 'האגיס': 'פארם ותינוקות', 'פמפרס': 'פארם ותינוקות',
  'מטרנה': 'פארם ותינוקות', 'סימילאק': 'פארם ותינוקות', 'נוטרילון': 'פארם ותינוקות',
  'תחבושות': 'פארם ותינוקות', 'טמפונים': 'פארם ותינוקות',
  'אוכל לכלבים': 'חיות מחמד', 'אוכל לחתולים': 'חיות מחמד', 'חול לחתולים': 'חיות מחמד'
};

/**
 * Predict category based on item name
 */
function predictCategory(name) {
  if (!name) return '';
  const cleanName = name.trim().toLowerCase();
  
  // Check history first
  const historyMatch = state.items.find(item => 
    item.name.trim().toLowerCase() === cleanName && item.category
  );
  if (historyMatch) return historyMatch.category;
  
  // Check dictionary
  if (GROCERY_DICTIONARY[cleanName]) return GROCERY_DICTIONARY[cleanName];
  
  // Try partial match
  const words = cleanName.split(' ');
  for (const word of words) {
    if (GROCERY_DICTIONARY[word]) return GROCERY_DICTIONARY[word];
  }
  
  return '';
}

// ─── PWA FUNCTIONS ───────────────────────────────────────────────

function initPWADetection() {
  if (isPWA()) {
    document.body.classList.add('pwa-mode');
    return;
  }
  
  if (shouldShowInstallPrompt()) {
    showInstallPrompt();
  }
}

function showInstallPrompt() {
  const prompt = document.getElementById('pwaInstallPrompt');
  if (!prompt) return;
  
  const platform = getPlatform();
  
  document.getElementById('installInstructionsIOS').style.display = 'none';
  document.getElementById('installInstructionsAndroid').style.display = 'none';
  document.getElementById('installInstructionsGeneric').style.display = 'none';
  
  if (platform === 'ios-safari') {
    document.getElementById('installInstructionsIOS').style.display = 'block';
  } else if (platform === 'android-chrome') {
    document.getElementById('installInstructionsAndroid').style.display = 'block';
  } else if (isMobileDevice()) {
    document.getElementById('installInstructionsGeneric').style.display = 'block';
  } else {
    return;
  }
  
  prompt.style.display = 'block';
}

function dismissInstallPrompt() {
  const prompt = document.getElementById('pwaInstallPrompt');
  if (prompt) prompt.style.display = 'none';
  localStorage.setItem('pwa_install_dismissed', Date.now().toString());
}

// ─── HELPER FUNCTIONS ────────────────────────────────────────────

function optimisticSet(rowId, patch) {
  state.items = state.items.map(item => 
    item.rowId === rowId 
      ? { ...item, ...patch, updatedAt: new Date().toISOString() } 
      : item
  );
  reRenderAll();
}

function reRenderAll() {
  renderItems(handleToggleItem, openEditDialog, handleDeleteItem, handleUpdateItemQuantity);
  renderQuickAddCarousel(handleQuickAddItem);
  if (state.activeTab === 'categories') renderCategories();
}

// Invite handler for list card invite buttons (Task 5)
function handleInviteToList(listId, listName) {
  openShareDialog(listId, listName);
}

async function refreshListCards() {
  await loadLists();
  renderLists(handleSwitchList, handleOpenListActions, handleInviteToList);
}

function switchTab(tab) {
  if (!tab) return;
  state.activeTab = tab;
  els.navBtns.forEach(btn => {
    const btnTab = btn.dataset.targetTab || btn.dataset.tab;
    btn.classList.toggle('active', btnTab === tab);
  });
  els.tabPanels.forEach(panel => panel.classList.toggle('active', panel.dataset.tab === tab));
  document.querySelectorAll('.nav-btn[role="tab"]').forEach(btn => {
    btn.setAttribute('aria-selected', btn.dataset.targetTab === tab ? 'true' : 'false');
  });
  if (tab === 'categories') renderCategories();
}

// ─── ACTION HANDLERS ─────────────────────────────────────────────

async function handleToggleItem(rowId, purchased) {
  const previous = state.items.find(i => i.rowId === rowId)?.purchased;
  optimisticSet(rowId, { purchased });
  try {
    await toggleItem(rowId, purchased);
  } catch (error) {
    optimisticSet(rowId, { purchased: previous });
    showMessage(error.message, true);
  }
}

async function handleUpdateItemQuantity(rowId, newQty) {
  const item = state.items.find(i => i.rowId === rowId);
  if (!item) return;

  if (!qtyDebounceTimers.has(rowId)) {
    qtyOriginalValues.set(rowId, item.quantity);
  }

  optimisticSet(rowId, { quantity: newQty });

  clearTimeout(qtyDebounceTimers.get(rowId));

  const timer = setTimeout(async () => {
    qtyDebounceTimers.delete(rowId);
    const originalQty = qtyOriginalValues.get(rowId);
    qtyOriginalValues.delete(rowId);

    const currentItem = state.items.find(i => i.rowId === rowId);
    if (!currentItem) return;

    try {
      setSyncChip('שומר...', 'disconnected');
      const patch = {
        rowId,
        name: currentItem.name,
        quantity: currentItem.quantity,
        category: currentItem.category,
        notes: currentItem.notes,
        price: currentItem.price,
        image: currentItem.image
      };
      await updateItemInSupabase(patch);
      setSyncChip('נשמר', 'connected');
    } catch (error) {
      optimisticSet(rowId, { quantity: originalQty });
      showMessage(error.message, true);
    }
  }, 600);

  qtyDebounceTimers.set(rowId, timer);
}

async function handleAddItem(event) {
  event.preventDefault();
  if (!currentUser) {
    showMessage('יש להתחבר קודם.', true);
    return;
  }

  const form = new FormData(els.addItemForm);
  const payload = {
    name: form.get('name') || '',
    quantity: form.get('quantity') || '1',
    category: form.get('category') || '',
    notes: form.get('notes') || '',
    price: form.get('price') || '',
    image: form.get('image') || ''
  };

  const tempId = 'temp-' + Date.now();
  const tempItem = normalizeItem({
    ...payload,
    rowId: tempId,
    purchased: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  state.items = [tempItem, ...state.items];
  reRenderAll();
  els.addItemForm.reset();
  showMessage('הפריט נוסף לרשימה.');
  setSyncChip('מוסיף...', 'disconnected');

  const submitBtn = els.addItemForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'שומר...';
  }

  try {
    await addItemToSupabase(payload);
    setSyncChip('נשמר', 'connected');
    silentRefresh();
    refreshListCards(); // fire-and-forget: update item counts on Home tab
  } catch (error) {
    state.items = state.items.filter(i => i.rowId !== tempId);
    reRenderAll();
    showMessage(error.message, true);
    setSyncChip('שגיאת סנכרון', 'disconnected');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'הוסף לרשימה';
    }
  }
}

async function handleQuickAddItem(name, category) {
  if (!state.currentListId || !currentUser) return;

  const tempId = 'temp-' + Date.now();
  const tempItem = normalizeItem({
    rowId: tempId,
    name,
    quantity: '1',
    category: category || '',
    notes: '',
    price: '',
    image: '',
    purchased: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  state.items = [tempItem, ...state.items];
  reRenderAll();
  showMessage(`"${name}" נוסף לרשימה.`);
  setSyncChip('מוסיף...', 'disconnected');

  try {
    await addItemToSupabase({ name, quantity: '1', category: category || '', notes: '', price: '', image: '' });
    setSyncChip('נשמר', 'connected');
    silentRefresh();
    refreshListCards(); // fire-and-forget: update item counts on Home tab
  } catch (error) {
    state.items = state.items.filter(i => i.rowId !== tempId);
    reRenderAll();
    showMessage(error.message, true);
    setSyncChip('שגיאת סנכרון', 'disconnected');
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
  
  const editRespGroup = document.getElementById('editResponsibleGroup');
  if (editRespGroup) {
    editRespGroup.value = item.responsibleGroup?.id || '';
  }
  els.editDialog.showModal();
}

async function handleSaveEditedItem(event) {
  event.preventDefault();
  const editRespGroup = document.getElementById('editResponsibleGroup');
  const patch = {
    rowId: els.editRowId.value,
    name: els.editName.value,
    quantity: els.editQuantity.value,
    category: els.editCategory.value,
    notes: els.editNotes.value,
    price: els.editPrice.value,
    image: els.editImage.value,
    responsibleGroupId: editRespGroup?.value || null
  };
  
  const prev = state.items.find(i => i.rowId === patch.rowId);
  optimisticSet(patch.rowId, patch);
  
  const submitBtn = els.editItemForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'שומר...';
  }
  showLoading();
  
  try {
    await updateItemInSupabase(patch);
    els.editDialog.close();
    setSyncChip('נשמר', 'connected');
  } catch (error) {
    if (prev) optimisticSet(prev.rowId, prev);
    showMessage(error.message, true);
  } finally {
    hideLoading();
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'שמור';
    }
  }
}

async function handleDeleteItem(rowId) {
  if (qtyDebounceTimers.has(rowId)) {
    clearTimeout(qtyDebounceTimers.get(rowId));
    qtyDebounceTimers.delete(rowId);
    qtyOriginalValues.delete(rowId);
  }

  const confirmed = await showConfirmDialog('אישור מחיקה', 'האם למחוק את הפריט?');
  if (!confirmed) return;
  
  const prev = [...state.items];
  state.items = state.items.filter(i => i.rowId !== rowId);
  reRenderAll();
  showLoading();
  
  try {
    await deleteItemFromSupabase(rowId);
    setSyncChip('נמחק', 'connected');
    refreshListCards(); // fire-and-forget: update item counts on Home tab
  } catch (error) {
    state.items = prev;
    reRenderAll();
    showMessage(error.message, true);
  } finally {
    hideLoading();
  }
}

async function handleSwitchList(listId) {
  state.currentListId = listId;
  renderLists(handleSwitchList, handleOpenListActions, handleInviteToList);
  switchTab('list');
  await loadItems();
  reRenderAll();
  subscribeToList(listId, (payload) => {
    handleRealtimeItemChange(payload);
    reRenderAll();
    setSyncChip('מסונכרן', 'connected');
  }, setSyncChip);
  
  // Load and render responsibility groups
  state.responsibilityGroups = await loadResponsibilityGroups();
  cachedGroups = state.responsibilityGroups;
  renderResponsibilityOptions(cachedGroups);
  renderResponsibilityFilter(cachedGroups);
}

function handleOpenListActions(listId, listName) {
  listActionsContext = openListActions(listId, listName);
}

// ─── EVENT BINDINGS ──────────────────────────────────────────────

function bindEvents() {
  console.log('Binding events. Sample element check - homeAddListBtn:', els.homeAddListBtn);
  // Landing page auth triggers
  if (els.landingSignInBtn) {
    els.landingSignInBtn.addEventListener('click', () => {
      document.getElementById('authModeSignIn')?.click();
      document.getElementById('authDialog')?.showModal();
    });
  }

  if (els.landingSignUpBtn) {
    els.landingSignUpBtn.addEventListener('click', () => {
      document.getElementById('authModeSignUp')?.click();
      document.getElementById('authDialog')?.showModal();
    });
  }

  document.getElementById('closeAuthDialogBtn')?.addEventListener('click', () => {
    document.getElementById('authDialog')?.close();
  });

  // Theme toggle
  function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('shopping_list_dark_mode', isDark ? '1' : '0');
    if (els.themeToggleBtn) els.themeToggleBtn.textContent = isDark ? 'החלף למצב יום ☀️' : 'החלף למצב לילה 🌙';
    if (els.globalThemeToggle) els.globalThemeToggle.textContent = isDark ? '☀️' : '🌙';
  }
  
  if (els.themeToggleBtn) els.themeToggleBtn.addEventListener('click', toggleTheme);
  if (els.globalThemeToggle) els.globalThemeToggle.addEventListener('click', toggleTheme);

  // Auth events
  // === Auth Mode Toggle ===
  document.getElementById('authModeSignIn')?.addEventListener('click', () => {
    document.getElementById('authModeSignIn').classList.add('active');
    document.getElementById('authModeSignUp').classList.remove('active');
    document.getElementById('signInFormFields').style.display = 'block';
    document.getElementById('signUpFormFields').style.display = 'none';
  });

  document.getElementById('authModeSignUp')?.addEventListener('click', () => {
    document.getElementById('authModeSignUp').classList.add('active');
    document.getElementById('authModeSignIn').classList.remove('active');
    document.getElementById('signUpFormFields').style.display = 'block';
    document.getElementById('signInFormFields').style.display = 'none';
  });

  // === Sign In ===
  document.getElementById('signInBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('signInEmail').value.trim();
    const password = document.getElementById('signInPassword').value;
    
    if (!email || !password) {
      return showMessage('נא להזין אימייל וסיסמה.', true);
    }
    
    try {
      showLoading();
      await signIn(email, password);
      showMessage('התחברת בהצלחה!');
    } catch (err) {
      if (err.message.includes('Invalid login credentials')) {
        showMessage('אימייל או סיסמה שגויים.', true);
      } else {
        showMessage(err.message, true);
      }
    } finally {
      hideLoading();
    }
  });

  // === Sign Up ===
  document.getElementById('signUpBtn')?.addEventListener('click', async () => {
    const displayName = document.getElementById('signUpDisplayName').value.trim();
    const email = document.getElementById('signUpEmail').value.trim();
    const password = document.getElementById('signUpPassword').value;
    const passwordConfirm = document.getElementById('signUpPasswordConfirm').value;
    
    if (!email || !password) {
      return showMessage('נא להזין אימייל וסיסמה.', true);
    }
    
    if (password.length < 6) {
      return showMessage('הסיסמה חייבת להכיל לפחות 6 תווים.', true);
    }
    
    if (password !== passwordConfirm) {
      return showMessage('הסיסמאות אינן תואמות.', true);
    }
    
    try {
      showLoading();
      await signUp(email, password, displayName);
      document.getElementById('authDialog')?.close();
      showMessage('נרשמת בהצלחה! בדוק את האימייל שלך לאימות.', false, 5000);
    } catch (err) {
      if (err.message.includes('User already registered')) {
        showMessage('המשתמש כבר קיים. נסה להתחבר.', true);
      } else {
        showMessage(err.message, true);
      }
    } finally {
      hideLoading();
    }
  });

  // === Forgot Password ===
  document.getElementById('forgotPasswordBtn')?.addEventListener('click', () => {
    document.getElementById('resetPasswordDialog')?.showModal();
  });

  document.getElementById('sendResetEmailBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('resetPasswordEmail').value.trim();
    if (!email) {
      return showMessage('נא להזין כתובת אימייל.', true);
    }
    
    try {
      showLoading();
      await resetPassword(email);
      document.getElementById('resetPasswordDialog')?.close();
      showMessage('נשלח קישור לאיפוס סיסמה לאימייל שלך!');
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      hideLoading();
    }
  });

  document.getElementById('closeResetPasswordBtn')?.addEventListener('click', () => {
    document.getElementById('resetPasswordDialog')?.close();
  });

  // === Update Password (after reset) ===
  document.getElementById('updatePasswordBtn')?.addEventListener('click', async () => {
    const newPassword = document.getElementById('newPassword').value;
    const newPasswordConfirm = document.getElementById('newPasswordConfirm').value;
    
    if (!newPassword || newPassword.length < 6) {
      return showMessage('הסיסמה חייבת להכיל לפחות 6 תווים.', true);
    }
    
    if (newPassword !== newPasswordConfirm) {
      return showMessage('הסיסמאות אינן תואמות.', true);
    }
    
    try {
      showLoading();
      await updatePassword(newPassword);
      document.getElementById('updatePasswordDialog')?.close();
      showMessage('הסיסמה עודכנה בהצלחה!');
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      hideLoading();
    }
  });

  document.getElementById('closeUpdatePasswordBtn')?.addEventListener('click', () => {
    document.getElementById('updatePasswordDialog')?.close();
  });

  document.getElementById('signOutBtn')?.addEventListener('click', async () => {
    await signOut();
    state.items = [];
    state.lists = [];
    state.currentListId = null;
    reRenderAll();
    renderLists(handleSwitchList, handleOpenListActions, handleInviteToList);
  });

  document.getElementById('saveDisplayNameBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('displayNameInput').value.trim();
    if (!name || !currentUser) return;
    try {
      await updateDisplayName(name);
      showMessage('השם עודכן.');
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  // Email Verification - Return to App button
  document.getElementById('returnToAppBtn')?.addEventListener('click', () => {
    transitionToApp();
  });

  // Email Verification - Return to Login button (from error page)
  document.getElementById('returnToLoginBtn')?.addEventListener('click', () => {
    document.getElementById('verificationErrorPage')?.style.setProperty('display', 'none');
    document.getElementById('landingPage')?.style.setProperty('display', 'flex');
  });

  // Email Verification - Resend verification email
  document.getElementById('resendVerificationBtn')?.addEventListener('click', async () => {
    // This would need the user to enter their email again
    const email = await showPromptDialog('שלח אימות מחדש', 'הזן את כתובת האימייל שלך:', '');
    if (!email) return;
    
    try {
      showLoading();
      // Resend verification by triggering resend
      const { error } = await sb.auth.resend({
        type: 'signup',
        email: email
      });
      
      if (error) throw error;
      
      showMessage('נשלח אימייל חדש! בדוק את תיבת הדואר שלך.', false, 5000);
      document.getElementById('verificationErrorPage')?.style.setProperty('display', 'none');
      document.getElementById('landingPage')?.style.setProperty('display', 'flex');
    } catch (err) {
      showMessage('שגיאה בשליחת האימייל: ' + err.message, true);
    } finally {
      hideLoading();
    }
  });

  // GROUPS: Manage responsibility groups
  document.getElementById('listActionManageGroups')?.addEventListener('click', async () => {
    els.listActionsDialog.close();
    state.responsibilityGroups = await loadResponsibilityGroups();
    cachedGroups = state.responsibilityGroups;
    cachedListMembers = await getListMembers(state.currentListId);
    renderManageGroupsDialog(
      cachedGroups,
      handleDeleteGroup,
      null, // onEdit (not implemented yet)
      handleAddMember,
      handleRemoveMember,
      cachedListMembers
    );
    document.getElementById('manageGroupsDialog')?.showModal();
  });

  document.getElementById('addGroupBtn')?.addEventListener('click', async () => {
    const label = await showPromptDialog('קבוצה חדשה', 'שם הקבוצה (למשל: משפחת כהן)', '');
    if (!label) return;
    try {
      await createResponsibilityGroup(label);
      await refreshGroupsDialog();
    } catch (error) {
      console.error('Error creating group:', error);
    }
  });

  async function handleDeleteGroup(groupId) {
    const result = await deleteResponsibilityGroup(groupId);
    if (result !== false) {
      await refreshGroupsDialog();
      reRenderAll(); // Re-render items to update any that had this group
    }
  }

  async function handleAddMember(groupId, groupLabel, currentMembers, availableMembers) {
    const userId = await showMemberPicker(groupId, groupLabel, currentMembers, availableMembers);
    if (userId) {
      const success = await addGroupMember(groupId, userId);
      if (success) {
        await refreshGroupsDialog();
      }
    }
  }

  async function handleRemoveMember(groupId, userId) {
    const confirmed = await showConfirmDialog('הסרת חבר', 'האם להסיר חבר זה מהקבוצה?');
    if (confirmed) {
      const success = await removeGroupMember(groupId, userId);
      if (success) {
        await refreshGroupsDialog();
      }
    }
  }

  async function refreshGroupsDialog() {
    state.responsibilityGroups = await loadResponsibilityGroups();
    cachedGroups = state.responsibilityGroups;
    cachedListMembers = await getListMembers(state.currentListId);
    renderManageGroupsDialog(
      cachedGroups,
      handleDeleteGroup,
      null,
      handleAddMember,
      handleRemoveMember,
      cachedListMembers
    );
    renderResponsibilityOptions(cachedGroups);
    renderResponsibilityFilter(cachedGroups);
  }

  document.getElementById('closeManageGroupsBtn')?.addEventListener('click', () => {
    document.getElementById('manageGroupsDialog')?.close();
  });

  // GROUPS: Quick create from dropdowns
  async function handleQuickCreateGroup(selectElement) {
    const label = await showPromptDialog('קבוצה חדשה', 'שם הקבוצה (למשל: משפחת כהן)', '');
    if (!label) {
      selectElement.value = '';
      return;
    }
    try {
      const newGroupId = await createResponsibilityGroup(label);
      state.responsibilityGroups = await loadResponsibilityGroups();
      cachedGroups = state.responsibilityGroups;
      renderResponsibilityOptions(cachedGroups);
      renderResponsibilityFilter(cachedGroups);
      selectElement.value = newGroupId; // Auto-select newly created group
      showMessage(`קבוצה "${label}" נוצרה ונבחרה`);
    } catch (error) {
      selectElement.value = '';
      console.error('Error creating group:', error);
    }
  }

  // Handle quick create from Add dialog
  document.getElementById('addResponsibleGroup')?.addEventListener('change', function(e) {
    if (e.target.value === '_create_new') {
      handleQuickCreateGroup(e.target);
    }
  });

  // Handle quick create from Edit dialog
  document.getElementById('editResponsibleGroup')?.addEventListener('change', function(e) {
    if (e.target.value === '_create_new') {
      handleQuickCreateGroup(e.target);
    }
  });

  // Add item form
  els.addItemForm.addEventListener('submit', async (e) => {
    await handleAddItem(e);
    if (els.addDialog && typeof els.addDialog.close === 'function') els.addDialog.close();
  });

  // Auto-assign category
  const addNameInput = els.addItemForm.querySelector('[name="name"]');
  const addCategorySelect = els.addItemForm.querySelector('[name="category"]');
  if (addNameInput && addCategorySelect) {
    addNameInput.addEventListener('blur', () => {
      if (!addCategorySelect.value) {
        const predicted = predictCategory(addNameInput.value);
        if (predicted) addCategorySelect.value = predicted;
      }
    });
  }

  // FAB menu
  if (els.mainFab) {
    els.mainFab.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = els.fabContainer.classList.toggle('open');
      els.mainFab.setAttribute('aria-expanded', isOpen);
      // Don't set aria-hidden when menu contains focusable elements
      // els.fabMenu.setAttribute('aria-hidden', !isOpen);
    });
    document.addEventListener('click', (e) => {
      if (els.fabContainer && els.fabContainer.classList.contains('open') && !els.fabContainer.contains(e.target)) {
        els.fabContainer.classList.remove('open');
        els.mainFab.setAttribute('aria-expanded', 'false');
        // Don't set aria-hidden when menu contains focusable elements
        // els.fabMenu.setAttribute('aria-hidden', 'true');
      }
    });
  }

  if (els.fabAddManual) els.fabAddManual.addEventListener('click', () => {
    els.fabContainer.classList.remove('open');
    els.addItemForm.reset();
    els.addDialog?.showModal();
  });

  // BUG FIX: Shop Mode functionality
  if (els.fabShopMode) {
    els.fabShopMode.addEventListener('click', () => {
      els.fabContainer.classList.remove('open');
      const isShopMode = document.body.classList.toggle('shop-mode');
      showMessage(isShopMode ? 'מצב קנייה הופעל 🛒' : 'מצב רגיל הופעל');
    });
  }

  // BUG FIX: Add missing cancel button handler for Add Item dialog
  if (els.closeAddDialogBtn) {
    els.closeAddDialogBtn.addEventListener('click', () => {
      els.addDialog?.close();
    });
  }

  // Edit dialog
  els.editItemForm.addEventListener('submit', handleSaveEditedItem);
  els.cancelEditBtn.addEventListener('click', () => els.editDialog.close());

  // Navigation
  els.navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.targetTab || btn.dataset.tab;
      switchTab(targetTab);
    });
  });

  // Search and filter
  els.searchInput.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    reRenderAll();
  });

  els.statusFilter.addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    reRenderAll();
  });

  els.sortSelect.addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    reRenderAll();
  });

  // GROUPS: Responsibility filter
  const responsibilityFilterEl = document.getElementById('responsibilityFilter');
  if (responsibilityFilterEl) {
    responsibilityFilterEl.addEventListener('change', (e) => {
      state.filters.responsibility = e.target.value;
      reRenderAll();
    });
  }

  // Home list management — enhanced with #newListDialog (Task 5)
  const handleCreateNewList = () => {
    if (!els.newListDialog) return;
    els.newListDialog.showModal();
    if (els.newListNameInput) {
      els.newListNameInput.value = '';
      els.newListNameInput.focus();
    }
    // Reset type to shopping
    const shoppingRadio = els.newListDialog.querySelector('input[value="shopping"]');
    if (shoppingRadio) shoppingRadio.checked = true;
  };

  // New list dialog — OK button handler
  els.newListDialogOk?.addEventListener('click', async () => {
    const name = els.newListNameInput?.value?.trim();
    if (!name) {
      showMessage('נא להזין שם לרשימה', true);
      return;
    }

    // Get selected type (stored for future use)
    const typeRadio = els.newListDialog.querySelector('input[name="newListType"]:checked');
    const listType = typeRadio?.value || 'shopping';

    els.newListDialog.close();

    const newListId = await createList(name);
    if (newListId) {
      await refreshListCards();
      await handleSwitchList(newListId);

      // Show share dialog so user can invite people
      setTimeout(() => {
        openShareDialog(newListId, name);
      }, 400);
    }
  });

  // New list dialog — Cancel button handler
  els.newListDialogCancel?.addEventListener('click', () => {
    els.newListDialog.close();
  });

  // New list dialog — Close on backdrop click
  els.newListDialog?.addEventListener('click', (e) => {
    if (e.target === els.newListDialog) els.newListDialog.close();
  });

  // New list dialog — Submit on Enter key in name input
  els.newListNameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      els.newListDialogOk?.click();
    }
  });

  els.homeAddListBtn?.addEventListener('click', handleCreateNewList);
  document.getElementById('onboardingCreateListBtn')?.addEventListener('click', handleCreateNewList);

  document.getElementById('onboardingJoinBtn')?.addEventListener('click', async () => {
    const link = await showPromptDialog('הצטרפות לרשימה', 'הדביקו קישור הזמנה או קוד', '');
    if (!link) return;
    
    // Extract token if it's a full URL
    let token = link;
    try {
      if (link.includes('http')) {
        const url = new URL(link);
        token = url.searchParams.get('invite') || link;
      }
    } catch(e) {}
    
    if (token) {
      // Temporarily mock the URL search params so checkInviteToken works
      const originalUrl = window.location.href;
      window.history.replaceState({}, '', `?invite=${token}`);
      const listId = await checkInviteToken();
      if (!listId) {
        window.history.replaceState({}, '', originalUrl.split('?')[0]);
      } else {
        await handleSwitchList(listId);
      }
    }
  });

  // QR Scanner logic
  let html5QrcodeScanner = null;

  const startQrScanner = () => {
    document.getElementById('qrScannerDialog')?.showModal();
    if (!html5QrcodeScanner) {
      html5QrcodeScanner = new Html5Qrcode("qr-reader");
    }
    
    html5QrcodeScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText, decodedResult) => {
        // Stop scanner
        await html5QrcodeScanner.stop();
        document.getElementById('qrScannerDialog')?.close();
        
        let token = decodedText;
        try {
          if (decodedText.includes('http')) {
            const url = new URL(decodedText);
            token = url.searchParams.get('invite') || decodedText;
          }
        } catch(e) {}
        
        if (token) {
          const originalUrl = window.location.href;
          window.history.replaceState({}, '', `?invite=${token}`);
          const listId = await checkInviteToken();
          if (!listId) {
            window.history.replaceState({}, '', originalUrl.split('?')[0]);
          } else {
            await handleSwitchList(listId);
          }
        }
      },
      (errorMessage) => {
        // parse error, ignore
      }
    ).catch(err => {
      showMessage('שגיאה בהפעלת מצלמה: ' + err, true);
    });
  };

  document.getElementById('onboardingJoinQrBtn')?.addEventListener('click', startQrScanner);
  els.fabScanQr?.addEventListener('click', () => {
    els.fabContainer.classList.remove('open');
    startQrScanner();
  });

  document.getElementById('closeQrScannerBtn')?.addEventListener('click', async () => {
    if (html5QrcodeScanner) {
      try {
        await html5QrcodeScanner.stop();
      } catch (e) {}
    }
    document.getElementById('qrScannerDialog')?.close();
  });

  // List actions
  els.listActionRename?.addEventListener('click', async () => {
    const newName = await showPromptDialog('שינוי שם רשימה', 'שם חדש לרשימה', listActionsContext.listName);
    if (!newName) return;
    els.listActionsDialog.close();
    await renameList(listActionsContext.listId, newName);
    await refreshListCards();
  });

  els.listActionDuplicate?.addEventListener('click', async () => {
    const newName = await showPromptDialog('שכפול רשימה', 'שם הרשימה החדשה', listActionsContext.listName + ' - עותק');
    if (!newName) return;
    els.listActionsDialog.close();
    const newListId = await duplicateList(listActionsContext.listId, newName);
    await refreshListCards();
    if (newListId) await handleSwitchList(newListId);
  });

  // Share list — open multi-option share dialog
  els.listActionShareQr?.addEventListener('click', async () => {
    els.listActionsDialog.close();
    await openShareDialog(listActionsContext.listId, listActionsContext.listName);
  });

  // ── Share dialog events ────────────────────────────────────────
  els.shareDialogClose?.addEventListener('click', () => els.shareDialog.close());
  els.shareDialog?.addEventListener('click', (e) => {
    if (e.target === els.shareDialog) els.shareDialog.close();
  });

  // Copy Link
  els.shareCopyLink?.addEventListener('click', async () => {
    if (!currentShareUrl) return;
    try {
      await navigator.clipboard.writeText(currentShareUrl);
      showMessage('הקישור הועתק! 📋');
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = currentShareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showMessage('הקישור הועתק! 📋');
    }
  });

  // WhatsApp share
  els.shareWhatsApp?.addEventListener('click', () => {
    if (!currentShareUrl) return;
    const listName = els.shareListName.textContent;
    const text = `הצטרף/י לרשימה "${listName}" 🛒\n${currentShareUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  });

  // Native share (Web Share API)
  els.shareNative?.addEventListener('click', async () => {
    if (!currentShareUrl || !navigator.share) return;
    const listName = els.shareListName.textContent;
    try {
      await navigator.share({
        title: `רשימת קניות - ${listName}`,
        text: `הצטרף/י לרשימה "${listName}" 🛒`,
        url: currentShareUrl
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        showMessage('השיתוף נכשל', true);
      }
    }
  });

  // Show QR code (toggle)
  els.shareShowQr?.addEventListener('click', () => {
    if (!currentShareUrl) return;
    if (els.shareQrSection.style.display === 'none') {
      els.shareQrSection.style.display = 'block';
      els.shareQrContainer.innerHTML = '';
      new QRCode(els.shareQrContainer, {
        text: currentShareUrl,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      els.shareQrSection.style.display = 'none';
    }
  });

  els.listActionClear?.addEventListener('click', async () => {
    els.listActionsDialog.close();
    await clearCompleted(listActionsContext.listId);
    reRenderAll();
    await refreshListCards();
  });

  els.listActionDelete?.addEventListener('click', async () => {
    const confirmed = await showConfirmDialog('מחיקת רשימה', `האם למחוק את הרשימה "${listActionsContext.listName}"?`);
    if (!confirmed) return;
    els.listActionsDialog.close();
    const deletedListId = listActionsContext.listId;
    const newListId = await deleteList(deletedListId);
    if (newListId) {
      await handleSwitchList(newListId);
    }
    await refreshListCards();
  });

  els.listActionsClose?.addEventListener('click', () => els.listActionsDialog.close());

  // ── List Picker (header dropdown) ──
  els.listPickerTrigger?.addEventListener('click', () => {
    const container = els.listPickerItems;
    container.innerHTML = '';

    for (const list of state.lists) {
      const btn = document.createElement('button');
      btn.className = 'list-picker-item' + (list.id === state.currentListId ? ' active' : '');
      btn.innerHTML = `
        <span class="list-picker-item-name">${list.name}</span>
        <span class="list-picker-item-count">${list.itemCount ?? ''} פריטים</span>
      `;
      btn.addEventListener('click', () => {
        els.listPickerDialog.close();
        if (list.id !== state.currentListId) {
          handleSwitchList(list.id);
        }
      });
      container.appendChild(btn);
    }

    els.listPickerDialog.showModal();
  });

  els.listPickerClose?.addEventListener('click', () => els.listPickerDialog.close());
  els.listPickerDialog?.addEventListener('click', (e) => {
    if (e.target === els.listPickerDialog) els.listPickerDialog.close();
  });

  // Quick-add mode toggle
  els.quickAddModePersonal?.addEventListener('click', () => {
    setQuickAddMode('personal');
    renderQuickAddCarousel(handleQuickAddItem);
  });

  els.quickAddModeCommon?.addEventListener('click', () => {
    setQuickAddMode('common');
    renderQuickAddCarousel(handleQuickAddItem);
  });

  // PWA Install Prompt events
  document.getElementById('pwaInstallDismiss')?.addEventListener('click', dismissInstallPrompt);

  document.getElementById('pwaInstallButton')?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    
    if (outcome === 'accepted') {
      showMessage('האפליקציה מותקנת...');
    }
    
    deferredInstallPrompt = null;
    dismissInstallPrompt();
  });
}

// ─── CACHE & INITIALIZATION ──────────────────────────────────────

function hydrateFromCache() {
  try {
    const raw = localStorage.getItem(LIST_CACHE_KEY);
    if (!raw) return;
    const cached = JSON.parse(raw);
    if (
      cached &&
      cached.listId === state.currentListId &&
      Date.now() - cached.cachedAt < 3600000
    ) {
      state.items = (cached.items || []).map(normalizeItem);
      reRenderAll();
    }
  } catch (e) {}
}

function hydrateDarkMode() {
  const isDark = localStorage.getItem('shopping_list_dark_mode') === '1';
  if (isDark) {
    document.body.classList.add('dark-mode');
    if (els.themeToggleBtn) els.themeToggleBtn.textContent = 'החלף למצב יום ☀️';
    if (els.globalThemeToggle) els.globalThemeToggle.textContent = '☀️';
  }
}

// ── EMAIL VERIFICATION HANDLING ──────────────────────────────────

/**
 * Parse URL hash parameters from Supabase auth callback
 * @returns {Object} Hash parameters
 */
function getHashParams() {
  const hash = window.location.hash.substring(1); // Remove #
  if (!hash) return {};
  
  const params = new URLSearchParams(hash);
  return {
    type: params.get('type'),
    access_token: params.get('access_token'),
    error: params.get('error'),
    error_description: params.get('error_description')
  };
}

/**
 * Show email verification success page
 * @param {Object} user - Supabase user object
 */
function showVerificationSuccess(user) {
  console.log('[Verification] Showing success page for user:', user.email);
  
  // Hide other pages
  document.getElementById('landingPage')?.style.setProperty('display', 'none');
  document.getElementById('appLayout')?.style.setProperty('display', 'none');
  document.getElementById('verificationErrorPage')?.style.setProperty('display', 'none');
  
  // Show verification success page
  const verificationPage = document.getElementById('verificationSuccessPage');
  if (verificationPage) {
    verificationPage.style.display = 'flex';
    
    // Set personalized username
    const displayName = user.user_metadata?.display_name || user.email.split('@')[0];
    const userNameEl = document.getElementById('verifiedUserName');
    if (userNameEl) {
      userNameEl.textContent = displayName;
    }
    
    // Clean URL (remove hash) for better UX
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Auto-redirect to app after 3 seconds
    setTimeout(() => {
      transitionToApp();
    }, 3000);
  }
}

/**
 * Show email verification error page
 * @param {string} errorMessage - Error description
 */
function showVerificationError(errorMessage) {
  console.log('[Verification] Showing error page:', errorMessage);
  
  // Hide other pages
  document.getElementById('landingPage')?.style.setProperty('display', 'none');
  document.getElementById('appLayout')?.style.setProperty('display', 'none');
  document.getElementById('verificationSuccessPage')?.style.setProperty('display', 'none');
  
  // Show error page
  const errorPage = document.getElementById('verificationErrorPage');
  if (errorPage) {
    errorPage.style.display = 'flex';
    
    // Set error message
    const errorDetail = document.getElementById('verificationErrorDetail');
    if (errorDetail && errorMessage) {
      errorDetail.textContent = errorMessage;
    }
    
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

/**
 * Transition from verification page to main app
 */
function transitionToApp() {
  console.log('[Verification] Transitioning to app...');
  
  const verificationPage = document.getElementById('verificationSuccessPage');
  const appLayout = document.getElementById('appLayout');
  
  if (verificationPage) {
    verificationPage.style.display = 'none';
  }
  
  if (appLayout) {
    appLayout.style.display = '';
    
    // Switch to home tab to show lists
    switchTab('home');
    
    // Show welcome message
    showMessage('ברוכים הבאים! ניתן להתחיל להשתמש ברשימת הקניות.', false, 4000);
  }
}

/**
 * Handle email verification flow
 * Called early in boot process
 */
async function handleEmailVerification() {
  const hashParams = getHashParams();
  
  // Check if this is an email verification callback
  if (hashParams.type !== 'signup') {
    return false; // Not a verification flow
  }
  
  console.log('[Verification] Email verification detected');
  
  // Check for errors in URL
  if (hashParams.error) {
    const errorMsg = hashParams.error_description || 'הקישור אינו תקף או שפג תוקפו.';
    showVerificationError(errorMsg);
    return true; // Handled
  }
  
  // Wait for Supabase to process the tokens and authenticate
  // The SDK will automatically exchange the tokens
  // We need to wait for the auth state change
  
  return new Promise((resolve) => {
    let resolved = false;
    
    // Timeout after 5 seconds if auth doesn't complete
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log('[Verification] Timeout waiting for auth');
        showVerificationError('תקלה באימות. נסה להיכנס שוב.');
        resolve(true);
      }
    }, 5000);
    
    // Listen for auth state change
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      console.log('[Verification] Auth state changed:', event);
      
      if (!resolved && event === 'SIGNED_IN' && session?.user) {
        resolved = true;
        clearTimeout(timeout);
        
        // User successfully authenticated
        showVerificationSuccess(session.user);
        
        // Unsubscribe from this specific listener
        subscription.unsubscribe();
        
        resolve(true);
      }
    });
  });
}

async function boot() {
  console.log('[BOOT] Starting boot sequence...');
  
  try {
    initElements();
    console.log('[BOOT] Elements initialized');
    
    hydrateDarkMode();
    hydrateFromCache();
    bindEvents();
    initFilterToggle();
    console.log('[BOOT] Basic setup complete');
    
    // Initialize desktop mode and PWA detection
    initDesktopMode();
    initPWADetection();
    console.log('[BOOT] Desktop mode and PWA detection initialized');
    
    // IMPORTANT: Check for email verification BEFORE initializing auth
    // This prevents the normal auth flow from interfering
    const isVerificationFlow = await handleEmailVerification();
    
    if (isVerificationFlow) {
      // Verification page is shown, don't proceed with normal app init yet
      // The verification page will call transitionToApp() when ready
      console.log('[BOOT] Verification flow handled, waiting for user action...');
      return;
    }
    
    // Normal app initialization
    switchTab('home');
    console.log('[BOOT] Initializing auth...');
    
    await initAuth(async (user) => {
      console.log('[BOOT] Auth callback fired with user:', user?.email || 'NO USER');
      if (user) {
        console.log('[BOOT] User authenticated, loading lists...');
        try {
          await loadLists();
          console.log('[BOOT] Lists loaded, state.lists:', state.lists.length);
          renderLists(handleSwitchList, handleOpenListActions, handleInviteToList);
          
          if (state.currentListId) {
            console.log('[BOOT] Current list ID exists:', state.currentListId);
            // Don't auto-load items or switch to list tab at boot.
            // User will tap a list card on the home tab to enter it.
          } else {
            console.log('[BOOT] No current list ID');
          }
          
          // Check for password recovery callback (uses hash params, not query params)
          const hashParams = getHashParams();
          if (hashParams.type === 'recovery') {
            // Password reset callback - auto-open the password reset dialog
            window.history.replaceState({}, document.title, window.location.pathname);
            document.getElementById('updatePasswordDialog')?.showModal();
          }
          
          const inviteListId = await checkInviteToken();
          if (inviteListId) await handleSwitchList(inviteListId);
        } catch (error) {
          console.error('[BOOT] Error in authenticated user initialization:', error);
          showMessage('שגיאה בטעינת הנתונים. אנא רענן את הדף.', true);
        }
      } else {
        console.log('[BOOT] No user in auth callback');
      }
    });
    
    renderQuickAddCarousel(handleQuickAddItem);
    console.log('[BOOT] Boot sequence complete');
  } catch (error) {
    console.error('[BOOT] CRITICAL ERROR during boot:', error);
    // Show error to user instead of blank screen
    const body = document.body;
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #fee; color: #c00; padding: 24px; border-radius: 8px; max-width: 90%; text-align: center; z-index: 10000; font-family: system-ui, -apple-system, sans-serif;';
    errorDiv.innerHTML = `
      <h2 style="margin: 0 0 16px 0;">❌ שגיאה בטעינה</h2>
      <p style="margin: 0 0 16px 0;">${error.message || 'שגיאה לא צפויה'}</p>
      <button onclick="window.location.reload()" style="padding: 12px 24px; background: #c00; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">
        רענן את הדף
      </button>
    `;
    body.appendChild(errorDiv);
  }
}

// Service Worker - Made graceful for iOS Safari
if ('serviceWorker' in navigator) {
  console.log('[SW] Service Worker API available');
  
  // FIX: Unregister old service workers gracefully
  navigator.serviceWorker.getRegistrations().then(registrations => {
    console.log('[SW] Found', registrations.length, 'existing registrations');
    registrations.forEach(registration => {
      console.log('[SW] Unregistering old service worker');
      registration.unregister();
    });
  }).catch(error => {
    console.warn('[SW] Error unregistering old service workers (non-critical):', error);
  });
  
  // FIX: Register service worker without blocking app initialization
  window.addEventListener('load', () => {
    console.log('[SW] Attempting to register service worker...');
    navigator.serviceWorker.register('./sw.js?v=12')
      .then(registration => {
        console.log('[SW] Service Worker registered successfully:', registration.scope);
      })
      .catch(error => {
        // FIX: Service worker registration failure should not break the app
        console.warn('[SW] Service Worker registration failed (non-critical):', error);
        console.warn('[SW] App will work without offline support');
      });
  });
} else {
  console.warn('[SW] Service Worker API not available (likely iOS Safari in non-PWA mode)');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// ─── ONESIGNAL PUSH NOTIFICATIONS ────────────────────────────────

function initOneSignal() {
  if (typeof OneSignalDeferred === 'undefined') {
    setTimeout(initOneSignal, 1000);
    return;
  }

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  OneSignalDeferred.push(async function (OneSignal) {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        promptOptions: { slidedown: { enabled: false } },
        serviceWorkerPath: 'OneSignalSDKWorker.js',
        serviceWorkerParam: { scope: '/reshima/' }
      });

      updatePushButtonState();

      const pushBtn = document.getElementById('pushSubscribeBtn');
      if (pushBtn) {
        pushBtn.addEventListener('click', async () => {
          const isSubscribed = await OneSignal.User.PushSubscription.optedIn;
          if (isSubscribed) {
            await OneSignal.User.PushSubscription.optOut();
            showMessage('בוטלה הרשמה להתראות.');
          } else {
            await OneSignal.Notifications.requestPermission();
            await OneSignal.User.PushSubscription.optIn();
            showMessage('✅ הרשמת להתראות בהצלחה!');
          }
          updatePushButtonState();
        });
      }

      OneSignal.User.PushSubscription.addEventListener('change', updatePushButtonState);
    } catch (error) {
      console.warn('[OneSignal] Initialization failed:', error);
      const pushBtn = document.getElementById('pushSubscribeBtn');
      if (pushBtn) {
        pushBtn.textContent = 'התראות (לא נתמך בדומיין זה)';
        pushBtn.disabled = true;
      }
    }
  });
}

async function updatePushButtonState() {
  const btn = document.getElementById('pushSubscribeBtn');
  if (!btn) return;

  if (!('PushManager' in window)) {
    btn.textContent = 'הדפדפן לא נתמך';
    btn.disabled = true;
    return;
  }

  try {
    const isSubscribed = await window.OneSignal?.User?.PushSubscription?.optedIn;
    btn.textContent = isSubscribed ? 'בטל הרשמה להתראות' : 'הפעל התראות push';
    btn.dataset.subscribed = isSubscribed ? '1' : '0';
  } catch {
    btn.textContent = 'הפעל התראות push';
    btn.dataset.subscribed = '0';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOneSignal);
} else {
  initOneSignal();
}
