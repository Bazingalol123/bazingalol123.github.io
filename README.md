# 🛒 Shared Hebrew Shopping List

A real-time shared shopping list PWA backed by Google Sheets — installable on mobile, works offline, fully in Hebrew RTL.

---

## ✨ Features

- **Multiple lists** — create, rename, duplicate, and delete lists from the side drawer
- **Real-time sync** — all changes go straight to Google Sheets; collaborators stay in sync via version polling
- **Quick Add carousel** — one-tap add from your personal habits or 35 common Israeli grocery items
- **Inline quantity steppers** — tap `+` / `−` directly on each item row, no dialog needed
- **Categories view** — items grouped by category in a dedicated tab
- **Search & filter bar** — collapsible bar to search, filter by status, and sort
- **Price estimation** — header metric card shows estimated cost of remaining items
- **Offline support** — service worker caches the app shell for offline use
- **Installable PWA** — add to home screen on iPhone or Android

---

## 🔧 Setup (Developer)

### 1. Create the Google Sheet

> 📄 A ready-to-use sheet template is included: [google-sheets-template.csv](google-sheets-template.csv) — import it into Google Sheets to get started instantly.

1. Create a new Google Sheet
2. Rename the first sheet tab to `ShoppingList`
3. Add these exact headers in row 1 (columns A–J):

   ```
   rowId | name | quantity | category | notes | purchased | createdAt | updatedAt | price | image
   ```

### 2. Deploy the Apps Script backend

1. In the Google Sheet, go to **Extensions → Apps Script**
2. Replace the default `Code.gs` with the contents of [`apps-script/Code.gs`](apps-script/Code.gs)
3. Go to **Project Settings → Script Properties** and add:
   - `SHEET_NAME` = `ShoppingList`
   - `LIST_SHARED_SECRET` = a passphrase you choose (used as write protection)
4. Click **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy** and copy the generated **Web App URL**

### 3. Configure the app

Open the app, go to the **🔄 Sync** tab in the bottom nav, and paste:
- The **Web App URL** into the URL field
- Your **shared passphrase** into the password field

Click **Save Settings**. Both users need to enter the same URL and passphrase once — they are stored only in the local browser, never in the code.

### 4. Host the frontend

Upload `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.json`, and the icon files to any static host:

- **GitHub Pages** — push to a public repo and enable Pages from the main branch root
- Any static hosting service (Netlify, Vercel, etc.)

Share the same URL with your collaborator.

---

## 📱 How to Use

1. **Open the app** and go to the **🔄 Sync tab** (bottom nav) — enter the Web App URL and passphrase, then tap **Save Settings** and **Test Connection**
2. **Add an item** — tap the **＋ button** (bottom right) to open the add form, or tap any chip in the **Quick Add carousel** for instant one-tap adding
3. **Adjust quantity** — use the **−** and **+** buttons on each item row; tapping **−** to zero will prompt you to delete the item
4. **Check off an item** — tap the checkbox on the left of any item to mark it as bought; tap again to uncheck
5. **Edit an item** — tap the item name to open the edit dialog (name, quantity, category, notes, price, image)
6. **Filter the list** — tap the **🔍 Filter** button in the list header to expand the search/filter bar; search by text, filter by status (all / active / bought), or sort by date, name, or category
7. **Switch Quick Add mode** — tap **הרגלי** (My Habits) to see items from your list history, or **נפוצים** (Common Items) for the 35 built-in Israeli grocery items
8. **Manage lists** — tap the **☰ hamburger** (top left) to open the side drawer; switch lists, create new ones, or tap **⋮** next to a list to rename, duplicate, clear completed items, or delete it
9. **Auto-sync** — in the Sync tab, set a polling interval (3 / 5 / 10 seconds) so the app automatically checks for changes made by your collaborator

---

## 📲 Install as App (PWA)

On **iPhone**: open the app in Safari, tap the **Share** button, then tap **Add to Home Screen**.  
On **Android**: open in Chrome, tap the menu (**⋮**), then tap **Add to Home Screen** or **Install App**.  
Once installed, the app opens full-screen like a native app and works offline.

---

## 🛠 Tech Stack

Vanilla JS · HTML · CSS · Google Sheets (data) · Google Apps Script (API) · Service Worker PWA
