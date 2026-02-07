import { useMemo, useCallback } from 'react';
import * as db from '../db';
import { updateStockEntry, renameItem } from '../db';
import { getLocalDateString } from '../utils/dateUtils';
import { generateId } from '../utils/formatters';

/**
 * Custom hook for stock/inventory management
 * Handles CRUD operations and FIFO stock deduction
 */
export function useStockManagement({
  stockEntries,
  setStockEntries,
  itemPrices,
  setItemPrices,
  savedReceipts,
  setSavedReceipts,
  isTauri,
  showSuccess,
  businessId
}) {
  // Get unique items with aggregated data (memoized)
  const uniqueItems = useMemo(() => {
    // Pre-index receipt sales data by item name (O(n) instead of O(n*m))
    const salesByName = {};
    for (const receipt of savedReceipts) {
      for (const item of (receipt.items || [])) {
        if (!salesByName[item.name]) {
          salesByName[item.name] = { totalQty: 0, totalAmount: 0 };
        }
        salesByName[item.name].totalQty += item.qty;
        salesByName[item.name].totalAmount += item.amount;
      }
    }

    // Pre-index item prices by name
    const pricesByName = {};
    for (const p of itemPrices) {
      pricesByName[p.name] = p.sellingPrice;
    }

    // Aggregate stock entries by name in a single pass
    const itemMap = {};
    for (const e of stockEntries) {
      if (!itemMap[e.name]) {
        itemMap[e.name] = { totalStock: 0, totalCost: 0 };
      }
      itemMap[e.name].totalStock += e.remaining;
      itemMap[e.name].totalCost += e.purchasePrice * e.remaining;
    }

    return Object.entries(itemMap).map(([name, { totalStock, totalCost }]) => {
      const avgCost = totalStock > 0 ? totalCost / totalStock : 0;
      const sales = salesByName[name];
      const avgSellingPrice = sales && sales.totalQty > 0 ? sales.totalAmount / sales.totalQty : 0;

      return {
        name,
        totalStock,
        avgCost,
        sellingPrice: pricesByName[name] || 0,
        avgSellingPrice
      };
    });
  }, [stockEntries, itemPrices, savedReceipts]);

  // Get unique product groups (memoized)
  const productGroups = useMemo(() => {
    return [...new Set(stockEntries.map(e => e.productGroup).filter(Boolean))].sort();
  }, [stockEntries]);

  // Get unique providers (memoized)
  const providers = useMemo(() => {
    return [...new Set(stockEntries.map(e => e.provider).filter(Boolean))].sort();
  }, [stockEntries]);

  // Summary stats (memoized)
  const totalUnits = useMemo(() => {
    return stockEntries.reduce((sum, e) => sum + e.remaining, 0);
  }, [stockEntries]);

  const totalCostValue = useMemo(() => {
    return stockEntries.reduce((sum, e) => sum + (e.purchasePrice * e.remaining), 0);
  }, [stockEntries]);

  // Add stock entry
  const addStockEntry = useCallback(async (newEntry) => {
    const qty = parseFloat(newEntry.quantity);
    const price = parseFloat(newEntry.purchasePrice);
    if (!newEntry.name?.trim() || !newEntry.quantity || isNaN(qty) || qty <= 0) return false;
    if (price < 0 || isNaN(price)) return false;

    // If adding to an existing item, inherit its product group
    const existingItem = stockEntries.find(e => e.name === newEntry.name.trim());
    const productGroup = newEntry.productGroup?.trim() || existingItem?.productGroup || '';

    const entry = {
      id: generateId(),
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
        await db.addStockEntry(entry, businessId);
        // Auto-create price entry if new item
        if (!itemPrices.find(p => p.name === entry.name)) {
          const priceEntry = { id: generateId(), name: entry.name, sellingPrice: 0 };
          await db.upsertItemPrice(priceEntry.id, priceEntry.name, priceEntry.sellingPrice, businessId);
          setItemPrices(prev => [...prev, priceEntry]);
        }
      } catch (err) {
        console.error('Error adding stock entry:', err);
        return false;
      }
    } else {
      // Auto-create price entry if new item
      if (!itemPrices.find(p => p.name === entry.name)) {
        setItemPrices(prev => [...prev, { id: generateId(), name: entry.name, sellingPrice: 0 }]);
      }
    }

    setStockEntries(prev => [...prev, entry]);
    showSuccess('Stock entry added!');
    return true;
  }, [stockEntries, itemPrices, isTauri, businessId, setStockEntries, setItemPrices, showSuccess]);

  // Delete stock entry
  const deleteStockEntry = useCallback(async (entryId) => {
    if (isTauri) {
      try {
        await db.deleteStockEntry(entryId);
      } catch (err) {
        console.error('Error deleting stock entry:', err);
        return false;
      }
    }
    setStockEntries(prev => prev.filter(e => e.id !== entryId));
    showSuccess('Entry deleted');
    return true;
  }, [isTauri, setStockEntries, showSuccess]);

  // Update stock entry
  const saveEditStock = useCallback(async (editingStockId, editingStockData) => {
    if (!editingStockData) return false;

    // Keep the original name - entry editing only changes qty, price, date, remaining
    const originalEntry = stockEntries.find(e => e.id === editingStockId);
    const updatedEntry = { ...editingStockData, name: originalEntry.name };

    if (isTauri) {
      try {
        await updateStockEntry(updatedEntry);
      } catch (err) {
        console.error('Error updating stock entry:', err);
        return false;
      }
    }

    setStockEntries(prev => prev.map(e =>
      e.id === editingStockId ? updatedEntry : e
    ));
    showSuccess('Entry updated!');
    return true;
  }, [stockEntries, isTauri, setStockEntries, showSuccess]);

  // Rename item (at group header level) - also updates product group
  const saveRenameItem = useCallback(async (renamingItem, setMergeModal) => {
    if (!renamingItem || !renamingItem.newName.trim()) return { success: false, showMerge: false };

    const { oldName, newName, productGroup } = renamingItem;
    const newProductGroup = productGroup?.trim() || '';
    const nameChanged = oldName !== newName.trim();

    // If nothing changed, just close
    if (!nameChanged && stockEntries.filter(e => e.name === oldName).every(e => e.productGroup === newProductGroup)) {
      return { success: true, showMerge: false };
    }

    // Check if new name already exists - show merge modal
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
        return { success: false, showMerge: true };
      }
    }

    if (isTauri) {
      try {
        if (nameChanged) {
          await renameItem(oldName, newName.trim(), businessId);
        }
        // Update product group for all entries with this name
        const entriesToUpdate = stockEntries.filter(e => e.name === oldName);
        for (const entry of entriesToUpdate) {
          await updateStockEntry({
            ...entry,
            name: nameChanged ? newName.trim() : entry.name,
            productGroup: newProductGroup
          });
        }
      } catch (err) {
        console.error('Error updating item:', err);
        return { success: false, showMerge: false };
      }
    }

    // Update local state
    setStockEntries(prev => prev.map(e =>
      e.name === oldName
        ? { ...e, name: nameChanged ? newName.trim() : e.name, productGroup: newProductGroup }
        : e
    ));

    if (nameChanged) {
      setItemPrices(prev => prev.map(p =>
        p.name === oldName ? { ...p, name: newName.trim() } : p
      ));
      // Also update historical receipts
      setSavedReceipts(prev => prev.map(receipt => ({
        ...receipt,
        items: receipt.items.map(item =>
          item.name === oldName ? { ...item, name: newName.trim() } : item
        )
      })));
    }

    showSuccess(nameChanged ? 'Item renamed!' : 'Product group updated!');
    return { success: true, showMerge: false };
  }, [stockEntries, isTauri, businessId, setStockEntries, setItemPrices, setSavedReceipts, showSuccess]);

  // Merge items handler (when renaming to an existing item name)
  const confirmMerge = useCallback(async (mergeModal) => {
    const { oldName, targetName } = mergeModal;

    if (isTauri) {
      try {
        // Rename all old entries to target name (merges into target)
        await renameItem(oldName, targetName, businessId);
        // Delete the old item's price entry (target's price is preserved)
        const oldPriceEntry = itemPrices.find(p => p.name === oldName);
        if (oldPriceEntry) {
          await db.deleteItemPrice(oldPriceEntry.id);
        }
      } catch (err) {
        console.error('Error merging items:', err);
        return false;
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

    showSuccess(`Merged "${oldName}" into "${targetName}"!`);
    return true;
  }, [itemPrices, isTauri, businessId, setStockEntries, setItemPrices, setSavedReceipts, showSuccess]);

  // Update selling price
  const updateSellingPrice = useCallback(async (name, newPrice) => {
    const price = parseFloat(newPrice) || 0;
    if (isTauri) {
      try {
        const existing = itemPrices.find(p => p.name === name);
        await db.upsertItemPrice(existing?.id || Date.now(), name, price, businessId);
      } catch (err) {
        console.error('Error updating price:', err);
        return false;
      }
    }
    setItemPrices(prev => prev.map(p =>
      p.name === name ? { ...p, sellingPrice: price } : p
    ));
    return true;
  }, [itemPrices, isTauri, businessId, setItemPrices]);

  // FIFO stock deduction (local state)
  const deductStockLocal = useCallback((items) => {
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
  }, [setStockEntries]);

  // Restore stock (reverse FIFO for edits/deletes)
  const restoreStockLocal = useCallback((items) => {
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
  }, [setStockEntries]);

  return {
    // Computed data
    uniqueItems,
    productGroups,
    providers,
    totalUnits,
    totalCostValue,

    // Actions
    addStockEntry,
    deleteStockEntry,
    saveEditStock,
    saveRenameItem,
    confirmMerge,
    updateSellingPrice,
    deductStockLocal,
    restoreStockLocal
  };
}
