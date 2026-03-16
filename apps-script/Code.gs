/**
 * Google Apps Script for a shared shopping list with multiple lists.
 *
 * Sheets:
 * Lists: id | name | createdAt
 * Items: rowId | listId | name | quantity | category | notes | price | image | purchased | createdAt | updatedAt
 *
 * Recommended Script Properties:
 * LIST_SHARED_SECRET = choose-a-secret-value   (optional but recommended)
 */

const LISTS_HEADERS = ['id', 'name', 'createdAt'];
const ITEMS_HEADERS = ['rowId', 'listId', 'name', 'quantity', 'category', 'notes', 'price', 'image', 'purchased', 'createdAt', 'updatedAt'];

function doGet(e) {
  return handleRequest_(e, 'GET');
}

function doPost(e) {
  return handleRequest_(e, 'POST');
}

function handleRequest_(e, method) {
  try {
    const payload = getPayload_(e, method);
    authorize_(payload.secret);

    const action = String(payload.action || '').trim();
    if (!action) throw new Error('Missing action');

    let result;
    switch (action) {
      case 'list':
        result = { items: listItems_(payload.listId), version: getVersion_() };
        break;
      case 'add':
        result = addItem_(payload);
        break;
      case 'update':
        result = updateItem_(payload);
        break;
      case 'toggle':
        result = toggleItem_(payload);
        break;
      case 'delete':
        result = deleteItem_(payload);
        break;
      case 'version':
        result = { version: getVersion_() };
        break;
      case 'getLists':
        result = { lists: getLists_() };
        break;
      case 'createList':
        result = createList_(payload);
        break;
      case 'updateList':
        result = updateList_(payload);
        break;
      case 'deleteList':
        result = deleteList_(payload);
        break;
      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    return jsonOutput_({ ok: true, ...result });
  } catch (error) {
    return jsonOutput_({ ok: false, error: error.message });
  }
}

function getPayload_(e, method) {
  if (method === 'POST') {
    if (!e || !e.postData || !e.postData.contents) return {};
    return JSON.parse(e.postData.contents);
  }
  return (e && e.parameter) ? e.parameter : {};
}

function authorize_(providedSecret) {
  const expectedSecret = PropertiesService.getScriptProperties().getProperty('LIST_SHARED_SECRET');
  if (!expectedSecret) return; // secret disabled
  if (String(providedSecret || '') !== String(expectedSecret)) {
    throw new Error('Unauthorized: invalid secret');
  }
}

function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === 'Lists') {
      sheet.getRange(1, 1, 1, LISTS_HEADERS.length).setValues([LISTS_HEADERS]);
      sheet.setFrozenRows(1);
    } else if (name === 'Items') {
      sheet.getRange(1, 1, 1, ITEMS_HEADERS.length).setValues([ITEMS_HEADERS]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function getVersion_() {
  const sheet = getSheet_('Items');
  return sheet.getLastRow();
}

function listItems_(listId) {
  const sheet = getSheet_('Items');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, ITEMS_HEADERS.length).getValues();
  return values
    .filter(row => row[0] && (!listId || row[1] == listId))
    .map(rowToItem_);
}

function rowToItem_(row) {
  return {
    rowId: String(row[0] || ''),
    listId: String(row[1] || ''),
    name: String(row[2] || ''),
    quantity: String(row[3] || ''),
    category: String(row[4] || ''),
    notes: String(row[5] || ''),
    price: String(row[6] || ''),
    image: String(row[7] || ''),
    purchased: String(row[8] || 'false'),
    createdAt: String(row[9] || ''),
    updatedAt: String(row[10] || '')
  };
}

function addItem_(payload) {
  const name = requireField_(payload.name, 'name');
  const quantity = requireField_(payload.quantity, 'quantity');
  const now = new Date().toISOString();
  const rowId = Utilities.getUuid();

  const row = [
    rowId,
    payload.listId || 1,
    name,
    quantity,
    String(payload.category || ''),
    String(payload.notes || ''),
    String(payload.price || ''),
    String(payload.image || ''),
    'false',
    now,
    now
  ];

  const sheet = getSheet_('Items');
  sheet.appendRow(row);
  return { rowId };
}

function updateItem_(payload) {
  const rowIndex = findRowIndexById_(requireField_(payload.rowId, 'rowId'));
  const sheet = getSheet_('Items');
  const current = sheet.getRange(rowIndex, 1, 1, ITEMS_HEADERS.length).getValues()[0];
  const updatedRow = [
    current[0],
    current[1],
    requireField_(payload.name, 'name'),
    requireField_(payload.quantity, 'quantity'),
    String(payload.category || ''),
    String(payload.notes || ''),
    String(payload.price || ''),
    String(payload.image || ''),
    current[8],
    current[9],
    new Date().toISOString()
  ];
  sheet.getRange(rowIndex, 1, 1, ITEMS_HEADERS.length).setValues([updatedRow]);
  return { rowId: current[0] };
}

function toggleItem_(payload) {
  const rowIndex = findRowIndexById_(requireField_(payload.rowId, 'rowId'));
  const sheet = getSheet_('Items');
  sheet.getRange(rowIndex, 9).setValue(String(payload.purchased) === 'true' ? 'true' : 'false');
  sheet.getRange(rowIndex, 11).setValue(new Date().toISOString());
  return { rowId: payload.rowId };
}

function deleteItem_(payload) {
  const rowIndex = findRowIndexById_(requireField_(payload.rowId, 'rowId'));
  getSheet_('Items').deleteRow(rowIndex);
  return { rowId: payload.rowId };
}

function findRowIndexById_(rowId) {
  const sheet = getSheet_('Items');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Row not found');

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const offset = ids.findIndex(id => String(id) === String(rowId));
  if (offset === -1) throw new Error(`Row not found for id ${rowId}`);
  return offset + 2;
}

function getLists_() {
  const sheet = getSheet_('Lists');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, LISTS_HEADERS.length).getValues();
  return values
    .filter(row => row[0])
    .map(row => ({
      id: String(row[0] || ''),
      name: String(row[1] || ''),
      createdAt: String(row[2] || '')
    }));
}

function createList_(payload) {
  const name = requireField_(payload.name, 'name');
  const now = new Date().toISOString();
  const id = getSheet_('Lists').getLastRow(); // simple id

  const row = [id, name, now];
  const sheet = getSheet_('Lists');
  sheet.appendRow(row);
  return { id };
}

function updateList_(payload) {
  const sheet = getSheet_('Lists');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == payload.id) {
      sheet.getRange(i + 1, 2).setValue(payload.name);
      break;
    }
  }
  return {};
}

function deleteList_(payload) {
  const sheet = getSheet_('Lists');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == payload.id) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  // Delete items in that list
  const itemsSheet = getSheet_('Items');
  const itemsData = itemsSheet.getDataRange().getValues();
  for (let i = itemsData.length - 1; i > 0; i--) {
    if (itemsData[i][1] == payload.id) {
      itemsSheet.deleteRow(i + 1);
    }
  }
  return {};
}

function requireField_(value, fieldName) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`Missing required field: ${fieldName}`);
  return normalized;
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
