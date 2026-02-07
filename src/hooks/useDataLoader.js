import { useState, useEffect } from 'react';
import * as db from '../db';
import { getLocalDateString } from '../utils/dateUtils';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { DEFAULT_BUSINESS_INFO } from '../constants/defaults';

/**
 * Custom hook for loading and persisting app data
 * Handles both Tauri (SQLite) and browser (localStorage) environments
 * @param {number} businessId - The current business ID (for multi-business support)
 */
export function useDataLoader(businessId) {
  const [stockEntries, setStockEntries] = useState([]);
  const [itemPrices, setItemPrices] = useState([]);
  const [savedReceipts, setSavedReceipts] = useState([]);
  const [businessInfo, setBusinessInfo] = useState(DEFAULT_BUSINESS_INFO);
  const [nextBillNo, setNextBillNo] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isTauri, setIsTauri] = useState(false);

  // Load data on mount or when businessId changes
  useEffect(() => {
    const loadFromTauri = async (bizId) => {
      // Run database schema migrations
      await db.migrateDatabase();

      // Check if migration from localStorage is needed
      const migrated = localStorage.getItem(STORAGE_KEYS.MIGRATED_TO_SQLITE);
      if (!migrated) {
        await migrateLocalStorageToSQLite();
        localStorage.setItem(STORAGE_KEYS.MIGRATED_TO_SQLITE, 'true');
      }

      // If no businessId provided, just load legacy data
      if (!bizId) {
        const [entries, prices, receipts, business, billNo] = await Promise.all([
          db.getAllStockEntries(),
          db.getAllItemPrices(),
          db.getAllReceipts(),
          db.getBusinessInfo(),
          db.getNextBillNo()
        ]);
        setStockEntries(mapStockEntries(entries));
        setItemPrices(mapItemPrices(prices));
        setSavedReceipts(mapReceipts(receipts));
        setBusinessInfo(business);
        setNextBillNo(billNo);
        return;
      }

      // Load business-scoped data
      const [entries, prices, receipts, business, billNo] = await Promise.all([
        db.getAllStockEntries(bizId),
        db.getAllItemPrices(bizId),
        db.getAllReceipts(bizId),
        db.getBusinessById(bizId),
        db.getNextBillNoForBusiness(bizId)
      ]);

      setStockEntries(mapStockEntries(entries));
      setItemPrices(mapItemPrices(prices));
      setSavedReceipts(mapReceipts(receipts));

      // Set business info from the selected business
      if (business) {
        setBusinessInfo({
          name: business.name,
          address: business.address || '',
          phone: business.phone || '',
          gstin: business.gstin || '',
          icon: business.icon || ''
        });
      }
      setNextBillNo(billNo);
    };

    const loadData = async () => {
      const tauriEnv = db.isTauri();
      setIsTauri(tauriEnv);

      if (tauriEnv) {
        try {
          await loadFromTauri(businessId);
        } catch (err) {
          console.error('Error loading from database:', err);
          setIsTauri(false);
          loadFromLocalStorage();
        }
      } else {
        loadFromLocalStorage();
      }
      setIsLoading(false);
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // Helper to map stock entries from DB format
  const mapStockEntries = (entries) => entries.map(e => ({
    id: e.id,
    name: e.name,
    purchasePrice: e.purchase_price,
    quantity: e.quantity,
    remaining: e.remaining,
    date: e.date,
    productGroup: e.product_group || '',
    provider: e.provider || ''
  }));

  // Helper to map item prices from DB format
  const mapItemPrices = (prices) => prices.map(p => ({
    id: p.id,
    name: p.name,
    sellingPrice: p.selling_price
  }));

  // Helper to map receipts from DB format
  const mapReceipts = (receipts) => receipts.map(r => ({
    id: r.id,
    billNo: r.bill_no,
    date: r.date,
    customerName: r.customer_name,
    others: r.others,
    roundOff: r.round_off,
    total: r.total,
    savedAt: r.saved_at,
    items: r.items.map(i => ({
      name: i.name,
      qty: i.qty,
      rate: i.rate,
      amount: i.amount
    }))
  }));

  // Migrate localStorage data to SQLite
  const migrateLocalStorageToSQLite = async () => {
    const oldEntries = localStorage.getItem(STORAGE_KEYS.STOCK_ENTRIES);
    const oldPrices = localStorage.getItem(STORAGE_KEYS.ITEM_PRICES);
    const oldReceipts = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    const oldBusiness = localStorage.getItem(STORAGE_KEYS.BUSINESS);
    const oldBillNo = localStorage.getItem(STORAGE_KEYS.BILL_NO);

    // Default to business 1 for migrated data
    const defaultBizId = 1;
    if (oldEntries) {
      for (const e of JSON.parse(oldEntries)) {
        await db.addStockEntry(e, defaultBizId);
      }
    }
    if (oldPrices) {
      for (const p of JSON.parse(oldPrices)) {
        await db.upsertItemPrice(p.id, p.name, p.sellingPrice, defaultBizId);
      }
    }
    if (oldReceipts) {
      for (const r of JSON.parse(oldReceipts)) {
        await db.addReceipt(r, defaultBizId);
      }
    }
    if (oldBusiness) {
      await db.updateBusinessInfo(JSON.parse(oldBusiness));
    }
    if (oldBillNo) {
      const database = await db.getDb();
      await database.execute(
        'UPDATE bill_counter SET next_bill_no = $1 WHERE id = 1',
        [parseInt(oldBillNo)]
      );
    }
  };

  // Load data from localStorage (browser mode)
  const loadFromLocalStorage = () => {
    const savedStockEntries = localStorage.getItem(STORAGE_KEYS.STOCK_ENTRIES);
    const savedItemPrices = localStorage.getItem(STORAGE_KEYS.ITEM_PRICES);
    const savedReceiptsData = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    const savedBillNo = localStorage.getItem(STORAGE_KEYS.BILL_NO);
    const savedBusinessInfo = localStorage.getItem(STORAGE_KEYS.BUSINESS);

    // Migration from old catalog format
    const oldCatalog = localStorage.getItem(STORAGE_KEYS.CATALOG_LEGACY);
    if (oldCatalog && !savedStockEntries) {
      const items = JSON.parse(oldCatalog);
      const entries = items.filter(item => item.inventory > 0).map(item => ({
        id: item.id,
        name: item.name,
        purchasePrice: item.purchasePrice || 0,
        quantity: item.inventory,
        remaining: item.inventory,
        date: getLocalDateString(),
        productGroup: '',
        provider: ''
      }));
      const prices = items.map(item => ({
        id: item.id + 1,
        name: item.name,
        sellingPrice: item.sellingPrice || 0
      }));
      setStockEntries(entries);
      setItemPrices(prices);
      localStorage.removeItem(STORAGE_KEYS.CATALOG_LEGACY);
    } else {
      if (savedStockEntries) {
        const entries = JSON.parse(savedStockEntries).map(e => ({
          ...e,
          productGroup: e.productGroup || '',
          provider: e.provider || ''
        }));
        setStockEntries(entries);
      }
      if (savedItemPrices) {
        setItemPrices(JSON.parse(savedItemPrices));
      }
    }

    if (savedReceiptsData) {
      setSavedReceipts(JSON.parse(savedReceiptsData));
    }
    if (savedBillNo) {
      setNextBillNo(parseInt(savedBillNo));
    }
    if (savedBusinessInfo) {
      setBusinessInfo(JSON.parse(savedBusinessInfo));
    }
  };

  // Persist data to localStorage (only in browser mode)
  useEffect(() => {
    if (!isTauri && !isLoading) {
      localStorage.setItem(STORAGE_KEYS.STOCK_ENTRIES, JSON.stringify(stockEntries));
    }
  }, [stockEntries, isTauri, isLoading]);

  useEffect(() => {
    if (!isTauri && !isLoading) {
      localStorage.setItem(STORAGE_KEYS.ITEM_PRICES, JSON.stringify(itemPrices));
    }
  }, [itemPrices, isTauri, isLoading]);

  useEffect(() => {
    if (!isTauri && !isLoading) {
      localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(savedReceipts));
    }
  }, [savedReceipts, isTauri, isLoading]);

  useEffect(() => {
    if (!isTauri && !isLoading) {
      localStorage.setItem(STORAGE_KEYS.BUSINESS, JSON.stringify(businessInfo));
    }
  }, [businessInfo, isTauri, isLoading]);

  return {
    // State
    stockEntries,
    setStockEntries,
    itemPrices,
    setItemPrices,
    savedReceipts,
    setSavedReceipts,
    businessInfo,
    setBusinessInfo,
    nextBillNo,
    setNextBillNo,
    isLoading,
    isTauri
  };
}
