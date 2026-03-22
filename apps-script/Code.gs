/**
 * Code.gs — Google Apps Script Backend for Shopping List PWA
 *
 * Serves as the API backend deployed as a Google Apps Script Web App.
 * Each Google Sheet tab represents a shopping list; rows represent items.
 *
 * Column Schema (Row 1 = headers, data starts at row 2):
 *   A: rowId | B: name | C: quantity | D: category | E: notes
 *   F: purchased | G: createdAt | H: updatedAt | I: price | J: image
 *
 * Auth: Every request must include a `secret` param validated against
 *       ScriptProperties.getProperty('LIST_SHARED_SECRET').
 *
 * Supported actions (12 total):
 *   GET  — list, version, getLists
 *   POST — add, update, toggle, delete, createList, renameList,
 *          deleteList, duplicateList, clearCompleted
 */

// ─── Column Constants ────────────────────────────────────────────────
const COL = {
  ROW_ID:     1,  // A
  NAME:       2,  // B
  QUANTITY:   3,  // C
  CATEGORY:   4,  // D
  NOTES:      5,  // E
  PURCHASED:  6,  // F
  CREATED_AT: 7,  // G
  UPDATED_AT: 8,  // H
  PRICE:      9,  // I
  IMAGE:      10  // J
};

const HEADERS = [
  'rowId', 'name', 'quantity', 'category', 'notes',
  'purchased', 'createdAt', 'updatedAt', 'price', 'image'
];

const NUM_COLS = HEADERS.length;

// Characters forbidden in Google Sheets tab names
const FORBIDDEN_NAME_CHARS = /[\[\]*?\/\\]/;

// ─── FCM HTTP v1 Push Configuration ─────────────────────────────────────────
// Credentials are stored in Script Properties (Project Settings → Script Properties):
//   FCM_PROJECT_ID   → Firebase project ID (e.g. "my-shopping-app-12345")
//   FCM_CLIENT_EMAIL → service_account client_email from the downloaded JSON key
//   FCM_PRIVATE_KEY  → service_account private_key from the downloaded JSON key
// ─────────────────────────────────────────────────────────────────────────────

// ─── Configuration ───────────────────────────────────────────────────

/**
 * Read configuration from Script Properties.
 * @returns {{ secret: string, defaultSheet: string }}
 */
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    secret: props.getProperty('LIST_SHARED_SECRET') || '',
    defaultSheet: props.getProperty('SHEET_NAME') || 'ShoppingList'
  };
}

/**
 * Get the active spreadsheet (cached per execution).
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActive();
}

// ─── Auth ────────────────────────────────────────────────────────────

/**
 * Validate the provided secret against the stored Script Property.
 * Throws if the secret doesn't match (and a secret is configured).
 * @param {string} provided - The secret sent by the client.
 */
function validateSecret(provided) {
  const config = getConfig();
  if (config.secret && provided !== config.secret) {
    throw new Error('סיסמה שגויה');
  }
}

// ─── Response Helpers ────────────────────────────────────────────────

/**
 * Return a JSON success response: { ok: true, ...data }.
 * @param {Object} data - Additional fields to merge into the response.
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function jsonOk(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, ...data }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Return a JSON error response: { ok: false, error: message }.
 * @param {string} message - Human-readable error description.
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function jsonError(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── HTTP Handlers ───────────────────────────────────────────────────

/**
 * Handle GET requests. Routes by `action` query parameter.
 * Supported actions: list, version, getLists.
 * @param {GoogleAppsScript.Events.DoGet} e
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const secret = e.parameter.secret || '';
    validateSecret(secret);

    switch (action) {
      case 'list':
        return jsonOk(handleListItems({ listId: e.parameter.listId }));
      case 'version':
        return jsonOk(handleVersion(e.parameter.listId));
      case 'getLists':
        return jsonOk(handleGetLists());
      default:
        return jsonError('Unknown action: ' + action);
    }
  } catch (err) {
    return jsonError(err.message);
  }
}

/**
 * Handle POST requests. Routes by `action` in the JSON body.
 * Supported actions: add, update, toggle, delete, createList,
 *   renameList, deleteList, duplicateList, clearCompleted.
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    validateSecret(body.secret || '');

    switch (action) {
      case 'add':
        return jsonOk(handleAddItem(body));
      case 'update':
        return jsonOk(handleUpdateItem(body));
      case 'toggle':
        return jsonOk(handleToggleItem(body));
      case 'delete':
        return jsonOk(handleDeleteItem(body));
      case 'createList':
        return jsonOk(handleCreateList(body));
      case 'renameList':
        return jsonOk(handleRenameList(body));
      case 'deleteList':
        return jsonOk(handleDeleteList(body));
      case 'duplicateList':
        return jsonOk(handleDuplicateList(body));
      case 'clearCompleted':
        return jsonOk(handleClearCompleted(body));
      case 'savePushSubscription':
        if (body.subscription) {
          savePushSubscription_(body.subscription);
        }
        return ContentService.createTextOutput(JSON.stringify({ ok: true }))
          .setMimeType(ContentService.MimeType.JSON);
      default:
        return jsonError('Unknown action: ' + action);
    }
  } catch (err) {
    return jsonError(err.message);
  }
}

// ─── List Action Handlers ────────────────────────────────────────────

/**
 * GET — Return all sheet tab names with item counts.
 * @returns {{ lists: Array<{ id: string, name: string, itemCount: number }> }}
 */
function handleGetLists() {
  const ss = getSpreadsheet();
  const sheets = ss.getSheets();
  const lists = sheets.map(function (sheet) {
    const name = sheet.getName();
    const lastRow = sheet.getLastRow();
    const itemCount = Math.max(0, lastRow - 1); // subtract header row
    return { id: name, name: name, itemCount: itemCount };
  });
  return { lists: lists };
}

/**
 * POST — Create a new sheet tab with headers.
 * @param {{ name: string }} params
 * @returns {{ listId: string }}
 */
function handleCreateList(params) {
  const name = (params.name || '').trim();
  validateListName(name);

  const ss = getSpreadsheet();

  // Check for duplicate name
  if (ss.getSheetByName(name)) {
    throw new Error('רשימה בשם זה כבר קיימת');
  }

  const sheet = ss.insertSheet(name);
  // Write header row
  sheet.getRange(1, 1, 1, NUM_COLS).setValues([HEADERS]);

  return { listId: name };
}

/**
 * POST — Rename an existing sheet tab.
 * @param {{ listId: string, newName: string }} params
 * @returns {{ listId: string }}
 */
function handleRenameList(params) {
  const listId = params.listId;
  const newName = (params.newName || '').trim();
  validateListName(newName);

  const ss = getSpreadsheet();

  // Check for duplicate name
  if (ss.getSheetByName(newName)) {
    throw new Error('רשימה בשם זה כבר קיימת');
  }

  const sheet = getSheetByName(listId);
  sheet.setName(newName);

  return { listId: newName };
}

/**
 * POST — Delete a sheet tab. Prevents deleting the last remaining sheet.
 * @param {{ listId: string }} params
 * @returns {{}}
 */
function handleDeleteList(params) {
  const ss = getSpreadsheet();

  // Must keep at least one sheet
  if (ss.getSheets().length <= 1) {
    throw new Error('אי אפשר למחוק את הרשימה האחרונה');
  }

  const sheet = getSheetByName(params.listId);
  ss.deleteSheet(sheet);

  return {};
}

/**
 * POST — Duplicate a sheet tab with regenerated UUIDs.
 * @param {{ sourceListId: string, newName: string }} params
 * @returns {{ listId: string }}
 */
function handleDuplicateList(params) {
  const sourceListId = params.sourceListId || params.listId;
  const newName = (params.newName || '').trim();
  validateListName(newName);

  const ss = getSpreadsheet();

  // Check for duplicate target name
  if (ss.getSheetByName(newName)) {
    throw new Error('רשימה בשם זה כבר קיימת');
  }

  // Find source sheet
  const sourceSheet = ss.getSheetByName(sourceListId);
  if (!sourceSheet) {
    throw new Error('רשימת המקור לא נמצאה');
  }

  // Copy the sheet
  const newSheet = sourceSheet.copyTo(ss);
  newSheet.setName(newName);

  // Regenerate all rowId UUIDs (column A, rows 2+)
  const lastRow = newSheet.getLastRow();
  if (lastRow >= 2) {
    const numItems = lastRow - 1;
    const newIds = [];
    for (var i = 0; i < numItems; i++) {
      newIds.push([Utilities.getUuid()]);
    }
    newSheet.getRange(2, COL.ROW_ID, numItems, 1).setValues(newIds);
  }

  return { listId: newName };
}

// ─── Item Action Handlers ────────────────────────────────────────────

/**
 * GET — Return all items from a sheet.
 * @param {{ listId: string }} params
 * @returns {{ items: Object[], version: string }}
 */
function handleListItems(params) {
  const sheet = getSheetByName(params.listId);
  const items = sheetToItems(sheet);
  return { items: items, version: getVersion(sheet) };
}

/**
 * POST — Add a new item row with a generated UUID.
 * @param {{ listId: string, name: string, quantity: string, category: string, notes: string, price: number|string, image: string }} params
 * @returns {{ rowId: string, version: string }}
 */
function handleAddItem(params) {
  const sheet = getSheetByName(params.listId);
  const rowId = Utilities.getUuid();
  const now = new Date().toISOString();

  const row = [
    rowId,
    params.name || '',
    params.quantity || '',
    params.category || '',
    params.notes || '',
    'FALSE',
    now,
    now,
    params.price || '',
    params.image || ''
  ];

  sheet.appendRow(row);

  // Notify all subscribers
  try {
    sendPushToAll_('רשימת קניות 🛒', 'פריט חדש נוסף לרשימה: ' + (params.name || ''), '');
  } catch(e) { Logger.log('Push notify error: ' + e); }

  return { rowId: rowId, version: getVersion(sheet) };
}

/**
 * POST — Update an existing item by rowId.
 * Updates name, quantity, category, notes, price, image, and updatedAt.
 * @param {{ rowId: string, name: string, quantity: string, category: string, notes: string, price: number|string, image: string }} params
 * @returns {{ version: string }}
 */
function handleUpdateItem(params) {
  const result = findRowByRowId(params.rowId);
  const sheet = result.sheet;
  const rowIndex = result.rowIndex;
  const now = new Date().toISOString();

  // Update columns B-E (name, quantity, category, notes)
  sheet.getRange(rowIndex, COL.NAME).setValue(params.name || '');
  sheet.getRange(rowIndex, COL.QUANTITY).setValue(params.quantity || '');
  sheet.getRange(rowIndex, COL.CATEGORY).setValue(params.category || '');
  sheet.getRange(rowIndex, COL.NOTES).setValue(params.notes || '');

  // Update column H (updatedAt)
  sheet.getRange(rowIndex, COL.UPDATED_AT).setValue(now);

  // Update columns I-J (price, image)
  sheet.getRange(rowIndex, COL.PRICE).setValue(params.price || '');
  sheet.getRange(rowIndex, COL.IMAGE).setValue(params.image || '');

  return { version: getVersion(sheet) };
}

/**
 * POST — Toggle the purchased status of an item by rowId.
 * @param {{ rowId: string, purchased: boolean }} params
 * @returns {{ version: string }}
 */
function handleToggleItem(params) {
  const result = findRowByRowId(params.rowId);
  const sheet = result.sheet;
  const rowIndex = result.rowIndex;
  const now = new Date().toISOString();

  // Update column F (purchased)
  const purchased = params.purchased ? 'TRUE' : 'FALSE';
  sheet.getRange(rowIndex, COL.PURCHASED).setValue(purchased);

  // Update column H (updatedAt)
  sheet.getRange(rowIndex, COL.UPDATED_AT).setValue(now);

  return { version: getVersion(sheet) };
}

/**
 * POST — Delete an item row by rowId.
 * @param {{ rowId: string }} params
 * @returns {{ version: string }}
 */
function handleDeleteItem(params) {
  const result = findRowByRowId(params.rowId);
  const sheet = result.sheet;
  const rowIndex = result.rowIndex;

  sheet.deleteRow(rowIndex);

  return { version: getVersion(sheet) };
}

/**
 * POST — Delete all rows where purchased === TRUE (bottom-to-top).
 * @param {{ listId: string }} params
 * @returns {{ deletedCount: number, version: string }}
 */
function handleClearCompleted(params) {
  const sheet = getSheetByName(params.listId);
  const lastRow = sheet.getLastRow();
  var deletedCount = 0;

  if (lastRow < 2) {
    // No data rows
    return { deletedCount: 0, version: getVersion(sheet) };
  }

  // Read all purchased values (column F, rows 2 to lastRow)
  const purchasedRange = sheet.getRange(2, COL.PURCHASED, lastRow - 1, 1);
  const purchasedValues = purchasedRange.getValues();

  // Iterate from bottom to top to preserve row indices while deleting
  for (var i = purchasedValues.length - 1; i >= 0; i--) {
    const val = String(purchasedValues[i][0]).toUpperCase();
    if (val === 'TRUE') {
      sheet.deleteRow(i + 2); // +2 because data starts at row 2, array is 0-indexed
      deletedCount++;
    }
  }

  return { deletedCount: deletedCount, version: getVersion(sheet) };
}

// ─── Version Handler ─────────────────────────────────────────────────

/**
 * GET — Return the current version string for a sheet.
 * @param {string} [listId] - Optional sheet name; uses default if omitted.
 * @returns {{ version: string }}
 */
function handleVersion(listId) {
  const sheet = getSheetByName(listId);
  return { version: getVersion(sheet) };
}

// ─── Utility Functions ───────────────────────────────────────────────

/**
 * Find a sheet by name. Falls back to the default sheet from config.
 * Throws if the sheet is not found.
 * @param {string} listId - The sheet name to find.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheetByName(listId) {
  const ss = getSpreadsheet();
  const name = (listId && listId.trim()) ? listId.trim() : getConfig().defaultSheet;
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error('הרשימה לא נמצאה');
  }
  return sheet;
}

/**
 * Scan all sheets for a row whose column A matches the given rowId.
 * Returns the sheet and 1-based row index.
 * @param {string} rowId - The UUID to search for.
 * @returns {{ sheet: GoogleAppsScript.Spreadsheet.Sheet, rowIndex: number }}
 */
function findRowByRowId(rowId) {
  if (!rowId) {
    throw new Error('פריט לא נמצא');
  }

  const ss = getSpreadsheet();
  const sheets = ss.getSheets();

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) continue;

    var ids = sheet.getRange(2, COL.ROW_ID, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === rowId) {
        return { sheet: sheet, rowIndex: i + 2 }; // +2: header row + 0-index
      }
    }
  }

  throw new Error('פריט לא נמצא');
}

/**
 * Generate a version string based on the sheet's row count and current time.
 * This changes on any write, triggering client-side sync.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {string}
 */
function getVersion(sheet) {
  return String(sheet.getLastRow()) + '-' + new Date().getTime();
}

/**
 * Convert all data rows in a sheet to an array of item objects.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {Object[]}
 */
function sheetToItems(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  const data = sheet.getRange(2, 1, lastRow - 1, NUM_COLS).getValues();
  return data.map(function (row) {
    return {
      rowId:     row[0],
      name:      row[1],
      quantity:  row[2],
      category:  row[3],
      notes:     row[4],
      purchased: String(row[5]).toUpperCase() === 'TRUE',
      createdAt: row[6],
      updatedAt: row[7],
      price:     row[8],
      image:     row[9]
    };
  });
}

/**
 * Validate a list (sheet) name.
 * - Must not be empty or whitespace-only
 * - Must not exceed 100 characters
 * - Must not contain forbidden characters: [ ] * ? / \
 * @param {string} name
 */
function validateListName(name) {
  if (!name || !name.trim()) {
    throw new Error('שם רשימה לא יכול להיות ריק');
  }
  if (name.length > 100) {
    throw new Error('שם רשימה לא יכול לעלות על 100 תווים');
  }
  if (FORBIDDEN_NAME_CHARS.test(name)) {
    throw new Error('שם רשימה מכיל תווים לא חוקיים');
  }
}

// ─── Push Subscription: save a browser push subscription ─────────────────────
function savePushSubscription_(subscription) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('_push_subscriptions');
  if (!sheet) {
    sheet = ss.insertSheet('_push_subscriptions');
    sheet.appendRow(['subscription_json', 'created_at']);
  }
  const subStr = JSON.stringify(subscription);
  // Avoid duplicates
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === subStr) return; // already exists
  }
  sheet.appendRow([subStr, new Date().toISOString()]);
}

// ─── Get OAuth2 access token from service account for FCM HTTP v1 ─────────────
function getFcmAccessToken_() {
  const props = PropertiesService.getScriptProperties();
  const clientEmail = props.getProperty('FCM_CLIENT_EMAIL');
  const privateKey  = props.getProperty('FCM_PRIVATE_KEY').replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header  = Utilities.base64EncodeWebSafe(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  }));

  const sigInput  = header + '.' + payload;
  const signature = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(sigInput, privateKey)
  );
  const jwt = sigInput + '.' + signature;

  const tokenResp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded',
    payload: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt,
    muteHttpExceptions: true
  });

  const tokenData = JSON.parse(tokenResp.getContentText());
  if (!tokenData.access_token) {
    Logger.log('FCM token error: ' + tokenResp.getContentText());
    throw new Error('Could not obtain FCM access token');
  }
  return tokenData.access_token;
}

// ─── Send push notification to all saved subscriptions via FCM HTTP v1 ────────
function sendPushToAll_(title, body, url) {
  const props = PropertiesService.getScriptProperties();
  const projectId = props.getProperty('FCM_PROJECT_ID');
  if (!projectId) {
    Logger.log('FCM_PROJECT_ID not set in Script Properties — skipping push.');
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('_push_subscriptions');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return; // header row only, no subscriptions

  let accessToken;
  try {
    accessToken = getFcmAccessToken_();
  } catch (e) {
    Logger.log('Could not get FCM access token: ' + e);
    return;
  }

  const fcmUrl = 'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send';

  for (var i = 1; i < data.length; i++) {
    try {
      var sub = JSON.parse(data[i][0]);
      if (!sub || !sub.endpoint) continue;

      // Extract FCM registration token from the endpoint URL
      // FCM endpoints look like: https://fcm.googleapis.com/fcm/send/TOKEN
      // or: https://updates.push.services.mozilla.com/... (Firefox — FCM v1 doesn't support these directly)
      var endpoint = sub.endpoint;
      if (endpoint.indexOf('fcm.googleapis.com') === -1) {
        // Non-FCM endpoint (e.g. Firefox/Mozilla) — skip, FCM HTTP v1 only supports Chrome/FCM tokens
        Logger.log('Skipping non-FCM endpoint: ' + endpoint);
        continue;
      }

      var token = endpoint.split('/').pop();

      var message = {
        message: {
          token: token,
          notification: {
            title: title || 'רשימת קניות',
            body: body || 'עדכון ברשימה'
          },
          webpush: {
            notification: {
              icon: '/reshima/icon-192.png',
              badge: '/reshima/icon-192.png',
              tag: 'shopping-update',
              renotify: true
            },
            fcm_options: {
              link: url || 'https://your-app-url/reshima/'
            }
          }
        }
      };

      var response = UrlFetchApp.fetch(fcmUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(message),
        muteHttpExceptions: true
      });

      var status = response.getResponseCode();
      if (status !== 200) {
        Logger.log('FCM send error for row ' + i + ' (HTTP ' + status + '): ' + response.getContentText());
      }
    } catch (err) {
      Logger.log('Push send error for row ' + i + ': ' + err);
    }
  }
}

// ─── Test function: run this manually from the Apps Script editor to test push ─
function testSendPush() {
  sendPushToAll_('🛒 בדיקת התראה', 'אם קיבלת זאת — Push עובד!', '');
  Logger.log('testSendPush completed — check Apps Script Logs for any errors.');
}
