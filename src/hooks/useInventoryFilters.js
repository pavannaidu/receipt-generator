import { useState, useMemo } from 'react';

/**
 * Custom hook for inventory filtering
 * Handles search, product group filter, provider filter, stock status filter, and sorting
 */
export function useInventoryFilters({ stockEntries }) {
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryGroupFilter, setInventoryGroupFilter] = useState('');
  const [inventoryProviderFilter, setInventoryProviderFilter] = useState('');
  const [inventoryStockFilter, setInventoryStockFilter] = useState('all');
  const [inventorySortBy, setInventorySortBy] = useState('date-recent');
  const [expandedItems, setExpandedItems] = useState({});

  // Get filtered inventory items (memoized)
  const filteredInventoryItems = useMemo(() => {
    const searchLower = inventorySearch.toLowerCase();

    // Filter by group, provider, and stock status
    const filteredEntries = stockEntries.filter(entry => {
      if (inventoryGroupFilter && entry.productGroup !== inventoryGroupFilter) return false;
      if (inventoryProviderFilter && entry.provider !== inventoryProviderFilter) return false;

      // By default, only show entries with stock remaining
      // "show-all" shows all entries including those with 0 remaining
      if (inventoryStockFilter !== 'show-all' && entry.remaining === 0) return false;

      return true;
    });

    // Group filtered entries by item name
    const groups = {};
    filteredEntries.forEach(entry => {
      if (!groups[entry.name]) groups[entry.name] = [];
      groups[entry.name].push(entry);
    });

    // Convert to array with computed metadata
    let items = Object.entries(groups).map(([name, entries]) => {
      const totalRemaining = entries.reduce((sum, e) => sum + e.remaining, 0);
      const totalQty = entries.reduce((sum, e) => sum + e.quantity, 0);
      const totalValue = entries.reduce((sum, e) => sum + (e.remaining * e.purchasePrice), 0);
      const lastEntry = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      return [name, entries, {
        totalRemaining,
        totalQty,
        totalValue,
        lastPurchaseDate: lastEntry.date,
        stockPercentage: totalQty > 0 ? (totalRemaining / totalQty) * 100 : 0
      }];
    });

    // Apply search filter
    items = items.filter(([itemName]) =>
      itemName.toLowerCase().includes(searchLower)
    );

    // Apply sorting
    items.sort(([nameA, , metaA], [nameB, , metaB]) => {
      switch (inventorySortBy) {
        case 'name-asc':
          return nameA.localeCompare(nameB);
        case 'name-desc':
          return nameB.localeCompare(nameA);
        case 'stock-low':
          return metaA.totalRemaining - metaB.totalRemaining;
        case 'stock-high':
          return metaB.totalRemaining - metaA.totalRemaining;
        case 'date-recent':
          return new Date(metaB.lastPurchaseDate) - new Date(metaA.lastPurchaseDate);
        case 'value-high':
          return metaB.totalValue - metaA.totalValue;
        default:
          return 0;
      }
    });

    return items;
  }, [stockEntries, inventorySearch, inventoryGroupFilter, inventoryProviderFilter,
      inventoryStockFilter, inventorySortBy]);

  // Toggle item expansion
  const toggleItemExpansion = (itemName) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setInventoryGroupFilter('');
    setInventoryProviderFilter('');
    setInventoryStockFilter('all');
    setInventorySortBy('date-recent');
  };

  // Check if any filters are active (show-all means user explicitly wants to see all items)
  const hasActiveFilters = inventoryGroupFilter || inventoryProviderFilter || inventoryStockFilter === 'show-all';

  return {
    // State
    inventorySearch,
    setInventorySearch,
    inventoryGroupFilter,
    setInventoryGroupFilter,
    inventoryProviderFilter,
    setInventoryProviderFilter,
    inventoryStockFilter,
    setInventoryStockFilter,
    inventorySortBy,
    setInventorySortBy,
    expandedItems,

    // Computed
    filteredInventoryItems,
    hasActiveFilters,

    // Actions
    toggleItemExpansion,
    clearFilters
  };
}
