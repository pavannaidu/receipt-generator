-- Multi-Business Support Migration
-- Creates businesses table and adds business_id to all data tables

-- New businesses table (replaces single-row business_info concept)
CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  gstin TEXT DEFAULT '',
  next_bill_no INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  is_active INTEGER DEFAULT 1
);

-- Add business_id column to all data tables
ALTER TABLE stock_entries ADD COLUMN business_id INTEGER REFERENCES businesses(id);
ALTER TABLE item_prices ADD COLUMN business_id INTEGER REFERENCES businesses(id);
ALTER TABLE receipts ADD COLUMN business_id INTEGER REFERENCES businesses(id);
ALTER TABLE customers ADD COLUMN business_id INTEGER REFERENCES businesses(id);

-- Create indexes for efficient filtering by business
CREATE INDEX IF NOT EXISTS idx_stock_entries_business ON stock_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_item_prices_business ON item_prices(business_id);
CREATE INDEX IF NOT EXISTS idx_receipts_business ON receipts(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);

-- Migrate existing data: Create first business from existing business_info
INSERT INTO businesses (id, name, address, phone, gstin, next_bill_no, created_at)
SELECT
  1,
  COALESCE(bi.name, 'My Business'),
  COALESCE(bi.address, ''),
  COALESCE(bi.phone, ''),
  COALESCE(bi.gstin, ''),
  COALESCE(bc.next_bill_no, 1),
  datetime('now')
FROM (SELECT 1 as dummy) d
LEFT JOIN business_info bi ON bi.id = 1
LEFT JOIN bill_counter bc ON bc.id = 1
WHERE NOT EXISTS (SELECT 1 FROM businesses WHERE id = 1);

-- Assign all existing records to business_id = 1
UPDATE stock_entries SET business_id = 1 WHERE business_id IS NULL;
UPDATE item_prices SET business_id = 1 WHERE business_id IS NULL;
UPDATE receipts SET business_id = 1 WHERE business_id IS NULL;
UPDATE customers SET business_id = 1 WHERE business_id IS NULL;
