// IndexedDB-backed offline queue for kiosk QR scans.
// Scans are queued FIFO when navigator.onLine is false and replayed on reconnect.

const DB_NAME = "hms-kiosk";
const DB_VERSION = 1;
const STORE_NAME = "qr_queue";

export interface QueuedScan {
  qr_code_uuid: string;
  event_time: string; // ISO timestamp captured at scan time
  branch_id: string;
  operator_type: "KIOSK";
}

export type QueuedScanWithKey = QueuedScan & { _idbKey: number };

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "_idbKey", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"));
  });
}

export async function enqueueScan(scan: QueuedScan): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add({ ...scan });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getQueuedScans(): Promise<QueuedScanWithKey[]> {
  if (!isBrowser()) return [];
  const db = await openDB();
  const result = await new Promise<QueuedScanWithKey[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const items: QueuedScanWithKey[] = [];
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        const value = cursor.value as QueuedScan;
        items.push({ ...value, _idbKey: Number(cursor.key) });
        cursor.continue();
      } else {
        resolve(items);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
  db.close();
  return result;
}

export async function removeFromQueue(idbKey: number): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(idbKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getQueueCount(): Promise<number> {
  if (!isBrowser()) return 0;
  const db = await openDB();
  const count = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return count;
}
