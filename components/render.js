// Rendering components - items, lists, categories, quick-add carousel
import { state } from '../store/state.js';
import { els } from '../store/elements.js';
import { formatDate, formatTimeOnly, escapeHtml } from '../utils/helpers.js';
import { showConfirmDialog } from './ui.js';

// Quick-add mode: 'personal' | 'common'
export let quickAddMode = 'personal';

// Common grocery items fallback
const COMMON_GROCERY_ITEMS = [
  { name: 'עגבניה', category: 'ירקות ופירות' },
  { name: 'מלפפון', category: 'ירקות ופירות' },
  { name: 'בצל', category: 'ירקות ופירות' },
  { name: 'גזר', category: 'ירקות ופירות' },
  { name: 'תפוח', category: 'ירקות ופירות' },
  { name: 'בננה', category: 'ירקות ופירות' },
  { name: 'לימון', category: 'ירקות ופירות' },
  { name: 'פלפל', category: 'ירקות ופירות' },
  { name: 'חסה', category: 'ירקות ופירות' },
  { name: 'שום', category: 'ירקות ופירות' },
  { name: 'חלב', category: 'מוצרי חלב' },
  { name: 'גבינה לבנה', category: 'מוצרי חלב' },
  { name: 'גבינה צהובה', category: 'מוצרי חלב' },
  { name: 'יוגורט', category: 'מוצרי חלב' },
  { name: 'חמאה', category: 'מוצרי חלב' },
  { name: 'שמנת', category: 'מוצרי חלב' },
  { name: 'ביצים', category: 'מוצרי חלב' },
  { name: 'לחם', category: 'לחם ומאפים' },
  { name: 'פיתה', category: 'לחם ומאפים' },
  { name: 'חלה', category: 'לחם ומאפים' },
  { name: 'עוף', category: 'בשר ודגים' },
  { name: 'בשר טחון', category: 'בשר ודגים' },
  { name: 'סלמון', category: 'בשר ודגים' },
  { name: 'אורז', category: 'מזון יבש' },
  { name: 'פסטה', category: 'מזון יבש' },
  { name: 'קמח', category: 'מזון יבש' },
  { name: 'סוכר', category: 'מזון יבש' },
  { name: 'שמן זית', category: 'מזון יבש' },
  { name: 'רוטב עגבניות', category: 'מזון יבש' },
  { name: 'מים מינרליים', category: 'משקאות' },
  { name: 'מיץ תפוזים', category: 'משקאות' },
  { name: 'קפה', category: 'משקאות' },
  { name: 'סבון כלים', category: 'ניקיון' },
  { name: 'נייר טואלט', category: 'ניקיון' },
  { name: 'שקיות אשפה', category: 'ניקיון' }
];

/**
 * Sort items based on current filter
 * @param {Array} items - Items to sort
 * @returns {Array} Sorted items
 */
function sortItems(items) {
  const sorted = [...items];
  switch (state.filters.sort) {
    case 'created_asc': sorted.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')); break;
    case 'category_asc': sorted.sort((a, b) => `${a.category}|${a.name}`.localeCompare(`${b.category}|${b.name}`, 'he')); break;
    case 'name_asc': sorted.sort((a, b) => a.name.localeCompare(b.name, 'he')); break;
    default: sorted.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }
  return sorted;
}

/**
 * Get visible items based on current filters
 * @returns {Array} Filtered and sorted items
 */
function getVisibleItems() {
  const search = state.filters.search.trim().toLowerCase();
  return sortItems(state.items).filter(item => {
    const matchesSearch = !search || [item.name, item.quantity, item.category, item.notes].join(' ').toLowerCase().includes(search);
    const matchesStatus = state.filters.status === 'all' || (state.filters.status === 'done' && item.purchased) || (state.filters.status === 'active' && !item.purchased);
    
    // Responsibility filter logic (section 7.2 of UX design)
    const matchesResponsibility = (() => {
      switch (state.filters.responsibility) {
        case 'all': return true;
        case 'unassigned': return !item.responsibleGroup;
        case 'assigned': return !!item.responsibleGroup;
        default:
          // Specific group ID selected
          return item.responsibleGroup?.id === state.filters.responsibility;
      }
    })();
    
    return matchesSearch && matchesStatus && matchesResponsibility;
  });
}

/**
 * Render items list with event handlers
 * @param {Function} onToggle - Toggle item callback
 * @param {Function} onEdit - Edit item callback
 * @param {Function} onDelete - Delete item callback
 * @param {Function} onQuantityUpdate - Update quantity callback
 */
export function renderItems(onToggle, onEdit, onDelete, onQuantityUpdate) {
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
    checkbox.addEventListener('change', () => onToggle(item.rowId, checkbox.checked));

    // Item name — click opens edit modal
    const nameEl = node.querySelector('.item-name');
    nameEl.textContent = item.name;
    nameEl.style.cursor = 'pointer';
    nameEl.addEventListener('click', () => onEdit(item));

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

    // Show responsibility group badge if assigned
    const respBadge = node.querySelector('.item-responsibility');
    if (respBadge) {
      if (item.responsibleGroup) {
        respBadge.textContent = `👤 ${item.responsibleGroup.label}`;
        respBadge.style.display = 'inline-flex';
        respBadge.style.background = item.responsibleGroup.color + '22';
        respBadge.style.color = item.responsibleGroup.color;
      } else {
        respBadge.style.display = 'none';
      }
    }

    // Show "Added By" attribution
    const addedByEl = node.querySelector('.item-added-by');
    if (addedByEl) {
      if (item.addedBy) {
        addedByEl.textContent = `נוסף ע״י ${item.addedBy}`;
      } else {
        addedByEl.remove();
      }
    }

    node.querySelector('.item-date').textContent = item.updatedAt ? `עודכן: ${formatDate(item.updatedAt)}` : '';
    node.querySelector('.delete-btn').addEventListener('click', () => onDelete(item.rowId));

    // Inline quantity stepper
    const stepperSection = node.querySelector('.item-stepper');
    const stepperQty = node.querySelector('.stepper-qty');
    const decBtn = node.querySelector('.stepper-dec');
    const incBtn = node.querySelector('.stepper-inc');

    const rawQty = item.quantity || '1';
    const numQty = parseFloat(rawQty);
    const isNumeric = !isNaN(numQty);
    stepperQty.textContent = isNumeric ? String(numQty) : rawQty;

    if (item.purchased) {
      stepperSection.classList.add('stepper-done');
      decBtn.disabled = true;
      incBtn.disabled = true;
    } else {
      incBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const current = parseFloat(stepperQty.textContent);
        const newQty = isNaN(current) ? 2 : current + 1;
        stepperQty.textContent = String(newQty);
        await onQuantityUpdate(item.rowId, String(newQty));
      });
      decBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const current = parseFloat(stepperQty.textContent);
        const newQty = isNaN(current) ? 0 : current - 1;
        if (newQty <= 0) {
          const confirmed = await showConfirmDialog('הסרת פריט', `להסיר את "${item.name}" מהרשימה?`);
          if (confirmed) await onDelete(item.rowId);
        } else {
          stepperQty.textContent = String(newQty);
          await onQuantityUpdate(item.rowId, String(newQty));
        }
      });
    }

    // Swipe Actions & Click Handler
    const itemFront = node.querySelector('.item-front');
    if (itemFront) {
      // BUG FIX: Make entire card clickable to open edit dialog
      itemFront.style.cursor = 'pointer';
      itemFront.addEventListener('click', (e) => {
        // Don't trigger if clicking buttons or interactive elements
        if (!e.target.closest('button, input, .check-wrap, .item-stepper')) {
          onEdit(item);
        }
      });
      
      let startX = 0;
      let currentX = 0;
      itemFront.addEventListener('touchstart', (e) => {
        if (e.target.closest('button, input, select')) return;
        startX = e.touches[0].clientX;
        node.classList.add('swiping');
      }, { passive: true });
      
      itemFront.addEventListener('touchmove', (e) => {
        if (!node.classList.contains('swiping')) return;
        currentX = e.touches[0].clientX - startX;
        if (currentX > 100) currentX = 100;
        if (currentX < -100) currentX = -100;
        itemFront.style.transform = `translateX(${currentX}px)`;
        const ratio = Math.min(Math.abs(currentX) / 80, 1);
        node.style.setProperty('--swipe-ratio', ratio);
      }, { passive: true });
      
      itemFront.addEventListener('touchend', () => {
        if (!node.classList.contains('swiping')) return;
        node.classList.remove('swiping');
        itemFront.style.transform = '';
        node.style.setProperty('--swipe-ratio', '0');
        if (currentX > 80) {
          onDelete(item.rowId);
        } else if (currentX < -80) {
          onToggle(item.rowId, !item.purchased);
        }
        currentX = 0;
      });
    }

    els.itemsList.appendChild(node);
  }
  
  // Update stats
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

/**
 * Render lists in home screen
 * @param {Function} onSwitch - Switch list callback
 * @param {Function} onActions - List actions callback
 * @param {Function} [onInvite] - Invite to list callback (listId, listName)
 */
export function renderLists(onSwitch, onActions, onInvite) {
  const onboardingView = document.getElementById('onboardingView');
  const homeListsView = document.getElementById('homeListsView');

  if (state.lists.length === 0) {
    if (onboardingView) onboardingView.style.display = 'block';
    if (homeListsView) homeListsView.style.display = 'none';
    
    // Set greeting
    const greetingEl = document.getElementById('onboardingGreeting');
    if (greetingEl) {
      const displayName = document.getElementById('userDisplayName')?.textContent || 'חבר/ה';
      greetingEl.textContent = `שלום, ${displayName.split('@')[0]}!`;
    }
  } else {
    if (onboardingView) onboardingView.style.display = 'none';
    if (homeListsView) homeListsView.style.display = 'block';

    if (els.homeListsContainer) {
      els.homeListsContainer.innerHTML = '';
      state.lists.forEach(list => {
        const isActive = list.id == state.currentListId;
        const members = list.members || [];
        const memberCount = members.length;

        // Build member avatars HTML (up to 3)
        const avatarsHtml = members.slice(0, 3).map(m =>
          `<span class="member-avatar" title="${escapeHtml(m.displayName || '')}">${m.avatar || '👤'}</span>`
        ).join('');
        const moreAvatarsHtml = memberCount > 3
          ? `<span class="member-avatar member-more">+${memberCount - 3}</span>`
          : '';

        // Right side: invite button if solo, member count if multiple
        const memberActionHtml = memberCount <= 1
          ? `<button class="list-card-invite-btn" data-list-id="${list.id}" data-list-name="${escapeHtml(list.name)}">+ הזמן</button>`
          : `<span class="member-count">${memberCount} חברים</span>`;

        const card = document.createElement('div');
        card.className = `home-list-card${isActive ? ' active-list' : ''}`;
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <h4 style="margin:0; padding-top:4px;">${escapeHtml(list.name)}</h4>
            <button class="list-more-btn" data-list-id="${list.id}" data-list-name="${escapeHtml(list.name)}">⋮</button>
          </div>
          <div class="list-meta">
            <span>${list.itemCount || 0} פריטים</span>
            ${isActive ? '<span style="color:var(--primary); font-size:12px; font-weight: 700;">★ נבחר</span>' : ''}
          </div>
          <div class="list-card-members">
            <div class="member-avatars">${avatarsHtml}${moreAvatarsHtml}</div>
            ${memberActionHtml}
          </div>
        `;
        // Handle click on the card itself to switch list
        card.addEventListener('click', (e) => {
          if (!e.target.closest('.list-more-btn') && !e.target.closest('.list-card-invite-btn')) {
            onSwitch(list.id);
          }
        });
        
        // Handle click on more button
        const moreBtn = card.querySelector('.list-more-btn');
        if (moreBtn && onActions) {
          moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onActions(list.id, list.name);
          });
        }

        // Handle click on invite button
        const inviteBtn = card.querySelector('.list-card-invite-btn');
        if (inviteBtn && onInvite) {
          inviteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onInvite(list.id, list.name);
          });
        }
        
        els.homeListsContainer.appendChild(card);
      });
    }
  }

  const currentList = state.lists.find(l => l.id == state.currentListId);
  els.currentListName.textContent = currentList ? currentList.name : '';
}

/**
 * Render categories view
 */
export function renderCategories() {
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

/**
 * Build frequency map of item names from state.items
 * @returns {Array} Top frequent items
 */
function getQuickAddItems() {
  const freq = {};
  state.items.forEach(item => {
    const key = item.name.trim();
    if (!key) return;
    if (!freq[key]) freq[key] = { name: key, count: 0, category: item.category || '' };
    freq[key].count += 1;
    if (item.purchased) freq[key].count += 1; // boost purchased items
  });
  return Object.values(freq)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'he'))
    .slice(0, 20);
}

/**
 * Render quick-add carousel
 * @param {Function} onQuickAdd - Quick add callback
 */
export function renderQuickAddCarousel(onQuickAdd) {
  if (!els.quickAddSection || !els.quickAddCarousel) return;

  // Determine effective mode: default to 'common' if no personal items yet
  if (quickAddMode === 'personal' && !state.items.length) {
    quickAddMode = 'common';
  }

  const isCommon = quickAddMode === 'common';
  const items = isCommon ? COMMON_GROCERY_ITEMS : getQuickAddItems();

  if (!items.length) {
    els.quickAddSection.hidden = true;
    return;
  }
  els.quickAddSection.hidden = false;

  // Update toggle button active states
  if (els.quickAddModePersonal && els.quickAddModeCommon) {
    els.quickAddModePersonal.classList.toggle('active', !isCommon);
    els.quickAddModeCommon.classList.toggle('active', isCommon);
  }

  // Update section title if element exists
  if (els.quickAddTitle) {
    els.quickAddTitle.textContent = isCommon ? 'נפוצים' : 'הרגלי';
  }

  els.quickAddCarousel.innerHTML = '';
  items.forEach(({ name, category }) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = isCommon ? 'quick-add-chip fallback' : 'quick-add-chip';
    chip.setAttribute('role', 'listitem');
    chip.setAttribute('title', `הוסף: ${name}`);
    chip.innerHTML = `<span class="quick-add-chip-name">${escapeHtml(name)}</span>${category ? `<span class="quick-add-chip-cat">${escapeHtml(category)}</span>` : ''}`;
    chip.addEventListener('click', () => onQuickAdd(name, category));
    els.quickAddCarousel.appendChild(chip);
  });
}

/**
 * Set quick-add mode
 * @param {string} mode - 'personal' or 'common'
 */
export function setQuickAddMode(mode) {
  quickAddMode = mode;
}
