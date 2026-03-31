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
 * Render responsibility options in select dropdowns with quick create option
 * @param {Array} groups - Responsibility groups
 */
export function renderResponsibilityOptions(groups) {
  ['addResponsibleGroup', 'editResponsibleGroup'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    
    // Build options HTML
    let html = '<option value="_create_new">+ קבוצה חדשה</option>';
    html += '<option value="">ללא אחראי</option>';
    
    groups.forEach(g => {
      const colorDot = g.color ? `<span style="color: ${g.color}">●</span> ` : '';
      html += `<option value="${g.id}">${colorDot}${escapeHtml(g.label)}</option>`;
    });
    
    el.innerHTML = html;
    el.value = current;
  });
}

/**
 * Render responsibility filter dropdown
 * @param {Array} groups - Responsibility groups
 */
export function renderResponsibilityFilter(groups) {
  const el = document.getElementById('responsibilityFilter');
  if (!el) return;
  
  const current = el.value;
  let html = '<option value="all">כל האחריות</option>';
  html += '<option value="unassigned">ללא אחראי</option>';
  html += '<option value="assigned">עם אחראי</option>';
  
  if (groups.length > 0) {
    html += '<optgroup label="קבוצות">';
    groups.forEach(g => {
      const emoji = g.color ? getColorEmoji(g.color) : '●';
      html += `<option value="${g.id}">${emoji} ${escapeHtml(g.label)}</option>`;
    });
    html += '</optgroup>';
  }
  
  el.innerHTML = html;
  el.value = current;
}

/**
 * Get emoji for color value
 * @param {string} color - Color hex value
 * @returns {string} Emoji
 */
function getColorEmoji(color) {
  const colorMap = {
    '#8B5CF6': '🟣',
    '#10B981': '🟢',
    '#3B82F6': '🔵',
    '#F59E0B': '🟠',
    '#EF4444': '🔴',
    '#EC4899': '🩷',
    '#6366F1': '🔮',
    '#14B8A6': '🩵'
  };
  return colorMap[color.toUpperCase()] || '●';
}

/**
 * Render manage groups dialog with full card UI
 * @param {Array} groups - Responsibility groups
 * @param {Function} onDelete - Delete callback
 * @param {Function} onEdit - Edit callback (optional)
 * @param {Function} onAddMember - Add member callback
 * @param {Function} onRemoveMember - Remove member callback
 * @param {Array} listMembers - Available list members for adding
 */
export function renderManageGroupsDialog(groups, onDelete, onEdit = null, onAddMember = null, onRemoveMember = null, listMembers = []) {
  const container = document.getElementById('groupsList');
  if (!container) return;
  container.innerHTML = '';

  // Empty state
  if (!groups.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 32px 16px; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 12px;">👥</div>
        <p style="margin: 0 0 8px; font-weight: 600; color: var(--text);">אין קבוצות עדיין</p>
        <p class="muted" style="margin: 0; font-size: 0.9rem;">צור קבוצה כדי להקצות אחריות לפריטים ברשימה</p>
      </div>
    `;
    return;
  }

  // Render group cards
  groups.forEach(group => {
    const members = group.responsibility_group_members || [];
    const memberNames = members.map(m => m.profiles?.display_name ?? '').filter(Boolean).join(', ');
    const itemCount = group.assignedItemsCount || 0;
    const itemText = itemCount === 1 ? 'פריט מוקצה' : `${itemCount} פריטים מוקצים`;
    
    const card = document.createElement('div');
    card.className = 'group-card';
    card.dataset.groupId = group.id;
    card.style.cssText = '--group-color: ' + (group.color || '#6B7280');
    
    // Build members list HTML (only show in expanded state)
    let membersListHtml = '';
    if (members.length > 0) {
      membersListHtml = members.map(m => {
        const name = m.profiles?.display_name || 'משתמש';
        const emoji = m.profiles?.avatar_emoji || '👤';
        return `
          <div class="group-member-item">
            <span class="member-info">
              <span class="member-emoji">${emoji}</span>
              <span class="member-name">${escapeHtml(name)}</span>
            </span>
            <button class="member-remove-btn" data-user-id="${m.user_id}" data-group-id="${group.id}" title="הסר חבר">×</button>
          </div>
        `;
      }).join('');
    } else {
      membersListHtml = '<p class="group-no-members">אין חברים בקבוצה</p>';
    }
    
    card.innerHTML = `
      <div class="group-indicator" style="background: ${group.color || '#6B7280'};"></div>
      <div class="group-content">
        <h4 class="group-label">${escapeHtml(group.label)}</h4>
        <p class="group-meta">${memberNames || 'אין חברים'}</p>
        <p class="group-items-count">${itemText}</p>
        
        <!-- Expanded content (initially hidden) -->
        <div class="group-expanded-content" style="display: none;">
          <div class="group-members-section">
            <h5 class="group-section-title">חברי הקבוצה</h5>
            <div class="group-members-list">
              ${membersListHtml}
            </div>
            ${onAddMember ? '<button class="group-add-member-btn" data-group-id="' + group.id + '">+ הוסף חבר</button>' : ''}
          </div>
        </div>
      </div>
      <button class="group-delete-btn" data-group-id="${group.id}" title="מחק קבוצה" aria-label="מחק את ${escapeHtml(group.label)}">🗑</button>
    `;
    
    // Delete button handler
    const deleteBtn = card.querySelector('.group-delete-btn');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const message = itemCount > 0
        ? `⚠️ ${itemCount} פריטים מוקצים יאבדו את האחראי. האם להמשיך?`
        : `למחוק את "${group.label}"?`;
      
      const confirmed = await showConfirmDialog('מחיקת קבוצה', message);
      if (confirmed && onDelete) {
        const result = await onDelete(group.id);
        if (result !== false) {
          card.remove();
        }
      }
    });
    
    // Toggle expanded content when card is clicked
    const expandedContent = card.querySelector('.group-expanded-content');
    const groupContent = card.querySelector('.group-content');
    card.addEventListener('click', (e) => {
      // Don't toggle if clicking delete button or member action buttons
      if (e.target.closest('.group-delete-btn') ||
          e.target.closest('.member-remove-btn') ||
          e.target.closest('.group-add-member-btn')) {
        return;
      }
      
      const isExpanded = expandedContent.style.display !== 'none';
      expandedContent.style.display = isExpanded ? 'none' : 'block';
      card.classList.toggle('expanded', !isExpanded);
    });
    
    // Add member button handler
    if (onAddMember) {
      const addMemberBtn = card.querySelector('.group-add-member-btn');
      addMemberBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await onAddMember(group.id, group.label, members, listMembers);
      });
    }
    
    // Remove member button handlers
    if (onRemoveMember) {
      const removeBtns = card.querySelectorAll('.member-remove-btn');
      removeBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const userId = btn.dataset.userId;
          const groupId = btn.dataset.groupId;
          await onRemoveMember(groupId, userId);
        });
      });
    }
    
    container.appendChild(card);
  });
}

/**
 * Show member picker dialog
 * @param {string} groupId - Group ID
 * @param {string} groupLabel - Group label
 * @param {Array} currentMembers - Current group members
 * @param {Array} availableMembers - All list members
 * @returns {Promise<string|null>} Selected user ID or null
 */
export function showMemberPicker(groupId, groupLabel, currentMembers, availableMembers) {
  return new Promise((resolve) => {
    // Filter out members already in the group
    const currentMemberIds = new Set(currentMembers.map(m => m.user_id));
    const availableToAdd = availableMembers.filter(m => !currentMemberIds.has(m.userId));
    
    if (availableToAdd.length === 0) {
      showConfirmDialog('אין חברים זמינים', 'כל חברי הרשימה כבר נמצאים בקבוצה זו.');
      resolve(null);
      return;
    }
    
    // Create a custom dialog
    const dialog = document.createElement('dialog');
    dialog.className = 'app-dialog member-picker-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h3>הוסף חבר לקבוצה "${escapeHtml(groupLabel)}"</h3>
        <p class="muted">בחר משתמש להוספה לקבוצה</p>
        <div class="member-picker-list">
          ${availableToAdd.map(member => `
            <button class="member-picker-item" data-user-id="${member.userId}">
              <span class="member-emoji">${member.avatarEmoji}</span>
              <span class="member-name">${escapeHtml(member.displayName)}</span>
            </button>
          `).join('')}
        </div>
        <button class="btn-secondary" id="cancelMemberPicker" style="margin-top: 16px;">ביטול</button>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    function cleanup() {
      dialog.close();
      dialog.remove();
    }
    
    // Handle member selection
    const memberBtns = dialog.querySelectorAll('.member-picker-item');
    memberBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const userId = btn.dataset.userId;
        cleanup();
        resolve(userId);
      });
    });
    
    // Handle cancel
    dialog.querySelector('#cancelMemberPicker')?.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });
    
    dialog.addEventListener('close', () => {
      cleanup();
      resolve(null);
    });
    
    dialog.showModal();
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
