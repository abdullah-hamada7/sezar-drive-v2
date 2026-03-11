# Offline Mode Implementation

Add full offline support to the Sezar Drive frontend. Write transactions are queued in IndexedDB when offline and auto-synced when reconnected. Read (GET) requests return IndexedDB-cached data when offline.

## Proposed Changes

---

### 1. Offline Queue (Write Operations)

#### [NEW] [offline-queue.service.js](file:///d:/sezar-drive-v2/frontend/src/services/offline-queue.service.js)

An IndexedDB store called `sezar_offline_queue`. Each entry stores:
`{ id, idempotencyKey, endpoint, method, body, headers, timestamp, retryCount }`

Exports:
- `offlineQueue.enqueue(request)` — save a failed write
- `offlineQueue.sync(httpService)` — replay all pending requests; remove on success, increment retryCount on failure (max 10)
- `offlineQueue.getAll()` — returns all pending entries (for badge count)
- `offlineQueue.count()` — pending item count

**Queued operations** (POST/PUT/PATCH only, no FormData — photo uploads require connection):
- `POST /trips/:id/start`, `PUT /trips/:id/complete`, `PATCH /trips/:id/accept`, `PATCH /trips/:id/reject`
- `POST /expenses`, `PUT /expenses/:id`
- `PUT /inspections/:id/complete`
- `PUT /shifts/:id/close`
- `PUT /trips/:id/cancel`

**Blocked offline** (cannot be queued — require real-time server response):
- `POST /verify/shift-selfie` (face verification → AWS Rekognition)
- `POST /shifts` (shift creation → face verification required)
- `POST /trips` (admin trip assignment → requires server state check)

---

### 2. Read Cache (GET Operations)

#### [NEW] [read-cache.service.js](file:///d:/sezar-drive-v2/frontend/src/services/read-cache.service.js)

An IndexedDB store called `sezar_read_cache`. Key = full URL path, value = `{ data, cachedAt }`.

Exports:
- `readCache.set(endpoint, data)` — store successful GET response
- `readCache.get(endpoint)` — retrieve cached response (max age: 2 hours)
- `readCache.clear()` — wipe cache on logout

**Cached endpoints:**
- `/trips`, `/trips/:id`, `/shifts/active`, `/shifts`, `/expenses`, `/expenses/categories`, `/inspections`

---

### 3. HTTP Service Update

#### [MODIFY] [http.service.js](file:///d:/sezar-drive-v2/frontend/src/services/http.service.js)

In the [request()](file:///d:/sezar-drive-v2/frontend/src/services/http.service.js#22-103) method, after `catch (err)` where `isNetworkError = true`:

**For GET requests:**
1. Try `readCache.get(endpoint)`
2. If found → return `{ data: cached.data, fromCache: true }` (no throw)
3. If not found → throw original error as before

**For write requests (POST/PUT/PATCH/DELETE):**
1. Check if the endpoint is in the blocked list → throw with message `BLOCKED_OFFLINE`
2. Otherwise → call `offlineQueue.enqueue({ endpoint, method, body, headers })`
3. Dispatch `app:toast` with `{ message: 'Saved offline — will sync when connected', type: 'info', code: 'QUEUED_OFFLINE' }`
4. Return `{ data: null, queued: true }` (so callers don't crash on missing data)

**On successful GET:**
- After `return { data: json }`, also call `readCache.set(endpoint, json)` in the background

---

### 4. Offline Sync Hook

#### [NEW] [useOfflineSync.js](file:///d:/sezar-drive-v2/frontend/src/hooks/useOfflineSync.js)

```
const { isOnline, pendingCount } = useOfflineSync()
```

- Listens to `window` `online` / `offline` events
- On `online` → calls `offlineQueue.sync(http)` → dispatches `app:toast` with result summary ("Synced X transactions")
- Exposes `pendingCount` (refreshed after each sync + on mount)
- Dispatches `app:toast` with warning on first `offline` event

---

### 5. Offline Banner Component

#### [NEW] [OfflineBanner.jsx](file:///d:/sezar-drive-v2/frontend/src/components/OfflineBanner.jsx)

A sticky top banner (shown only when offline or pendingCount > 0):

- **Offline state**: red/amber bar — "You're offline. Changes will sync when reconnected. (N pending)"  
- **Back online + syncing**: brief green bar — "Back online. Syncing..."  
- Uses `useOfflineSync()` hook internally

---

### 6. App Root Mount

#### [MODIFY] [App.jsx](file:///d:/sezar-drive-v2/frontend/src/App.jsx)

Add `<OfflineBanner />` inside `<ToastProvider>` (alongside existing `<GlobalToastListener />`). No other changes needed — all logic lives in the hook and service.

---

## Verification Plan

> [!NOTE]
> No automated tests exist in this project currently. All verification is manual.

### Manual Testing Steps

**Setup**: Open the app in Chrome, open DevTools → Network tab → set Throttling to **"Offline"**.

#### Test 1 — Write queued offline
1. Log in as a driver with an active shift and trip
2. Set Network to Offline
3. Go to Driver Expenses → Add a new expense → Submit
4. **Expected**: "Saved offline — will sync when connected" toast appears; amber banner shows "1 pending"
5. Restore Network to Online
6. **Expected**: "Back online. Syncing..." banner → "Synced 1 transaction" toast → Expense appears in admin panel

#### Test 2 — Reads return cached data
1. While online, navigate to Driver Trips (ensure data loads)
2. Set Network to Offline
3. Navigate away and back to Driver Trips
4. **Expected**: Previous trip data is shown (from cache), NOT a blank page or error

#### Test 3 — Blocked operations show correct error
1. Set Network to Offline
2. Try to start a new shift (face verification flow)
3. **Expected**: Error toast "This action requires an internet connection" — no queue entry created

#### Test 4 — Multiple queued items
1. Set Network to Offline
2. Submit 3 expenses in a row
3. Restore Network
4. **Expected**: All 3 synced successfully; pending count returns to 0
