-- Business Info (single row)
CREATE TABLE IF NOT EXISTS business_info (
  id INTEGER PRIMARY KEY DEFAULT 1,
  name TEXT NOT NULL DEFAULT 'BALUS AERATORS',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  gstin TEXT DEFAULT ''
);

-- Bill Counter
CREATE TABLE IF NOT EXISTS bill_counter (
  id INTEGER PRIMARY KEY DEFAULT 1,
  next_bill_no INTEGER NOT NULL DEFAULT 1
);

-- Stock Entries
CREATE TABLE IF NOT EXISTS stock_entries (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  purchase_price REAL NOT NULL DEFAULT 0,
  quantity REAL NOT NULL,
  remaining REAL NOT NULL,
  date TEXT NOT NULL
);

-- Item Prices
CREATE TABLE IF NOT EXISTS item_prices (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  selling_price REAL NOT NULL DEFAULT 0
);

-- Receipts
CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY,
  bill_no INTEGER NOT NULL,
  date TEXT NOT NULL,
  customer_name TEXT DEFAULT '',
  others REAL DEFAULT 0,
  round_off REAL DEFAULT 0,
  total REAL NOT NULL,
  saved_at TEXT NOT NULL
);

-- Receipt Items
CREATE TABLE IF NOT EXISTS receipt_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  qty REAL NOT NULL,
  rate REAL NOT NULL,
  amount REAL NOT NULL,
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
);

-- Initialize default rows
INSERT OR IGNORE INTO business_info (id) VALUES (1);
INSERT OR IGNORE INTO bill_counter (id, next_bill_no) VALUES (1, 1);
