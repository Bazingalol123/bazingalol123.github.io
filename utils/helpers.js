// Utility helper functions

/**
 * Format date to Hebrew locale with date and time
 * @param {string} value - ISO date string
 * @returns {string} Formatted date string
 */
export function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

/**
 * Format time only to Hebrew locale
 * @param {string} value - ISO date string
 * @returns {string} Formatted time string
 */
export function formatTimeOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('he-IL', { timeStyle: 'short' }).format(date);
}

/**
 * Escape HTML special characters to prevent XSS in innerHTML
 * @param {string} str - String to escape
 * @returns {string} Escaped HTML string
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Show loading overlay
 */
export function showLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.hidden = false;
}

/**
 * Hide loading overlay
 */
export function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.hidden = true;
}

/**
 * Show status message
 * @param {string} message - Message to display
 * @param {boolean} isError - Whether this is an error message
 */
export function showMessage(message, isError = false) {
  const statusMessage = document.getElementById('statusMessage');
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.classList.remove('hidden', 'error');
  if (isError) statusMessage.classList.add('error');
}

/**
 * Hide status message
 */
export function hideMessage() {
  const statusMessage = document.getElementById('statusMessage');
  if (statusMessage) statusMessage.classList.add('hidden');
}

/**
 * Check if value is a UUID
 * @param {string} value - Value to check
 * @returns {boolean}
 */
export function isUUID(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

/**
 * Check if value is a boolean string
 * @param {string} value - Value to check
 * @returns {boolean}
 */
export function isBooleanString(value) {
  const v = String(value).trim().toLowerCase();
  return v === 'true' || v === 'false';
}

/**
 * Normalize item data - sanitize UUID/boolean leakage
 * @param {Object} item - Raw item data
 * @returns {Object} Normalized item
 */
export function normalizeItem(item) {
  const purchased = String(item.purchased).toLowerCase() === 'true';
  // Guard against UUID or boolean values leaking into text fields
  const safeStr = (val) => {
    const s = val || '';
    if (isUUID(s) || isBooleanString(s)) return '';
    return s;
  };
  return {
    rowId: String(item.rowId),
    name: item.name || '',
    quantity: safeStr(item.quantity),
    category: safeStr(item.category),
    notes: safeStr(item.notes),
    price: item.price || '',
    image: item.image || '',
    purchased,
    createdAt: item.createdAt || '',
    updatedAt: item.updatedAt || '',
    addedBy: item.addedBy || '',
    updatedBy: item.updatedBy || '',
    responsibleGroup: item.responsibleGroup || null
  };
}

/**
 * Debounce function - limits the rate at which a function can fire
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
