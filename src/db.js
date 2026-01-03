import Database from '@tauri-apps/plugin-sql';
import { LazyStore } from '@tauri-apps/plugin-store';
import { appDataDir, join } from '@tauri-apps/api/path';

let db = null;
let currentDbPath = null;

// Get database path from settings store
export async function getDbPath() {
  if (currentDbPath) return currentDbPath;

  try {
    const store = new LazyStore('settings.json');
    const customPath = await store.get('database_path');

    if (customPath) {
      currentDbPath = customPath;
    } else {
      // Default path in app data directory
      const appDir = await appDataDir();
      currentDbPath = await join(appDir, 'receipt_app.db');
    }
    return currentDbPath;
  } catch (e) {
    // Fallback for browser dev mode or errors
    return 'receipt_app.db';
  }
}

export async function getDb() {
  if (!db) {
    const dbPath = await getDbPath();
    // Use full path for custom locations, simple name for default
    const connectionString = dbPath.includes(':') ? dbPath : `sqlite:${dbPath}`;
    db = await Database.load(connectionString);
  }
  return db;
}

// Close DB connection (needed for path changes)
export async function closeDb() {
  if (db) {
    await db.close();
    db = null;
    currentDbPath = null;
  }
}

// Save new database path to settings
export async function setDbPath(newPath) {
  const store = new LazyStore('settings.json');
  await store.set('database_path', newPath);
  await store.save();
}

// Stock Entries
export async function getAllStockEntries() {
  const database = await getDb();
  return await database.select('SELECT * FROM stock_entries ORDER BY date ASC');
}

export async function addStockEntry(entry) {
  const database = await getDb();
  await database.execute(
    'INSERT INTO stock_entries (id, name, purchase_price, quantity, remaining, date) VALUES ($1, $2, $3, $4, $5, $6)',
    [entry.id, entry.name, entry.purchasePrice, entry.quantity, entry.remaining, entry.date]
  );
}

export async function updateStockEntryRemaining(id, remaining) {
  const database = await getDb();
  await database.execute('UPDATE stock_entries SET remaining = $1 WHERE id = $2', [remaining, id]);
}

export async function deleteStockEntry(id) {
  const database = await getDb();
  await database.execute('DELETE FROM stock_entries WHERE id = $1', [id]);
}

export async function updateStockEntry(entry) {
  const database = await getDb();
  await database.execute(
    'UPDATE stock_entries SET name = $1, purchase_price = $2, quantity = $3, remaining = $4, date = $5 WHERE id = $6',
    [entry.name, entry.purchasePrice, entry.quantity, entry.remaining, entry.date, entry.id]
  );
}

// Item Prices
export async function getAllItemPrices() {
  const database = await getDb();
  return await database.select('SELECT * FROM item_prices');
}

export async function upsertItemPrice(id, name, sellingPrice) {
  const database = await getDb();
  await database.execute(
    'INSERT INTO item_prices (id, name, selling_price) VALUES ($1, $2, $3) ON CONFLICT(name) DO UPDATE SET selling_price = excluded.selling_price',
    [id, name, sellingPrice]
  );
}

export async function deleteItemPrice(id) {
  const database = await getDb();
  await database.execute('DELETE FROM item_prices WHERE id = $1', [id]);
}

export async function updateItemPrice(id, name, sellingPrice) {
  const database = await getDb();
  await database.execute(
    'UPDATE item_prices SET name = $1, selling_price = $2 WHERE id = $3',
    [name, sellingPrice, id]
  );
}

// Rename an item across all stock entries, item prices, and receipt items
export async function renameItem(oldName, newName) {
  const database = await getDb();
  // Update all stock entries with this name
  await database.execute(
    'UPDATE stock_entries SET name = $1 WHERE name = $2',
    [newName, oldName]
  );
  // Update item price
  await database.execute(
    'UPDATE item_prices SET name = $1 WHERE name = $2',
    [newName, oldName]
  );
  // Update historical receipt items
  await database.execute(
    'UPDATE receipt_items SET name = $1 WHERE name = $2',
    [newName, oldName]
  );
}

// Receipts
export async function getAllReceipts() {
  const database = await getDb();
  const receipts = await database.select('SELECT * FROM receipts ORDER BY saved_at DESC');
  for (const receipt of receipts) {
    receipt.items = await database.select('SELECT * FROM receipt_items WHERE receipt_id = $1', [receipt.id]);
  }
  return receipts;
}

export async function addReceipt(receipt) {
  const database = await getDb();
  await database.execute(
    'INSERT INTO receipts (id, bill_no, date, customer_name, others, round_off, total, saved_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [receipt.id, receipt.billNo, receipt.date, receipt.customerName, receipt.others, receipt.roundOff, receipt.total, receipt.savedAt]
  );
  for (const item of receipt.items) {
    await database.execute(
      'INSERT INTO receipt_items (receipt_id, name, qty, rate, amount) VALUES ($1, $2, $3, $4, $5)',
      [receipt.id, item.name, item.qty, item.rate, item.amount]
    );
  }
}

export async function deleteReceipt(id) {
  const database = await getDb();
  await database.execute('DELETE FROM receipt_items WHERE receipt_id = $1', [id]);
  await database.execute('DELETE FROM receipts WHERE id = $1', [id]);
}

export async function updateReceipt(receipt) {
  const database = await getDb();
  await database.execute(
    'UPDATE receipts SET date = $1, customer_name = $2, others = $3, round_off = $4, total = $5 WHERE id = $6',
    [receipt.date, receipt.customerName, receipt.others, receipt.roundOff, receipt.total, receipt.id]
  );
  await database.execute('DELETE FROM receipt_items WHERE receipt_id = $1', [receipt.id]);
  for (const item of receipt.items) {
    await database.execute(
      'INSERT INTO receipt_items (receipt_id, name, qty, rate, amount) VALUES ($1, $2, $3, $4, $5)',
      [receipt.id, item.name, item.qty, item.rate, item.amount]
    );
  }
}

// Business Info
export async function getBusinessInfo() {
  const database = await getDb();
  const rows = await database.select('SELECT * FROM business_info WHERE id = 1');
  return rows[0] || { name: 'BALUS AERATORS', address: '', phone: '', gstin: '' };
}

export async function updateBusinessInfo(info) {
  const database = await getDb();
  await database.execute(
    'UPDATE business_info SET name = $1, address = $2, phone = $3, gstin = $4 WHERE id = 1',
    [info.name, info.address, info.phone, info.gstin]
  );
}

// Bill Counter
export async function getNextBillNo() {
  const database = await getDb();
  const rows = await database.select('SELECT next_bill_no FROM bill_counter WHERE id = 1');
  return rows[0]?.next_bill_no || 1;
}

export async function incrementBillNo() {
  const database = await getDb();
  await database.execute('UPDATE bill_counter SET next_bill_no = next_bill_no + 1 WHERE id = 1');
}

// FIFO Stock Deduction
export async function deductStockFIFO(itemName, qtyToDeduct) {
  const database = await getDb();
  const entries = await database.select(
    'SELECT * FROM stock_entries WHERE name = $1 AND remaining > 0 ORDER BY date ASC',
    [itemName]
  );

  let remaining = qtyToDeduct;
  for (const entry of entries) {
    if (remaining <= 0) break;
    const deduct = Math.min(entry.remaining, remaining);
    await database.execute('UPDATE stock_entries SET remaining = $1 WHERE id = $2', [entry.remaining - deduct, entry.id]);
    remaining -= deduct;
  }
}

// Restore stock when editing/deleting receipt items (reverse FIFO - adds to newest entries first)
export async function restoreStockFIFO(itemName, qtyToRestore) {
  const database = await getDb();
  const entries = await database.select(
    'SELECT * FROM stock_entries WHERE name = $1 ORDER BY date DESC',
    [itemName]
  );

  let remaining = qtyToRestore;
  for (const entry of entries) {
    if (remaining <= 0) break;
    const maxRestore = entry.quantity - entry.remaining;
    const restore = Math.min(maxRestore, remaining);
    if (restore > 0) {
      await database.execute(
        'UPDATE stock_entries SET remaining = $1 WHERE id = $2',
        [entry.remaining + restore, entry.id]
      );
      remaining -= restore;
    }
  }
}

// Check if running in Tauri
export function isTauri() {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
}
