-- Customers table for storing customer information
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Index for faster name searches
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
