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

// Migrate database schema for new columns
export async function migrateDatabase() {
  const database = await getDb();
  try {
    // Check if product_group column exists by attempting to select it
    await database.select('SELECT product_group FROM stock_entries LIMIT 1');
  } catch (e) {
    // Column doesn't exist, add it
    console.log('Adding product_group column to stock_entries');
    await database.execute('ALTER TABLE stock_entries ADD COLUMN product_group TEXT DEFAULT ""');
  }
  try {
    // Check if provider column exists
    await database.select('SELECT provider FROM stock_entries LIMIT 1');
  } catch (e) {
    // Column doesn't exist, add it
    console.log('Adding provider column to stock_entries');
    await database.execute('ALTER TABLE stock_entries ADD COLUMN provider TEXT DEFAULT ""');
  }

  // Multi-business migration
  await migrateToMultiBusiness();
}

// ==================== MULTI-BUSINESS MIGRATION ====================

export async function migrateToMultiBusiness() {
  const database = await getDb();

  let tableExists = false;
  try {
    // Check if businesses table exists
    await database.select('SELECT id FROM businesses LIMIT 1');
    tableExists = true;
    console.log('Businesses table exists, checking schema...');
  } catch (e) {
    console.log('Running multi-business migration...');
  }

  if (!tableExists) {
    // Create businesses table
    await database.execute(`
      CREATE TABLE IF NOT EXISTS businesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        gstin TEXT DEFAULT '',
        icon TEXT DEFAULT '',
        next_bill_no INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
      )
    `);
  }

  // Always check and add icon column if missing (for databases created before icon was added)
  const columns = await database.select("PRAGMA table_info(businesses)");
  const hasIconColumn = columns.some(col => col.name === 'icon');

  if (!hasIconColumn) {
    console.log('Adding icon column to businesses table...');
    try {
      await database.execute('ALTER TABLE businesses ADD COLUMN icon TEXT DEFAULT ""');
      console.log('Icon column added successfully');
    } catch (alterError) {
      console.error('Failed to add icon column:', alterError);
    }
  }

  // If table already existed with all columns, we're done with basic setup
  if (tableExists) {
    return;
  }

  // Add business_id columns to data tables
  const tables = ['stock_entries', 'item_prices', 'receipts', 'customers'];
  for (const table of tables) {
    try {
      await database.select(`SELECT business_id FROM ${table} LIMIT 1`);
    } catch (e) {
      console.log(`Adding business_id to ${table}`);
      await database.execute(`ALTER TABLE ${table} ADD COLUMN business_id INTEGER REFERENCES businesses(id)`);
    }
  }

  // Create indexes
  await database.execute('CREATE INDEX IF NOT EXISTS idx_stock_entries_business ON stock_entries(business_id)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_item_prices_business ON item_prices(business_id)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_receipts_business ON receipts(business_id)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id)');

  // Check if first business already exists
  const existingBusiness = await database.select('SELECT id FROM businesses WHERE id = 1');
  if (existingBusiness.length === 0) {
    // Create first business from existing business_info
    const businessInfo = await database.select('SELECT * FROM business_info WHERE id = 1');
    const billCounter = await database.select('SELECT next_bill_no FROM bill_counter WHERE id = 1');

    const name = businessInfo[0]?.name || 'My Business';
    const address = businessInfo[0]?.address || '';
    const phone = businessInfo[0]?.phone || '';
    const gstin = businessInfo[0]?.gstin || '';
    const nextBillNo = billCounter[0]?.next_bill_no || 1;

    await database.execute(
      'INSERT INTO businesses (id, name, address, phone, gstin, next_bill_no, created_at) VALUES (1, $1, $2, $3, $4, $5, $6)',
      [name, address, phone, gstin, nextBillNo, new Date().toISOString()]
    );
    console.log('Created first business from existing data');
  }

  // Assign all existing records to business_id = 1
  await database.execute('UPDATE stock_entries SET business_id = 1 WHERE business_id IS NULL');
  await database.execute('UPDATE item_prices SET business_id = 1 WHERE business_id IS NULL');
  await database.execute('UPDATE receipts SET business_id = 1 WHERE business_id IS NULL');
  await database.execute('UPDATE customers SET business_id = 1 WHERE business_id IS NULL');

  console.log('Multi-business migration complete');
}

// ==================== BUSINESS CRUD ====================

export async function getAllBusinesses() {
  const database = await getDb();
  return await database.select('SELECT * FROM businesses WHERE is_active = 1 ORDER BY name ASC');
}

export async function getBusinessById(id) {
  const database = await getDb();
  const rows = await database.select('SELECT * FROM businesses WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function createBusiness(business) {
  try {
    const database = await getDb();
    const result = await database.execute(
      'INSERT INTO businesses (name, address, phone, gstin, icon, next_bill_no, created_at, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, 1)',
      [business.name, business.address || '', business.phone || '', business.gstin || '', business.icon || '', 1, new Date().toISOString()]
    );
    // Get the last inserted ID
    const rows = await database.select('SELECT last_insert_rowid() as id');
    const newId = rows[0]?.id || result.lastInsertId;
    console.log('Created business with ID:', newId);
    return newId;
  } catch (e) {
    console.error('DB createBusiness error:', e);
    throw new Error(`Database error: ${e.message || e}`);
  }
}

export async function updateBusiness(business) {
  const database = await getDb();
  await database.execute(
    'UPDATE businesses SET name = $1, address = $2, phone = $3, gstin = $4, icon = $5 WHERE id = $6',
    [business.name, business.address || '', business.phone || '', business.gstin || '', business.icon || '', business.id]
  );
}

export async function deleteBusiness(id) {
  const database = await getDb();
  // Soft delete - set is_active to 0
  await database.execute('UPDATE businesses SET is_active = 0 WHERE id = $1', [id]);
}

export async function getNextBillNoForBusiness(businessId) {
  const database = await getDb();
  const rows = await database.select('SELECT next_bill_no FROM businesses WHERE id = $1', [businessId]);
  return rows[0]?.next_bill_no || 1;
}

export async function incrementBillNoForBusiness(businessId) {
  const database = await getDb();
  await database.execute('UPDATE businesses SET next_bill_no = next_bill_no + 1 WHERE id = $1', [businessId]);
}

// Stock Entries
export async function getAllStockEntries(businessId) {
  const database = await getDb();
  if (businessId) {
    return await database.select('SELECT * FROM stock_entries WHERE business_id = $1 ORDER BY date ASC', [businessId]);
  }
  return await database.select('SELECT * FROM stock_entries ORDER BY date ASC');
}

export async function addStockEntry(entry, businessId) {
  const database = await getDb();
  await database.execute(
    'INSERT INTO stock_entries (id, name, purchase_price, quantity, remaining, date, product_group, provider, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [entry.id, entry.name, entry.purchasePrice, entry.quantity, entry.remaining, entry.date, entry.productGroup || '', entry.provider || '', businessId]
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
    'UPDATE stock_entries SET name = $1, purchase_price = $2, quantity = $3, remaining = $4, date = $5, product_group = $6, provider = $7 WHERE id = $8',
    [entry.name, entry.purchasePrice, entry.quantity, entry.remaining, entry.date, entry.productGroup || '', entry.provider || '', entry.id]
  );
}

// Item Prices
export async function getAllItemPrices(businessId) {
  const database = await getDb();
  if (businessId) {
    return await database.select('SELECT * FROM item_prices WHERE business_id = $1', [businessId]);
  }
  return await database.select('SELECT * FROM item_prices');
}

export async function upsertItemPrice(id, name, sellingPrice, businessId) {
  const database = await getDb();
  // For multi-business, we need to check conflict on name + business_id
  // First try to find existing
  const existing = await database.select(
    'SELECT id FROM item_prices WHERE name = $1 AND business_id = $2',
    [name, businessId]
  );
  if (existing.length > 0) {
    await database.execute(
      'UPDATE item_prices SET selling_price = $1 WHERE name = $2 AND business_id = $3',
      [sellingPrice, name, businessId]
    );
  } else {
    await database.execute(
      'INSERT INTO item_prices (id, name, selling_price, business_id) VALUES ($1, $2, $3, $4)',
      [id, name, sellingPrice, businessId]
    );
  }
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

// Rename an item across all stock entries, item prices, and receipt items (scoped to business)
export async function renameItem(oldName, newName, businessId) {
  const database = await getDb();
  // Update all stock entries with this name for this business
  await database.execute(
    'UPDATE stock_entries SET name = $1 WHERE name = $2 AND business_id = $3',
    [newName, oldName, businessId]
  );
  // Update item price for this business
  await database.execute(
    'UPDATE item_prices SET name = $1 WHERE name = $2 AND business_id = $3',
    [newName, oldName, businessId]
  );
  // Update historical receipt items for receipts belonging to this business
  await database.execute(
    `UPDATE receipt_items SET name = $1 WHERE name = $2 AND receipt_id IN
     (SELECT id FROM receipts WHERE business_id = $3)`,
    [newName, oldName, businessId]
  );
}

// Receipts
export async function getAllReceipts(businessId) {
  const database = await getDb();
  let receipts;
  if (businessId) {
    receipts = await database.select('SELECT * FROM receipts WHERE business_id = $1 ORDER BY saved_at DESC', [businessId]);
  } else {
    receipts = await database.select('SELECT * FROM receipts ORDER BY saved_at DESC');
  }
  for (const receipt of receipts) {
    receipt.items = await database.select('SELECT * FROM receipt_items WHERE receipt_id = $1', [receipt.id]);
  }
  return receipts;
}

export async function addReceipt(receipt, businessId) {
  const database = await getDb();
  await database.execute(
    'INSERT INTO receipts (id, bill_no, date, customer_name, others, round_off, total, saved_at, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [receipt.id, receipt.billNo, receipt.date, receipt.customerName, receipt.others, receipt.roundOff, receipt.total, receipt.savedAt, businessId]
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

// FIFO Stock Deduction (scoped to business)
export async function deductStockFIFO(itemName, qtyToDeduct, businessId) {
  const database = await getDb();
  const entries = await database.select(
    'SELECT * FROM stock_entries WHERE name = $1 AND remaining > 0 AND business_id = $2 ORDER BY date ASC',
    [itemName, businessId]
  );

  let remaining = qtyToDeduct;
  for (const entry of entries) {
    if (remaining <= 0) break;
    const deduct = Math.min(entry.remaining, remaining);
    await database.execute('UPDATE stock_entries SET remaining = $1 WHERE id = $2', [entry.remaining - deduct, entry.id]);
    remaining -= deduct;
  }
}

// Restore stock when editing/deleting receipt items (reverse FIFO - adds to newest entries first, scoped to business)
export async function restoreStockFIFO(itemName, qtyToRestore, businessId) {
  const database = await getDb();
  const entries = await database.select(
    'SELECT * FROM stock_entries WHERE name = $1 AND business_id = $2 ORDER BY date DESC',
    [itemName, businessId]
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

// ==================== CUSTOMERS ====================

// Migrate customers table
export async function migrateCustomersTable() {
  const database = await getDb();
  try {
    await database.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT DEFAULT '',
        address TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    await database.execute('CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)');
  } catch (e) {
    console.log('Customers table already exists or error:', e);
  }
}

// Get all customers (scoped to business)
export async function getAllCustomers(businessId) {
  const database = await getDb();
  if (businessId) {
    return await database.select('SELECT * FROM customers WHERE business_id = $1 ORDER BY name ASC', [businessId]);
  }
  return await database.select('SELECT * FROM customers ORDER BY name ASC');
}

// Search customers by name (scoped to business)
export async function searchCustomers(searchTerm, businessId) {
  const database = await getDb();
  if (businessId) {
    return await database.select(
      'SELECT * FROM customers WHERE name LIKE $1 AND business_id = $2 ORDER BY name ASC LIMIT 10',
      [`%${searchTerm}%`, businessId]
    );
  }
  return await database.select(
    'SELECT * FROM customers WHERE name LIKE $1 ORDER BY name ASC LIMIT 10',
    [`%${searchTerm}%`]
  );
}

// Add new customer (scoped to business)
export async function addCustomer(customer, businessId) {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.execute(
    'INSERT INTO customers (id, name, phone, address, created_at, updated_at, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [customer.id || Date.now(), customer.name, customer.phone || '', customer.address || '', now, now, businessId]
  );
}

// Update customer
export async function updateCustomer(customer) {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.execute(
    'UPDATE customers SET name = $1, phone = $2, address = $3, updated_at = $4 WHERE id = $5',
    [customer.name, customer.phone || '', customer.address || '', now, customer.id]
  );
}

// Delete customer
export async function deleteCustomer(id) {
  const database = await getDb();
  await database.execute('DELETE FROM customers WHERE id = $1', [id]);
}

// Get customer by name (for quick lookup, scoped to business)
export async function getCustomerByName(name, businessId) {
  const database = await getDb();
  if (businessId) {
    const rows = await database.select('SELECT * FROM customers WHERE name = $1 AND business_id = $2', [name, businessId]);
    return rows[0] || null;
  }
  const rows = await database.select('SELECT * FROM customers WHERE name = $1', [name]);
  return rows[0] || null;
}
