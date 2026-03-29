// UI components - dialogs, toasts, status chips
import { els } from '../store/elements.js';

/**
 * Show confirm dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @returns {Promise<boolean>} User confirmation
 */
export function showConfirmDialog(title, message) {
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
 * Show prompt dialog for user input
 * @param {string} title - Dialog title
 * @param {string} placeholder - Input placeholder
 * @param {string} defaultValue - Default input value
 * @returns {Promise<string|null>} User input or null if cancelled
 */
export function showPromptDialog(title, placeholder, defaultValue) {
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

/**
 * Update connection chip status
 * @param {boolean} hasUrl - Has URL configured
 * @param {boolean} connected - Is connected
 */
export function updateConnectionChip(hasUrl, connected) {
  [els.connectionChip, els.connectionChipMirror].forEach(chip => {
    if (!chip) return;
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

/**
 * Set sync chip text and status
 * @param {string} text - Chip text
 * @param {string} mode - Status mode (connected/disconnected)
 */
export function setSyncChip(text, mode = 'disconnected') {
  if (!els.syncChip) return;
  els.syncChip.textContent = text;
  els.syncChip.classList.remove('connected', 'disconnected');
  if (mode) els.syncChip.classList.add(mode);
}

/**
 * Initialize filter toggle button
 */
export function initFilterToggle() {
  if (!els.filterToggleBtn || !els.filtersCollapse) return;
  els.filterToggleBtn.addEventListener('click', () => {
    const isOpen = els.filtersCollapse.classList.toggle('open');
    els.filterToggleBtn.setAttribute('aria-expanded', String(isOpen));
    els.filtersCollapse.setAttribute('aria-hidden', String(!isOpen));
  });
}

/**
 * Open list actions dialog
 * @param {string} listId - List ID
 * @param {string} listName - List name
 */
export function openListActions(listId, listName) {
  const context = { listId, listName };
  els.listActionsTitle.textContent = `פעולות — "${listName}"`;
  els.listActionsDialog.showModal();
  return context;
}

/**
 * Render responsibility options in select dropdowns
 * @param {Array} groups - Responsibility groups
 */
export function renderResponsibilityOptions(groups) {
  ['addResponsibleGroup', 'editResponsibleGroup'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = '<option value="">ללא אחראי</option>';
    groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.label;
      el.appendChild(opt);
    });
    el.value = current;
  });
}

/**
 * Render manage groups dialog
 * @param {Array} groups - Responsibility groups
 * @param {Function} onDelete - Delete callback
 */
export function renderManageGroupsDialog(groups, onDelete) {
  const container = document.getElementById('groupsList');
  if (!container) return;
  container.innerHTML = '';

  if (!groups.length) {
    container.innerHTML = '<p class="muted" style="text-align:center;">אין קבוצות עדיין.</p>';
    return;
  }

  groups.forEach(group => {
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
      if (confirmed && onDelete) {
        await onDelete(group.id);
      }
    });
    container.appendChild(row);
  });
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
