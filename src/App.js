import React, { useState, useEffect } from 'react';
import * as db from './db';
import { updateStockEntry, updateReceipt, restoreStockFIFO, renameItem } from './db';

// Utils
import { formatIndianCurrency } from './utils/formatters';
import { formatDate, getLocalDateString } from './utils/dateUtils';

// Styles
import { inputStyle, btnPrimary, btnSecondary } from './styles/theme';

// Components
import {
  ReceiptPreview,
  DeleteModal,
  PrintPreviewModal,
  SalesChart,
  BusinessSettingsModal,
  MergeModal
} from './components';

export default function ReceiptGenerator() {
  const [businessInfo, setBusinessInfo] = useState({ name: 'BALUS AERATORS', address: '', phone: '', gstin: '' });

  // New data model: separate stock entries and item prices
  const [stockEntries, setStockEntries] = useState([]);
  const [itemPrices, setItemPrices] = useState([]);
  const [newEntry, setNewEntry] = useState({ name: '', purchasePrice: '', quantity: '', date: getLocalDateString(), productGroup: '', provider: '' });

  const [currentReceipt, setCurrentReceipt] = useState({
    billNo: 1, date: getLocalDateString(), customerName: '', items: [], others: 0, roundOff: 0
  });
  const [newItem, setNewItem] = useState({ name: '', qty: 1, rate: 0 });
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  const [savedReceipts, setSavedReceipts] = useState([]);
  const [activeTab, setActiveTab] = useState('create');
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ show: false, receiptId: null, entryId: null });
  const [printPreviewModal, setPrintPreviewModal] = useState({ show: false, receipt: null });
  const [successMessage, setSuccessMessage] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isTauri, setIsTauri] = useState(false);

  // Edit state for inventory
  const [editingStockId, setEditingStockId] = useState(null);
  const [editingStockData, setEditingStockData] = useState(null);

  // Edit state for receipts
  const [editingReceipt, setEditingReceipt] = useState(null);

  // State for renaming items at group header level
  const [renamingItem, setRenamingItem] = useState(null); // { oldName, newName, productGroup }

  // State for inventory collapsed view
  const [expandedItems, setExpandedItems] = useState({}); // { itemName: true/false }
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryGroupFilter, setInventoryGroupFilter] = useState('');
  const [inventoryProviderFilter, setInventoryProviderFilter] = useState('');

  // Merge modal state (for merging items when renaming to existing name)
  const [mergeModal, setMergeModal] = useState({ show: false, oldName: '', targetName: '', oldEntries: [], targetEntries: [] });

  // State for history collapsed view
  const [expandedReceipts, setExpandedReceipts] = useState({}); // { receiptId: true/false }
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('today'); // 'today', 'week', 'month', 'custom'

  // State for collapsible preview in Create pane
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [historyCustomRange, setHistoryCustomRange] = useState({
    from: getLocalDateString(),
    to: getLocalDateString()
  });

  // Load data on mount (from SQLite if Tauri, else localStorage)
  useEffect(() => {
    const loadData = async () => {
      const tauriEnv = db.isTauri();
      setIsTauri(tauriEnv);

      if (tauriEnv) {
        try {
          // Run database schema migrations for new columns
          await db.migrateDatabase();

          // Check if migration from localStorage is needed
          const migrated = localStorage.getItem('receiptApp_migrated_to_sqlite');
          if (!migrated) {
            // Migrate existing localStorage data to SQLite
            const oldEntries = localStorage.getItem('receiptApp_stockEntries');
            const oldPrices = localStorage.getItem('receiptApp_itemPrices');
            const oldReceipts = localStorage.getItem('receiptApp_receipts');
            const oldBusiness = localStorage.getItem('receiptApp_business');
            const oldBillNo = localStorage.getItem('receiptApp_billNo');

            if (oldEntries) {
              for (const e of JSON.parse(oldEntries)) {
                await db.addStockEntry(e);
              }
            }
            if (oldPrices) {
              for (const p of JSON.parse(oldPrices)) {
                await db.upsertItemPrice(p.id, p.name, p.sellingPrice);
              }
            }
            if (oldReceipts) {
              for (const r of JSON.parse(oldReceipts)) {
                await db.addReceipt(r);
              }
            }
            if (oldBusiness) {
              await db.updateBusinessInfo(JSON.parse(oldBusiness));
            }
            if (oldBillNo) {
              const database = await db.getDb();
              await database.execute('UPDATE bill_counter SET next_bill_no = $1 WHERE id = 1', [parseInt(oldBillNo)]);
            }
            localStorage.setItem('receiptApp_migrated_to_sqlite', 'true');
          }

          // Load from SQLite
          const [entries, prices, receipts, business, billNo] = await Promise.all([
            db.getAllStockEntries(),
            db.getAllItemPrices(),
            db.getAllReceipts(),
            db.getBusinessInfo(),
            db.getNextBillNo()
          ]);

          setStockEntries(entries.map(e => ({
            id: e.id, name: e.name, purchasePrice: e.purchase_price,
            quantity: e.quantity, remaining: e.remaining, date: e.date,
            productGroup: e.product_group || '', provider: e.provider || ''
          })));
          setItemPrices(prices.map(p => ({
            id: p.id, name: p.name, sellingPrice: p.selling_price
          })));
          setSavedReceipts(receipts.map(r => ({
            id: r.id, billNo: r.bill_no, date: r.date, customerName: r.customer_name,
            others: r.others, roundOff: r.round_off, total: r.total, savedAt: r.saved_at,
            items: r.items.map(i => ({ name: i.name, qty: i.qty, rate: i.rate, amount: i.amount }))
          })));
          setBusinessInfo(business);
          setCurrentReceipt(prev => ({ ...prev, billNo }));
        } catch (err) {
          console.error('Error loading from database:', err);
          // Fall back to localStorage on error
          setIsTauri(false);
          const savedStockEntries = localStorage.getItem('receiptApp_stockEntries');
          const savedItemPrices = localStorage.getItem('receiptApp_itemPrices');
          const savedReceiptsData = localStorage.getItem('receiptApp_receipts');
          const savedBillNo = localStorage.getItem('receiptApp_billNo');
          const savedBusinessInfo = localStorage.getItem('receiptApp_business');
          if (savedStockEntries) {
            // Migrate existing entries to include new fields
            const entries = JSON.parse(savedStockEntries).map(e => ({
              ...e,
              productGroup: e.productGroup || '',
              provider: e.provider || ''
            }));
            setStockEntries(entries);
          }
          if (savedItemPrices) setItemPrices(JSON.parse(savedItemPrices));
          if (savedReceiptsData) setSavedReceipts(JSON.parse(savedReceiptsData));
          if (savedBillNo) setCurrentReceipt(prev => ({ ...prev, billNo: parseInt(savedBillNo) }));
          if (savedBusinessInfo) setBusinessInfo(JSON.parse(savedBusinessInfo));
        }
      } else {
        // Fallback to localStorage for browser development
        const savedStockEntries = localStorage.getItem('receiptApp_stockEntries');
        const savedItemPrices = localStorage.getItem('receiptApp_itemPrices');
        const savedReceiptsData = localStorage.getItem('receiptApp_receipts');
        const savedBillNo = localStorage.getItem('receiptApp_billNo');
        const savedBusinessInfo = localStorage.getItem('receiptApp_business');

        // Migration from old catalog format
        const oldCatalog = localStorage.getItem('receiptApp_catalog');
        if (oldCatalog && !savedStockEntries) {
          const items = JSON.parse(oldCatalog);
          const entries = items.filter(item => item.inventory > 0).map(item => ({
            id: item.id,
            name: item.name,
            purchasePrice: item.purchasePrice || 0,
            quantity: item.inventory,
            remaining: item.inventory,
            date: getLocalDateString()
          }));
          const prices = items.map(item => ({
            id: item.id + 1,
            name: item.name,
            sellingPrice: item.sellingPrice || 0
          }));
          setStockEntries(entries);
          setItemPrices(prices);
          localStorage.removeItem('receiptApp_catalog');
        } else {
          if (savedStockEntries) {
            // Migrate existing entries to include new fields
            const entries = JSON.parse(savedStockEntries).map(e => ({
              ...e,
              productGroup: e.productGroup || '',
              provider: e.provider || ''
            }));
            setStockEntries(entries);
          }
          if (savedItemPrices) setItemPrices(JSON.parse(savedItemPrices));
        }

        if (savedReceiptsData) setSavedReceipts(JSON.parse(savedReceiptsData));
        if (savedBillNo) setCurrentReceipt(prev => ({ ...prev, billNo: parseInt(savedBillNo) }));
        if (savedBusinessInfo) setBusinessInfo(JSON.parse(savedBusinessInfo));
      }
      setIsLoading(false);
    };

    loadData();
  }, []);

  // Persist data to localStorage (only in browser mode)
  useEffect(() => { if (!isTauri && !isLoading) localStorage.setItem('receiptApp_stockEntries', JSON.stringify(stockEntries)); }, [stockEntries, isTauri, isLoading]);
  useEffect(() => { if (!isTauri && !isLoading) localStorage.setItem('receiptApp_itemPrices', JSON.stringify(itemPrices)); }, [itemPrices, isTauri, isLoading]);
  useEffect(() => { if (!isTauri && !isLoading) localStorage.setItem('receiptApp_receipts', JSON.stringify(savedReceipts)); }, [savedReceipts, isTauri, isLoading]);
  useEffect(() => { if (!isTauri && !isLoading) localStorage.setItem('receiptApp_business', JSON.stringify(businessInfo)); }, [businessInfo, isTauri, isLoading]);

  const showSuccess = (msg) => { setSuccessMessage(msg); setTimeout(() => setSuccessMessage(''), 3000); };

  // Get average selling price from receipts for an item
  const getAvgSellingPriceFromReceipts = (itemName) => {
    let totalQty = 0;
    let totalAmount = 0;
    savedReceipts.forEach(receipt => {
      receipt.items.forEach(item => {
        if (item.name === itemName) {
          totalQty += item.qty;
          totalAmount += item.amount;
        }
      });
    });
    return totalQty > 0 ? totalAmount / totalQty : 0;
  };

  // Get unique items with aggregated data
  const getUniqueItems = () => {
    const names = [...new Set(stockEntries.map(e => e.name))];
    return names.map(name => {
      const entries = stockEntries.filter(e => e.name === name);
      const totalStock = entries.reduce((sum, e) => sum + e.remaining, 0);
      const totalCost = entries.reduce((sum, e) => sum + (e.purchasePrice * e.remaining), 0);
      const avgCost = totalStock > 0 ? totalCost / totalStock : 0;
      const priceEntry = itemPrices.find(p => p.name === name);
      const avgSellingPrice = getAvgSellingPriceFromReceipts(name);
      return {
        name,
        totalStock,
        avgCost,
        sellingPrice: priceEntry?.sellingPrice || 0,
        avgSellingPrice
      };
    });
  };

  // Get unique product groups from stock entries
  const getUniqueProductGroups = () => {
    return [...new Set(stockEntries.map(e => e.productGroup).filter(Boolean))].sort();
  };

  // Get unique providers from stock entries
  const getUniqueProviders = () => {
    return [...new Set(stockEntries.map(e => e.provider).filter(Boolean))].sort();
  };

  // Get filtered inventory items for search and filters
  const getFilteredInventoryItems = () => {
    const searchLower = inventorySearch.toLowerCase();

    // Filter by group and provider first
    const filteredEntries = stockEntries.filter(entry => {
      if (inventoryGroupFilter && entry.productGroup !== inventoryGroupFilter) return false;
      if (inventoryProviderFilter && entry.provider !== inventoryProviderFilter) return false;
      return true;
    });

    // Group filtered entries by item name
    const groups = {};
    filteredEntries.forEach(entry => {
      if (!groups[entry.name]) groups[entry.name] = [];
      groups[entry.name].push(entry);
    });

    // Apply name search and sort
    return Object.entries(groups)
      .filter(([itemName]) => itemName.toLowerCase().includes(searchLower))
      .sort(([a], [b]) => a.localeCompare(b));
  };

  // Helper to get date string in YYYY-MM-DD format (local timezone)
  const getDateString = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get date range based on filter (returns date strings for comparison)
  const getDateRange = () => {
    const today = new Date();
    const todayStr = getDateString(today);

    switch (historyDateFilter) {
      case 'today':
        return { from: todayStr, to: todayStr };
      case 'week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { from: getDateString(weekAgo), to: todayStr };
      }
      case 'month': {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return { from: getDateString(monthAgo), to: todayStr };
      }
      case 'custom':
        return {
          from: historyCustomRange.from,
          to: historyCustomRange.to
        };
      default:
        return { from: todayStr, to: todayStr };
    }
  };

  // Get filtered receipts for history search
  const getFilteredReceipts = () => {
    const searchLower = historySearch.toLowerCase();
    const dateRange = getDateRange();

    return savedReceipts
      .filter(receipt => {
        // Date filter - compare date strings directly to avoid timezone issues
        if (dateRange) {
          const receiptDateStr = receipt.date; // Already in YYYY-MM-DD format
          if (receiptDateStr < dateRange.from || receiptDateStr > dateRange.to) {
            return false;
          }
        }

        // Text search filter
        if (searchLower) {
          return (
            receipt.customerName?.toLowerCase().includes(searchLower) ||
            receipt.billNo.toString().includes(searchLower) ||
            receipt.items.some(item => item.name.toLowerCase().includes(searchLower))
          );
        }

        return true;
      })
      .slice()
      .reverse(); // Most recent first
  };

  // Add stock entry
  const addStockEntry = async () => {
    if (!newEntry.name || !newEntry.quantity || parseFloat(newEntry.quantity) <= 0) return;

    // If adding to an existing item, inherit its product group
    const existingItem = stockEntries.find(e => e.name === newEntry.name.trim());
    const productGroup = newEntry.productGroup?.trim() || existingItem?.productGroup || '';

    const entry = {
      id: Date.now(),
      name: newEntry.name.trim(),
      purchasePrice: parseFloat(newEntry.purchasePrice) || 0,
      quantity: parseFloat(newEntry.quantity),
      remaining: parseFloat(newEntry.quantity),
      date: newEntry.date || getLocalDateString(),
      productGroup: productGroup,
      provider: newEntry.provider?.trim() || ''
    };

    if (isTauri) {
      try {
        await db.addStockEntry(entry);
        // Auto-create price entry if new item
        if (!itemPrices.find(p => p.name === entry.name)) {
          const priceEntry = { id: Date.now() + 1, name: entry.name, sellingPrice: 0 };
          await db.upsertItemPrice(priceEntry.id, priceEntry.name, priceEntry.sellingPrice);
          setItemPrices(prev => [...prev, priceEntry]);
        }
      } catch (err) {
        console.error('Error adding stock entry:', err);
        return;
      }
    } else {
      // Auto-create price entry if new item
      if (!itemPrices.find(p => p.name === entry.name)) {
        setItemPrices(prev => [...prev, { id: Date.now() + 1, name: entry.name, sellingPrice: 0 }]);
      }
    }

    setStockEntries(prev => [...prev, entry]);
    setNewEntry({ name: '', purchasePrice: '', quantity: '', date: getLocalDateString(), productGroup: '', provider: '' });
    showSuccess('Stock entry added!');
  };

  // Delete stock entry
  const deleteStockEntry = async (entryId) => {
    if (isTauri) {
      try {
        await db.deleteStockEntry(entryId);
      } catch (err) {
        console.error('Error deleting stock entry:', err);
        return;
      }
    }
    setStockEntries(prev => prev.filter(e => e.id !== entryId));
    showSuccess('Entry deleted');
    setDeleteModal({ show: false, receiptId: null, entryId: null });
  };

  // Edit stock entry handlers
  const handleEditStock = (entry) => {
    setEditingStockId(entry.id);
    setEditingStockData({ ...entry });
  };

  const handleCancelEditStock = () => {
    setEditingStockId(null);
    setEditingStockData(null);
  };

  const handleSaveEditStock = async () => {
    if (!editingStockData) return;

    // Keep the original name - entry editing only changes qty, price, date, remaining
    const originalEntry = stockEntries.find(e => e.id === editingStockId);
    const updatedEntry = { ...editingStockData, name: originalEntry.name };

    if (isTauri) {
      try {
        await updateStockEntry(updatedEntry);
      } catch (err) {
        console.error('Error updating stock entry:', err);
        return;
      }
    }

    setStockEntries(prev => prev.map(e =>
      e.id === editingStockId ? updatedEntry : e
    ));
    setEditingStockId(null);
    setEditingStockData(null);
    showSuccess('Entry updated!');
  };

  // Rename item handler (at group header level) - also updates product group
  const handleSaveRenameItem = async () => {
    if (!renamingItem || !renamingItem.newName.trim()) return;
    const { oldName, newName, productGroup } = renamingItem;
    const newProductGroup = productGroup?.trim() || '';

    // Check if name changed
    const nameChanged = oldName !== newName.trim();

    // If nothing changed, just close
    if (!nameChanged && stockEntries.filter(e => e.name === oldName).every(e => e.productGroup === newProductGroup)) {
      setRenamingItem(null);
      return;
    }

    // Check if new name already exists - show merge modal instead of error
    if (nameChanged) {
      const existingEntries = stockEntries.filter(e => e.name === newName.trim());
      if (existingEntries.length > 0) {
        const oldEntries = stockEntries.filter(e => e.name === oldName);
        setMergeModal({
          show: true,
          oldName: oldName,
          targetName: newName.trim(),
          oldEntries: oldEntries,
          targetEntries: existingEntries
        });
        return;
      }
    }

    if (isTauri) {
      try {
        if (nameChanged) {
          await renameItem(oldName, newName.trim());
        }
        // Update product group for all entries with this name
        const entriesToUpdate = stockEntries.filter(e => e.name === oldName);
        for (const entry of entriesToUpdate) {
          await updateStockEntry({ ...entry, name: nameChanged ? newName.trim() : entry.name, productGroup: newProductGroup });
        }
      } catch (err) {
        console.error('Error updating item:', err);
        return;
      }
    }

    // Update local state
    setStockEntries(prev => prev.map(e => e.name === oldName ? { ...e, name: nameChanged ? newName.trim() : e.name, productGroup: newProductGroup } : e));
    if (nameChanged) {
      setItemPrices(prev => prev.map(p => p.name === oldName ? { ...p, name: newName.trim() } : p));
      // Also update historical receipts
      setSavedReceipts(prev => prev.map(receipt => ({
        ...receipt,
        items: receipt.items.map(item =>
          item.name === oldName ? { ...item, name: newName.trim() } : item
        )
      })));
    }
    setRenamingItem(null);
    showSuccess(nameChanged ? 'Item renamed!' : 'Product group updated!');
  };

  // Merge items handler (when renaming to an existing item name)
  const handleConfirmMerge = async () => {
    const { oldName, targetName } = mergeModal;

    if (isTauri) {
      try {
        // Rename all old entries to target name (merges into target)
        await renameItem(oldName, targetName);
        // Delete the old item's price entry (target's price is preserved)
        const oldPriceEntry = itemPrices.find(p => p.name === oldName);
        if (oldPriceEntry) {
          await db.deleteItemPrice(oldPriceEntry.id);
        }
      } catch (err) {
        console.error('Error merging items:', err);
        setMergeModal({ show: false, oldName: '', targetName: '', oldEntries: [], targetEntries: [] });
        return;
      }
    }

    // Update local state - all old entries get the target name
    setStockEntries(prev => prev.map(e =>
      e.name === oldName ? { ...e, name: targetName } : e
    ));

    // Remove old item's price entry (keep target's selling price)
    setItemPrices(prev => prev.filter(p => p.name !== oldName));

    // Update historical receipts
    setSavedReceipts(prev => prev.map(receipt => ({
      ...receipt,
      items: receipt.items.map(item =>
        item.name === oldName ? { ...item, name: targetName } : item
      )
    })));

    setMergeModal({ show: false, oldName: '', targetName: '', oldEntries: [], targetEntries: [] });
    setRenamingItem(null);
    showSuccess(`Merged "${oldName}" into "${targetName}"!`);
  };

  // Update selling price
  const updateSellingPrice = async (name, newPrice) => {
    const price = parseFloat(newPrice) || 0;
    if (isTauri) {
      try {
        const existing = itemPrices.find(p => p.name === name);
        await db.upsertItemPrice(existing?.id || Date.now(), name, price);
      } catch (err) {
        console.error('Error updating price:', err);
        return;
      }
    }
    setItemPrices(prev => prev.map(p =>
      p.name === name ? { ...p, sellingPrice: price } : p
    ));
  };

  const addItemToReceipt = () => {
    if (newItem.name && newItem.qty > 0 && newItem.rate > 0) {
      const item = { id: Date.now(), name: newItem.name, qty: parseFloat(newItem.qty), rate: parseFloat(newItem.rate), amount: parseFloat(newItem.qty) * parseFloat(newItem.rate) };
      setCurrentReceipt(prev => ({ ...prev, items: [...prev.items, item] }));
      setNewItem({ name: '', qty: 1, rate: 0 });
      setShowItemSuggestions(false);
    }
  };

  const removeItemFromReceipt = (id) => { setCurrentReceipt(prev => ({ ...prev, items: prev.items.filter(item => item.id !== id) })); };

  const handleItemSearch = (searchText) => {
    setNewItem(prev => ({ ...prev, name: searchText }));
    setShowItemSuggestions(searchText.length > 0);
  };

  const handleSelectSuggestion = (item) => {
    setNewItem({ name: item.name, qty: 1, rate: item.sellingPrice });
    setShowItemSuggestions(false);
  };

  const getFilteredItems = () => {
    const searchLower = (newItem.name || '').toLowerCase();
    return uniqueItems
      .filter(i => (i.totalStock > 0 || i.sellingPrice > 0) && i.name.toLowerCase().includes(searchLower))
      .slice(0, 8); // Limit to 8 suggestions
  };

  const calculateTotal = (receipt = currentReceipt) => {
    const itemsTotal = receipt.items.reduce((sum, item) => sum + item.amount, 0);
    return itemsTotal + parseFloat(receipt.others || 0) + parseFloat(receipt.roundOff || 0);
  };

  const saveReceipt = async () => {
    if (currentReceipt.items.length === 0) return;

    // Helper function for FIFO stock deduction on local state
    const deductStockLocal = (items) => {
      setStockEntries(prev => {
        const updated = [...prev];
        items.forEach(soldItem => {
          let qtyToDeduct = soldItem.qty;
          const sortedIndices = updated
            .map((e, i) => ({ entry: e, index: i }))
            .filter(({ entry }) => entry.name === soldItem.name && entry.remaining > 0)
            .sort((a, b) => new Date(a.entry.date) - new Date(b.entry.date));

          for (const { index } of sortedIndices) {
            if (qtyToDeduct <= 0) break;
            const deduct = Math.min(updated[index].remaining, qtyToDeduct);
            updated[index] = { ...updated[index], remaining: updated[index].remaining - deduct };
            qtyToDeduct -= deduct;
          }
        });
        return updated;
      });
    };

    // Helper function for restoring stock on local state (reverse FIFO)
    const restoreStockLocal = (items) => {
      setStockEntries(prev => {
        const updated = [...prev];
        items.forEach(item => {
          let qtyToRestore = item.qty;
          const sortedIndices = updated
            .map((e, i) => ({ entry: e, index: i }))
            .filter(({ entry }) => entry.name === item.name)
            .sort((a, b) => new Date(b.entry.date) - new Date(a.entry.date)); // Newest first

          for (const { index } of sortedIndices) {
            if (qtyToRestore <= 0) break;
            const maxRestore = updated[index].quantity - updated[index].remaining;
            const restore = Math.min(maxRestore, qtyToRestore);
            if (restore > 0) {
              updated[index] = { ...updated[index], remaining: updated[index].remaining + restore };
              qtyToRestore -= restore;
            }
          }
        });
        return updated;
      });
    };

    if (editingReceipt) {
      // EDITING EXISTING RECEIPT
      const updatedReceipt = {
        ...editingReceipt,
        date: currentReceipt.date,
        customerName: currentReceipt.customerName,
        items: currentReceipt.items,
        others: parseFloat(currentReceipt.others) || 0,
        roundOff: parseFloat(currentReceipt.roundOff) || 0,
        total: calculateTotal(),
        savedAt: new Date().toISOString()
      };

      if (isTauri) {
        try {
          // Restore old stock first
          for (const item of editingReceipt.items) {
            await restoreStockFIFO(item.name, item.qty);
          }
          // Deduct new stock
          for (const item of currentReceipt.items) {
            await db.deductStockFIFO(item.name, item.qty);
          }
          // Update receipt in database
          await updateReceipt(updatedReceipt);
        } catch (err) {
          console.error('Error updating receipt:', err);
          return;
        }
      }

      // Update local state - restore old, deduct new
      restoreStockLocal(editingReceipt.items);
      deductStockLocal(currentReceipt.items);

      // Update receipt in local state
      setSavedReceipts(prev => prev.map(r =>
        r.id === editingReceipt.id ? updatedReceipt : r
      ));

      // Get next bill number for new receipt
      const nextBillNo = isTauri ? await db.getNextBillNo() : parseInt(localStorage.getItem('receiptApp_billNo') || '1');

      setEditingReceipt(null);
      setCurrentReceipt({ billNo: nextBillNo, date: getLocalDateString(), customerName: '', items: [], others: 0, roundOff: 0 });
      showSuccess('Receipt updated!');
    } else {
      // CREATING NEW RECEIPT
      const receipt = { ...currentReceipt, id: Date.now(), total: calculateTotal(), savedAt: new Date().toISOString() };

      if (isTauri) {
        try {
          await db.addReceipt(receipt);
          for (const soldItem of currentReceipt.items) {
            await db.deductStockFIFO(soldItem.name, soldItem.qty);
          }
          await db.incrementBillNo();
        } catch (err) {
          console.error('Error saving receipt:', err);
          return;
        }
      }

      setSavedReceipts(prev => [...prev, receipt]);
      deductStockLocal(currentReceipt.items);

      const newBillNo = currentReceipt.billNo + 1;
      if (!isTauri) {
        localStorage.setItem('receiptApp_billNo', newBillNo.toString());
      }
      setCurrentReceipt({ billNo: newBillNo, date: getLocalDateString(), customerName: '', items: [], others: 0, roundOff: 0 });
      showSuccess('Receipt saved!');
    }
  };

  // Edit receipt handlers
  const handleEditReceipt = async (receipt) => {
    setEditingReceipt(receipt);
    setCurrentReceipt({
      billNo: receipt.billNo,
      date: receipt.date,
      customerName: receipt.customerName,
      items: receipt.items.map(item => ({ ...item, id: item.id || Date.now() + Math.random() })),
      others: receipt.others || 0,
      roundOff: receipt.roundOff || 0
    });
    setActiveTab('create');
  };

  const handleCancelEditReceipt = async () => {
    setEditingReceipt(null);
    // Reset to new receipt with next bill number
    const nextBillNo = isTauri ? await db.getNextBillNo() : parseInt(localStorage.getItem('receiptApp_billNo') || '1');
    setCurrentReceipt({ billNo: nextBillNo, date: getLocalDateString(), customerName: '', items: [], others: 0, roundOff: 0 });
  };

  const showPrintPreview = (receipt = currentReceipt) => {
    setPrintPreviewModal({ show: true, receipt: { ...receipt, total: receipt.total || calculateTotal(receipt) } });
  };

  const handlePrint = () => {
    const receipt = printPreviewModal.receipt;
    const itemsTotal = receipt.items.reduce((sum, item) => sum + item.amount, 0);
    const printContent = `<!DOCTYPE html><html><head><title>Receipt #${receipt.billNo}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:20px}.receipt{max-width:400px;margin:0 auto}.header{text-align:center;margin-bottom:20px;padding-bottom:15px;border-bottom:2px solid #333}.logo{font-size:32px;font-weight:700}.business-name{font-size:18px;font-weight:500;letter-spacing:2px}.document-type{font-size:14px;text-decoration:underline;margin-top:10px}.info-row{display:flex;justify-content:space-between;margin:8px 0;font-size:14px}.customer-info{margin:15px 0;padding:10px 0;border-bottom:1px dashed #ccc}table{width:100%;border-collapse:collapse;margin:15px 0;font-size:13px}th{background:#f8f8f8;padding:10px 5px;text-align:left;border-bottom:2px solid #333}th:nth-child(2),th:nth-child(3),th:nth-child(4){text-align:right}td{padding:8px 5px;border-bottom:1px solid #eee}td:nth-child(2),td:nth-child(3),td:nth-child(4){text-align:right}.totals{margin-top:20px;border-top:2px solid #333;padding-top:15px}.total-row{display:flex;justify-content:space-between;padding:5px 0;font-size:14px}.total-row.final{font-weight:700;font-size:16px;border-top:1px solid #333;margin-top:10px;padding-top:10px}.footer{margin-top:30px;text-align:center;font-size:12px;color:#666}@media print{body{padding:0}}</style></head><body><div class="receipt"><div class="header"><div class="logo">ba</div><div class="business-name">${businessInfo.name}</div>${businessInfo.address?`<div style="font-size:12px;color:#666">${businessInfo.address}</div>`:''}${businessInfo.phone?`<div style="font-size:12px;color:#666">Ph: ${businessInfo.phone}</div>`:''}${businessInfo.gstin?`<div style="font-size:12px;color:#666">GSTIN: ${businessInfo.gstin}</div>`:''}<div class="document-type">ESTIMATE</div></div><div class="customer-info"><div class="info-row"><span><strong>To:</strong> ${receipt.customerName||'Walk-in Customer'}</span></div><div class="info-row"><span><strong>Bill Date:</strong> ${formatDate(receipt.date)}</span><span><strong>Bill No:</strong> ${receipt.billNo}</span></div></div><table><thead><tr><th style="width:45%">Particulars</th><th style="width:15%">Qty</th><th style="width:20%">Rate</th><th style="width:20%">Amount</th></tr></thead><tbody>${receipt.items.map(item=>`<tr><td>${item.name}</td><td>${formatIndianCurrency(item.qty)}</td><td>${formatIndianCurrency(item.rate)}</td><td>${formatIndianCurrency(item.amount)}</td></tr>`).join('')}</tbody></table><div class="totals"><div class="total-row"><span>Bill Total</span><span>${formatIndianCurrency(itemsTotal)}</span></div><div class="total-row"><span>Others</span><span>${formatIndianCurrency(receipt.others||0)}</span></div><div class="total-row"><span>Round Off</span><span>${formatIndianCurrency(receipt.roundOff||0)}</span></div><div class="total-row final"><span>Net Amount</span><span>₹ ${formatIndianCurrency(receipt.total)}</span></div></div><div class="footer"><p>Thank you for your business!</p></div></div><script>window.onload=function(){window.print()}</script></body></html>`;
    const printFrame = document.createElement('iframe');
    printFrame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(printFrame);
    printFrame.contentWindow.document.open();
    printFrame.contentWindow.document.write(printContent);
    printFrame.contentWindow.document.close();
    setTimeout(() => { if(document.body.contains(printFrame)) document.body.removeChild(printFrame); }, 5000);
  };

  const confirmDelete = async () => {
    if (deleteModal.receiptId) {
      if (isTauri) {
        try {
          await db.deleteReceipt(deleteModal.receiptId);
        } catch (err) {
          console.error('Error deleting receipt:', err);
          return;
        }
      }
      setSavedReceipts(prev => prev.filter(r => r.id !== deleteModal.receiptId));
      showSuccess('Receipt deleted');
    }
    if (deleteModal.entryId) {
      await deleteStockEntry(deleteModal.entryId);
      return;
    }
    setDeleteModal({ show: false, receiptId: null, entryId: null });
  };

  const saveBusinessInfo = async () => {
    if (isTauri) {
      try {
        await db.updateBusinessInfo(businessInfo);
      } catch (err) {
        console.error('Error saving business info:', err);
      }
    }
    setEditingBusiness(false);
  };

  const uniqueItems = getUniqueItems();
  const totalUnits = stockEntries.reduce((sum, e) => sum + e.remaining, 0);
  const totalCostValue = stockEntries.reduce((sum, e) => sum + (e.purchasePrice * e.remaining), 0);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ textAlign: 'center', color: '#e8e8e8' }}>
          <div style={{ width: '60px', height: '60px', background: 'linear-gradient(135deg, #e94560, #ff6b6b)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '700', color: 'white', margin: '0 auto 20px' }}>ba</div>
          <p style={{ fontSize: '16px', opacity: 0.7 }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', fontFamily: "'Segoe UI', system-ui, sans-serif", color: '#e8e8e8' }}>
      {successMessage && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', background: 'linear-gradient(135deg, #4ade80, #22c55e)', color: 'white', padding: '15px 25px', borderRadius: '10px', zIndex: 2000, fontWeight: '600', boxShadow: '0 5px 20px rgba(0,0,0,0.3)' }}>✓ {successMessage}</div>
      )}

      <DeleteModal
        show={deleteModal.show}
        isEntry={!!deleteModal.entryId}
        onCancel={() => setDeleteModal({ show: false, receiptId: null, entryId: null })}
        onConfirm={confirmDelete}
      />

      <MergeModal
        show={mergeModal.show}
        mergeData={mergeModal}
        onCancel={() => {
          setMergeModal({ show: false, oldName: '', targetName: '', oldEntries: [], targetEntries: [] });
          setRenamingItem(null);
        }}
        onConfirm={handleConfirmMerge}
      />

      <PrintPreviewModal
        show={printPreviewModal.show}
        receipt={printPreviewModal.receipt}
        businessInfo={businessInfo}
        onClose={() => setPrintPreviewModal({ show: false, receipt: null })}
        onPrint={handlePrint}
      />

      <BusinessSettingsModal
        show={editingBusiness}
        businessInfo={businessInfo}
        onChange={setBusinessInfo}
        onSave={saveBusinessInfo}
      />

      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '50px', height: '50px', background: 'linear-gradient(135deg, #e94560, #ff6b6b)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700', color: 'white' }}>ba</div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>{businessInfo.name}</h1>
            <p style={{ fontSize: '13px', opacity: 0.7, margin: 0 }}>Receipt Generator</p>
          </div>
        </div>
        <button onClick={() => setEditingBusiness(true)} style={btnSecondary}>⚙️ Settings</button>
      </div>

      <div style={{ display: 'flex', gap: '10px', padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap' }}>
        {[
          { id: 'create', label: '📝 Create', count: null },
          { id: 'inventory', label: '📦 Inventory', count: totalUnits },
          { id: 'pricing', label: '💰 Pricing', count: uniqueItems.length },
          { id: 'history', label: '📋 History', count: savedReceipts.length }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            background: activeTab === tab.id ? 'linear-gradient(135deg, #e94560, #ff6b6b)' : 'rgba(255,255,255,0.05)',
            border: activeTab === tab.id ? 'none' : '1px solid rgba(255,255,255,0.1)',
            color: 'white', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px',
            fontWeight: activeTab === tab.id ? '600' : '400', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            {tab.label}
            {tab.count !== null && <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      <div style={{ padding: '30px 40px' }}>
        {activeTab === 'create' && (
          <div style={{ display: 'flex', gap: '30px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '25px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '500', margin: 0 }}>
                    {editingReceipt ? `✎ Editing Receipt #${editingReceipt.billNo}` : 'Receipt Details'}
                  </h2>
                  {editingReceipt && (
                    <button onClick={handleCancelEditReceipt} style={{ ...btnSecondary, padding: '8px 16px', fontSize: '12px' }}>
                      Cancel Edit
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Bill No</label>
                    <input type="text" value={currentReceipt.billNo} readOnly style={{ ...inputStyle, background: 'rgba(255,255,255,0.02)', color: '#888' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Date</label>
                    <input type="date" value={currentReceipt.date} onChange={(e) => setCurrentReceipt(prev => ({ ...prev, date: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Customer</label>
                    <input type="text" placeholder="Customer name" value={currentReceipt.customerName} onChange={(e) => setCurrentReceipt(prev => ({ ...prev, customerName: e.target.value }))} style={inputStyle} />
                  </div>
                </div>

                <div style={{ background: 'rgba(233, 69, 96, 0.1)', borderRadius: '12px', padding: '20px', marginBottom: '20px', border: '1px solid rgba(233, 69, 96, 0.2)' }}>
                  <h3 style={{ fontSize: '14px', marginBottom: '15px', fontWeight: '500' }}>Add Item</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                    <div style={{ position: 'relative' }}>
                      <label style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Item</label>
                      <input
                        type="text"
                        placeholder="Search or type item name..."
                        value={newItem.name}
                        onChange={(e) => handleItemSearch(e.target.value)}
                        onFocus={() => setShowItemSuggestions(newItem.name.length > 0 || uniqueItems.length > 0)}
                        onBlur={() => setTimeout(() => setShowItemSuggestions(false), 150)}
                        style={{ ...inputStyle, padding: '10px 12px' }}
                      />
                      {showItemSuggestions && getFilteredItems().length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: '#1a1a2e',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '8px',
                          marginTop: '4px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          zIndex: 100,
                          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                        }}>
                          {getFilteredItems().map(item => (
                            <div
                              key={item.name}
                              onMouseDown={() => handleSelectSuggestion(item)}
                              style={{
                                padding: '10px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(233, 69, 96, 0.2)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <span style={{ fontSize: '13px' }}>{item.name}</span>
                              <span style={{ fontSize: '11px', opacity: 0.7 }}>
                                ₹{formatIndianCurrency(item.sellingPrice)} · {item.totalStock} in stock
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Qty</label>
                      <input type="number" min="0.01" step="0.01" value={newItem.qty} onChange={(e) => setNewItem(prev => ({ ...prev, qty: e.target.value }))} style={{ ...inputStyle, padding: '10px 12px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Rate</label>
                      <input type="number" min="0" value={newItem.rate} onChange={(e) => setNewItem(prev => ({ ...prev, rate: e.target.value }))} style={{ ...inputStyle, padding: '10px 12px' }} />
                    </div>
                    <button onClick={addItemToReceipt} style={{ ...btnPrimary, padding: '10px 20px' }}>+ Add</button>
                  </div>
                </div>

                {currentReceipt.items.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px', opacity: 0.7 }}>#</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px', opacity: 0.7 }}>Item</th>
                          <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px', opacity: 0.7 }}>Qty</th>
                          <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px', opacity: 0.7 }}>Rate</th>
                          <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px', opacity: 0.7 }}>Amount</th>
                          <th style={{ padding: '10px', width: '40px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentReceipt.items.map((item, idx) => (
                          <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '10px', fontSize: '13px' }}>{idx + 1}</td>
                            <td style={{ padding: '10px', fontSize: '13px' }}>{item.name}</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontSize: '13px' }}>{formatIndianCurrency(item.qty)}</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontSize: '13px' }}>{formatIndianCurrency(item.rate)}</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontSize: '13px', fontWeight: '500' }}>{formatIndianCurrency(item.amount)}</td>
                            <td style={{ padding: '10px' }}>
                              <button onClick={() => removeItemFromReceipt(item.id)} style={{ background: 'rgba(255,0,0,0.2)', border: 'none', color: '#ff6b6b', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Others (₹)</label>
                    <input type="number" value={currentReceipt.others} onChange={(e) => setCurrentReceipt(prev => ({ ...prev, others: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Round Off</label>
                    <input type="number" step="0.01" value={currentReceipt.roundOff} onChange={(e) => setCurrentReceipt(prev => ({ ...prev, roundOff: e.target.value }))} style={inputStyle} />
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}><span style={{ opacity: 0.7 }}>Bill Total</span><span>₹ {formatIndianCurrency(currentReceipt.items.reduce((sum, item) => sum + item.amount, 0))}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}><span style={{ opacity: 0.7 }}>Others</span><span>₹ {formatIndianCurrency(currentReceipt.others)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}><span style={{ opacity: 0.7 }}>Round Off</span><span>₹ {formatIndianCurrency(currentReceipt.roundOff)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '18px', fontWeight: '600' }}><span>Net Amount</span><span style={{ color: '#4ade80' }}>₹ {formatIndianCurrency(calculateTotal())}</span></div>
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                  <button onClick={saveReceipt} disabled={currentReceipt.items.length === 0} style={{ ...btnPrimary, flex: 1, background: currentReceipt.items.length === 0 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #4ade80, #22c55e)', opacity: currentReceipt.items.length === 0 ? 0.5 : 1, cursor: currentReceipt.items.length === 0 ? 'not-allowed' : 'pointer', padding: '15px 25px' }}>{editingReceipt ? '💾 Update Receipt' : '💾 Save'}</button>
                  <button onClick={() => showPrintPreview()} disabled={currentReceipt.items.length === 0} style={{ ...btnPrimary, flex: 1, opacity: currentReceipt.items.length === 0 ? 0.5 : 1, cursor: currentReceipt.items.length === 0 ? 'not-allowed' : 'pointer', padding: '15px 25px' }}>🖨️ Print</button>
                </div>
              </div>
            </div>
            <div style={{ width: previewCollapsed ? 'auto' : '350px', transition: 'width 0.3s ease' }}>
              <div
                onClick={() => setPreviewCollapsed(!previewCollapsed)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 15px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: previewCollapsed ? '8px' : '8px 8px 0 0',
                  cursor: 'pointer',
                  marginBottom: previewCollapsed ? 0 : '-1px'
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: '500' }}>Live Preview</span>
                <span style={{ fontSize: '12px', opacity: 0.6 }}>{previewCollapsed ? '◀' : '▶'}</span>
              </div>
              {!previewCollapsed && (
                <div style={{ animation: 'fadeIn 0.2s ease' }}>
                  <ReceiptPreview receipt={currentReceipt} businessInfo={businessInfo} calculateTotal={calculateTotal} />
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '25px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '500' }}>📦 Inventory</h2>

            {/* Add Stock Entry Form */}
            <div style={{ background: 'rgba(233, 69, 96, 0.1)', borderRadius: '12px', padding: '20px', marginBottom: '25px', border: '1px solid rgba(233, 69, 96, 0.2)' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '15px', fontWeight: '500' }}>Add Stock Entry</h3>
              {/* Row 1: Core fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '15px', marginBottom: '15px', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Item Name</label>
                  <input
                    type="text"
                    placeholder="Item name"
                    value={newEntry.name}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, name: e.target.value }))}
                    list="item-names"
                    style={inputStyle}
                  />
                  <datalist id="item-names">
                    {uniqueItems.map(item => <option key={item.name} value={item.name} />)}
                  </datalist>
                </div>
                <div>
                  <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Purchase (₹)</label>
                  <input type="number" placeholder="100" value={newEntry.purchasePrice} onChange={(e) => setNewEntry(prev => ({ ...prev, purchasePrice: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Quantity</label>
                  <input type="number" placeholder="50" value={newEntry.quantity} onChange={(e) => setNewEntry(prev => ({ ...prev, quantity: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Date</label>
                  <input type="date" value={newEntry.date} onChange={(e) => setNewEntry(prev => ({ ...prev, date: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              {/* Row 2: Product Group, Provider, Add button */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '15px', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Product Group</label>
                  <input
                    type="text"
                    placeholder="e.g., Electronics, Groceries"
                    value={newEntry.productGroup}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, productGroup: e.target.value }))}
                    list="product-groups"
                    style={inputStyle}
                  />
                  <datalist id="product-groups">
                    {getUniqueProductGroups().map(g => <option key={g} value={g} />)}
                  </datalist>
                </div>
                <div>
                  <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Provider</label>
                  <input
                    type="text"
                    placeholder="Supplier name"
                    value={newEntry.provider}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, provider: e.target.value }))}
                    list="providers"
                    style={inputStyle}
                  />
                  <datalist id="providers">
                    {getUniqueProviders().map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>
                <button onClick={addStockEntry} style={btnPrimary}>+ Add</button>
              </div>
            </div>

            {/* Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '3px' }}>Items</p>
                <p style={{ fontSize: '20px', fontWeight: '600' }}>{uniqueItems.length}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '3px' }}>Units</p>
                <p style={{ fontSize: '20px', fontWeight: '600' }}>{totalUnits}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '3px' }}>Value</p>
                <p style={{ fontSize: '18px', fontWeight: '600', color: '#ff9f43' }}>₹{formatIndianCurrency(totalCostValue)}</p>
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap', alignItems: 'end' }}>
              <div style={{ minWidth: '160px' }}>
                <label style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Product Group</label>
                <select
                  value={inventoryGroupFilter}
                  onChange={(e) => setInventoryGroupFilter(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="">All Groups</option>
                  {getUniqueProductGroups().map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>
              <div style={{ minWidth: '160px' }}>
                <label style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Provider</label>
                <select
                  value={inventoryProviderFilter}
                  onChange={(e) => setInventoryProviderFilter(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="">All Providers</option>
                  {getUniqueProviders().map(provider => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </div>
              {(inventoryGroupFilter || inventoryProviderFilter) && (
                <button
                  onClick={() => {
                    setInventoryGroupFilter('');
                    setInventoryProviderFilter('');
                  }}
                  style={{ ...btnSecondary, padding: '10px 16px', fontSize: '12px' }}
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Search Box */}
            <div style={{ marginBottom: '15px' }}>
              <input
                type="text"
                placeholder="Search items..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                style={{ ...inputStyle, maxWidth: '300px' }}
              />
            </div>

            {/* Stock Entries List - Collapsed Table View */}
            {stockEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                <p style={{ fontSize: '48px', marginBottom: '15px' }}>📦</p>
                <p>No stock entries yet. Add your first entry above!</p>
              </div>
            ) : (
              <div>
                {/* Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 60px', gap: '15px', padding: '10px 15px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', opacity: 0.7 }}>Item Name</span>
                  <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'right' }}>Stock</span>
                  <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'right' }}>Avg Cost</span>
                  <span></span>
                </div>

                {/* Scrollable Items List */}
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {getFilteredInventoryItems().length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}>
                      <p>No items match "{inventorySearch}"</p>
                    </div>
                  ) : (
                    getFilteredInventoryItems().map(([itemName, entries]) => {
                      const isExpanded = expandedItems[itemName];
                      const totalRemaining = entries.reduce((sum, e) => sum + e.remaining, 0);
                      const totalQty = entries.reduce((sum, e) => sum + e.quantity, 0);
                      const totalCost = entries.reduce((sum, e) => sum + (e.purchasePrice * e.remaining), 0);
                      const avgCost = totalRemaining > 0 ? totalCost / totalRemaining : 0;

                      return (
                        <div key={itemName}>
                          {/* Collapsed Row */}
                          <div
                            onClick={() => setExpandedItems(prev => ({ ...prev, [itemName]: !prev[itemName] }))}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '2fr 1fr 1fr 60px',
                              gap: '15px',
                              padding: '12px 15px',
                              cursor: 'pointer',
                              background: isExpanded ? 'rgba(255,255,255,0.05)' : 'transparent',
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              alignItems: 'center',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                            onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                          >
                            {renamingItem?.oldName === itemName ? (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={renamingItem.newName}
                                  onChange={(e) => setRenamingItem(prev => ({ ...prev, newName: e.target.value }))}
                                  style={{ ...inputStyle, padding: '4px 8px', width: '120px', fontSize: '13px' }}
                                  autoFocus
                                  placeholder="Item name"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRenameItem();
                                    if (e.key === 'Escape') setRenamingItem(null);
                                  }}
                                />
                                <input
                                  type="text"
                                  value={renamingItem.productGroup || ''}
                                  onChange={(e) => setRenamingItem(prev => ({ ...prev, productGroup: e.target.value }))}
                                  style={{ ...inputStyle, padding: '4px 8px', width: '100px', fontSize: '12px' }}
                                  placeholder="Group"
                                  list="rename-groups"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRenameItem();
                                    if (e.key === 'Escape') setRenamingItem(null);
                                  }}
                                />
                                <datalist id="rename-groups">{getUniqueProductGroups().map(g => <option key={g} value={g} />)}</datalist>
                                <button onClick={handleSaveRenameItem} style={{ background: 'rgba(74,222,128,0.2)', border: 'none', color: '#4ade80', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✓</button>
                                <button onClick={() => setRenamingItem(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ opacity: 0.4, fontSize: '10px' }}>{isExpanded ? '▼' : '▶'}</span>
                                <span style={{ fontSize: '14px' }}>{itemName}</span>
                                {entries[0]?.productGroup && (
                                  <span style={{ padding: '2px 8px', background: 'rgba(233,69,96,0.2)', borderRadius: '10px', fontSize: '10px', color: '#e94560' }}>
                                    {entries[0].productGroup}
                                  </span>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); setRenamingItem({ oldName: itemName, newName: itemName, productGroup: entries[0]?.productGroup || '' }); }}
                                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', opacity: 0.7 }}
                                >
                                  ✎
                                </button>
                              </div>
                            )}
                            <span style={{ textAlign: 'right', fontSize: '13px', color: totalRemaining > 10 ? '#4ade80' : totalRemaining > 0 ? '#ff9f43' : '#ff6b6b' }}>
                              {totalRemaining} / {totalQty}
                            </span>
                            <span style={{ textAlign: 'right', fontSize: '13px', color: '#ff9f43' }}>₹{formatIndianCurrency(avgCost)}</span>
                            <span></span>
                          </div>

                          {/* Expanded Entries */}
                          {isExpanded && (
                            <div style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                              {entries.map(entry => (
                                <div key={entry.id} style={{ padding: '10px 15px 10px 35px', borderTop: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  {editingStockId === entry.id ? (
                                    <>
                                      <div style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <input type="date" value={editingStockData?.date || ''} onChange={(e) => setEditingStockData(prev => ({ ...prev, date: e.target.value }))} style={{ ...inputStyle, padding: '4px 8px', width: '120px', fontSize: '12px' }} />
                                        <input type="number" value={editingStockData?.quantity || ''} onChange={(e) => setEditingStockData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))} style={{ ...inputStyle, padding: '4px 8px', width: '60px', fontSize: '12px' }} placeholder="Qty" />
                                        <span style={{ fontSize: '11px', opacity: 0.5 }}>@</span>
                                        <input type="number" value={editingStockData?.purchasePrice || ''} onChange={(e) => setEditingStockData(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))} style={{ ...inputStyle, padding: '4px 8px', width: '70px', fontSize: '12px' }} placeholder="Price" />
                                        <input type="number" value={editingStockData?.remaining || ''} onChange={(e) => setEditingStockData(prev => ({ ...prev, remaining: parseFloat(e.target.value) || 0 }))} style={{ ...inputStyle, padding: '4px 8px', width: '60px', fontSize: '12px' }} placeholder="Left" />
                                        <input type="text" value={editingStockData?.provider || ''} onChange={(e) => setEditingStockData(prev => ({ ...prev, provider: e.target.value }))} style={{ ...inputStyle, padding: '4px 8px', width: '100px', fontSize: '12px' }} placeholder="Provider" list="edit-providers" />
                                        <datalist id="edit-providers">{getUniqueProviders().map(p => <option key={p} value={p} />)}</datalist>
                                      </div>
                                      <div style={{ display: 'flex', gap: '6px' }}>
                                        <button onClick={handleSaveEditStock} style={{ background: 'rgba(74,222,128,0.2)', border: 'none', color: '#4ade80', padding: '3px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}>Save</button>
                                        <button onClick={handleCancelEditStock} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '3px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}>Cancel</button>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ opacity: 0.6 }}>{formatDate(entry.date)}</span>
                                        <span>{entry.quantity} @ ₹{formatIndianCurrency(entry.purchasePrice)}</span>
                                        <span style={{ color: entry.remaining > 0 ? '#4ade80' : '#ff6b6b' }}>({entry.remaining} left)</span>
                                        {entry.provider && (
                                          <span style={{ padding: '2px 8px', background: 'rgba(96,165,250,0.2)', borderRadius: '10px', fontSize: '10px', color: '#60a5fa' }}>
                                            {entry.provider}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ display: 'flex', gap: '6px' }}>
                                        <button onClick={() => handleEditStock(entry)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '3px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}>✎</button>
                                        <button onClick={() => setDeleteModal({ show: true, receiptId: null, entryId: entry.id })} style={{ background: 'rgba(255,0,0,0.2)', border: 'none', color: '#ff6b6b', padding: '3px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}>✕</button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pricing' && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '25px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '500' }}>💰 Pricing</h2>

            {uniqueItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                <p style={{ fontSize: '48px', marginBottom: '15px' }}>💰</p>
                <p>No items yet. Add stock entries in the Inventory tab first!</p>
              </div>
            ) : (
              <div>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '15px', padding: '10px 15px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', opacity: 0.7 }}>Item Name</span>
                  <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'right' }}>Avg Cost</span>
                  <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'right' }}>Avg Sold</span>
                  <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'right' }}>Default Price</span>
                  <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'center' }}>Margin</span>
                  <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'right' }}>Stock</span>
                </div>

                {/* Items */}
                {uniqueItems.map(item => {
                  const margin = item.sellingPrice - item.avgCost;
                  const marginPercent = item.avgCost > 0 ? ((margin / item.avgCost) * 100).toFixed(0) : (item.sellingPrice > 0 ? '∞' : '--');
                  return (
                    <div key={item.name} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '15px', padding: '15px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px' }}>{item.name}</span>
                      <span style={{ fontSize: '13px', color: '#ff9f43', textAlign: 'right' }}>₹{formatIndianCurrency(item.avgCost)}</span>
                      <span style={{ fontSize: '13px', color: item.avgSellingPrice > 0 ? '#60a5fa' : 'rgba(255,255,255,0.3)', textAlign: 'right' }}>
                        {item.avgSellingPrice > 0 ? `₹${formatIndianCurrency(item.avgSellingPrice)}` : '--'}
                      </span>
                      <div>
                        <input
                          type="number"
                          value={item.sellingPrice || ''}
                          onChange={(e) => updateSellingPrice(item.name, e.target.value)}
                          placeholder="0"
                          style={{
                            ...inputStyle,
                            padding: '8px 12px',
                            textAlign: 'right',
                            color: '#4ade80',
                            fontWeight: '600'
                          }}
                        />
                      </div>
                      <span style={{
                        fontSize: '12px',
                        textAlign: 'center',
                        color: margin >= 0 ? '#4ade80' : '#ff6b6b'
                      }}>
                        {marginPercent !== '--' && marginPercent !== '∞' ? `+${marginPercent}%` : marginPercent}
                      </span>
                      <span style={{
                        fontSize: '13px',
                        textAlign: 'right',
                        padding: '4px 10px',
                        borderRadius: '15px',
                        background: item.totalStock > 10 ? 'rgba(74,222,128,0.2)' : item.totalStock > 0 ? 'rgba(255,159,67,0.2)' : 'rgba(255,107,107,0.2)',
                        color: item.totalStock > 10 ? '#4ade80' : item.totalStock > 0 ? '#ff9f43' : '#ff6b6b',
                        display: 'inline-block'
                      }}>
                        {item.totalStock}
                      </span>
                    </div>
                  );
                })}

                {/* Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '25px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '5px' }}>Total Items</p>
                    <p style={{ fontSize: '24px', fontWeight: '600' }}>{uniqueItems.length}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '5px' }}>Potential Selling Value</p>
                    <p style={{ fontSize: '20px', fontWeight: '600', color: '#4ade80' }}>
                      ₹{formatIndianCurrency(uniqueItems.reduce((sum, item) => sum + (item.sellingPrice * item.totalStock), 0))}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (() => {
          const filteredReceipts = getFilteredReceipts();
          const filteredTotal = filteredReceipts.reduce((sum, r) => sum + r.total, 0);
          const filteredItemsSold = filteredReceipts.reduce((sum, r) => sum + r.items.reduce((s, i) => s + i.qty, 0), 0);

          return (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '25px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '500' }}>📋 Saved Receipts</h2>

            {/* Date Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {[
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'custom', label: 'Custom' }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setHistoryDateFilter(filter.id)}
                  style={{
                    background: historyDateFilter === filter.id ? 'linear-gradient(135deg, #e94560, #ff6b6b)' : 'rgba(255,255,255,0.05)',
                    border: historyDateFilter === filter.id ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: historyDateFilter === filter.id ? '600' : '400'
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Custom Date Range Picker */}
            {historyDateFilter === 'custom' && (
              <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>From</label>
                  <input
                    type="date"
                    value={historyCustomRange.from}
                    onChange={(e) => setHistoryCustomRange(prev => ({ ...prev, from: e.target.value }))}
                    style={{ ...inputStyle, width: '150px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>To</label>
                  <input
                    type="date"
                    value={historyCustomRange.to}
                    onChange={(e) => setHistoryCustomRange(prev => ({ ...prev, to: e.target.value }))}
                    style={{ ...inputStyle, width: '150px' }}
                  />
                </div>
              </div>
            )}

            {/* Summary Stats - reflects filtered data */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '3px' }}>Receipts</p>
                <p style={{ fontSize: '20px', fontWeight: '600' }}>{filteredReceipts.length}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '3px' }}>Total Sales</p>
                <p style={{ fontSize: '18px', fontWeight: '600', color: '#4ade80' }}>₹{formatIndianCurrency(filteredTotal)}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '3px' }}>Items Sold</p>
                <p style={{ fontSize: '20px', fontWeight: '600' }}>{filteredItemsSold}</p>
              </div>
            </div>

            {/* Sales Trend Chart */}
            <SalesChart receipts={filteredReceipts} />

            {/* Search Box */}
            <div style={{ marginBottom: '15px' }}>
              <input
                type="text"
                placeholder="Search by bill #, customer, or item..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{ ...inputStyle, maxWidth: '350px' }}
              />
            </div>

            {savedReceipts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', opacity: 0.5 }}>
                <p style={{ fontSize: '64px', marginBottom: '20px' }}>📋</p>
                <p>No saved receipts yet.</p>
              </div>
            ) : (
              <div>
                {/* Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 100px 100px', gap: '15px', padding: '10px 15px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', opacity: 0.7 }}>Bill #</span>
                  <span style={{ fontSize: '12px', opacity: 0.7 }}>Customer</span>
                  <span style={{ fontSize: '12px', opacity: 0.7 }}>Date</span>
                  <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'right' }}>Amount</span>
                  <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'center' }}>Actions</span>
                </div>

                {/* Scrollable Receipts List */}
                <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
                  {filteredReceipts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}>
                      <p>No receipts found for this period{historySearch ? ` matching "${historySearch}"` : ''}</p>
                    </div>
                  ) : (
                    filteredReceipts.map(receipt => {
                      const isExpanded = expandedReceipts[receipt.id];

                      return (
                        <div key={receipt.id}>
                          {/* Collapsed Row */}
                          <div
                            onClick={() => setExpandedReceipts(prev => ({ ...prev, [receipt.id]: !prev[receipt.id] }))}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '80px 1fr 1fr 100px 100px',
                              gap: '15px',
                              padding: '12px 15px',
                              cursor: 'pointer',
                              background: isExpanded ? 'rgba(255,255,255,0.05)' : 'transparent',
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              alignItems: 'center',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                            onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ opacity: 0.4, fontSize: '10px' }}>{isExpanded ? '▼' : '▶'}</span>
                              <span style={{ fontSize: '14px', fontWeight: '600' }}>#{receipt.billNo}</span>
                            </div>
                            <span style={{ fontSize: '13px' }}>{receipt.customerName || 'Walk-in'}</span>
                            <span style={{ fontSize: '13px', opacity: 0.7 }}>{formatDate(receipt.date)}</span>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#4ade80', textAlign: 'right' }}>₹{formatIndianCurrency(receipt.total)}</span>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => handleEditReceipt(receipt)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✎</button>
                              <button onClick={() => showPrintPreview(receipt)} style={{ background: 'rgba(233,69,96,0.3)', border: 'none', color: '#ff6b6b', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>🖨️</button>
                              <button onClick={() => setDeleteModal({ show: true, receiptId: receipt.id, entryId: null })} style={{ background: 'rgba(255,0,0,0.2)', border: 'none', color: '#ff6b6b', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                            </div>
                          </div>

                          {/* Expanded Items */}
                          {isExpanded && (
                            <div style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '10px 15px 15px 40px' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                  <tr style={{ opacity: 0.6 }}>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '500' }}>Item</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '500' }}>Qty</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '500' }}>Rate</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '500' }}>Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {receipt.items.map((item, idx) => (
                                    <tr key={idx} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                      <td style={{ padding: '6px 8px' }}>{item.name}</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{item.qty}</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>₹{formatIndianCurrency(item.rate)}</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>₹{formatIndianCurrency(item.amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {(receipt.others > 0 || receipt.roundOff !== 0) && (
                                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(255,255,255,0.1)', fontSize: '12px' }}>
                                  {receipt.others > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.7 }}><span>Others:</span><span>₹{formatIndianCurrency(receipt.others)}</span></div>}
                                  {receipt.roundOff !== 0 && <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.7 }}><span>Round Off:</span><span>₹{formatIndianCurrency(receipt.roundOff)}</span></div>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          );
        })()}
      </div>
    </div>
  );
}
