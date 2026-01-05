import { useState, useEffect, useMemo } from 'react';
import * as db from './db';
import {
  useDataLoader,
  useStockManagement,
  useInventoryFilters,
  useHistoryFilters,
  useKeyboardShortcuts,
  usePagination,
  paginationStyles,
  useIsMobile,
  useCustomerManagement,
  useDrawer
} from './hooks';

// Utils
import { formatIndianCurrency } from './utils/formatters';
import { formatDate } from './utils/dateUtils';
import { exportReceiptToPDF } from './utils/pdfExport';

// Theme
import { useTheme, getThemedStyles } from './contexts/ThemeContext';

// Business Context
import { useBusiness } from './contexts/BusinessContext';

// Components
import {
  ReceiptPreview,
  DeleteModal,
  PrintPreviewModal,
  SalesChart,
  BusinessSettingsModal,
  MergeModal,
  SkeletonPage,
  MobileDrawer,
  BusinessSelector,
  BusinessManager,
  InventoryDashboard,
  StockProgressBar
} from './components';

// Constants
import {
  STORAGE_KEYS,
  DEFAULT_DELETE_MODAL,
  DEFAULT_PRINT_PREVIEW_MODAL,
  DEFAULT_MERGE_MODAL,
  getDefaultReceipt,
  getDefaultNewEntry,
  DEFAULT_NEW_ITEM
} from './constants';

// Helper to get business icon (custom or initials)
const getBusinessIcon = (business) => {
  if (business?.icon) return business.icon;
  const name = business?.name || '';
  if (!name) return '??';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export default function ReceiptGenerator() {
  // ==================== THEME ====================
  const { theme, toggleTheme, isDark } = useTheme();
  const { inputStyle, btnPrimary, btnSecondary } = getThemedStyles(theme);

  // ==================== RESPONSIVE ====================
  const isMobile = useIsMobile();
  const drawer = useDrawer();

  // ==================== BUSINESS CONTEXT ====================
  const { currentBusiness, isBusinessSelected, loading: businessLoading } = useBusiness();
  const businessId = currentBusiness?.id;

  // ==================== BUSINESS MANAGER STATE ====================
  const [showBusinessManager, setShowBusinessManager] = useState(false);

  // ==================== DATA LOADING ====================
  const {
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
  } = useDataLoader(businessId);

  // ==================== UI STATE ====================
  const [activeTab, setActiveTab] = useState('create');
  const [successMessage, setSuccessMessage] = useState('');
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [deleteModal, setDeleteModal] = useState(DEFAULT_DELETE_MODAL);
  const [printPreviewModal, setPrintPreviewModal] = useState(DEFAULT_PRINT_PREVIEW_MODAL);
  const [mergeModal, setMergeModal] = useState(DEFAULT_MERGE_MODAL);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);

  // Stock editing state
  const [editingStockId, setEditingStockId] = useState(null);
  const [editingStockData, setEditingStockData] = useState(null);
  const [renamingItem, setRenamingItem] = useState(null);

  // Receipt state
  const [currentReceipt, setCurrentReceipt] = useState(getDefaultReceipt(1));
  const [newItem, setNewItem] = useState(DEFAULT_NEW_ITEM);
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);

  // New entry form state
  const [newEntry, setNewEntry] = useState(getDefaultNewEntry());

  // Update bill number when data loads
  useEffect(() => {
    if (!isLoading && nextBillNo && !editingReceipt) {
      setCurrentReceipt(prev => ({ ...prev, billNo: nextBillNo }));
    }
  }, [isLoading, nextBillNo, editingReceipt]);

  // Success message helper
  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // ==================== STOCK MANAGEMENT ====================
  const {
    uniqueItems,
    productGroups,
    providers,
    totalUnits,
    totalCostValue,
    addStockEntry: addStockEntryHook,
    deleteStockEntry: deleteStockEntryHook,
    saveEditStock,
    saveRenameItem,
    confirmMerge,
    updateSellingPrice,
    deductStockLocal,
    restoreStockLocal
  } = useStockManagement({
    stockEntries,
    setStockEntries,
    itemPrices,
    setItemPrices,
    savedReceipts,
    setSavedReceipts,
    isTauri,
    showSuccess,
    businessId
  });

  // ==================== INVENTORY FILTERS ====================
  const {
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
    filteredInventoryItems,
    hasActiveFilters,
    toggleItemExpansion,
    clearFilters
  } = useInventoryFilters({ stockEntries });

  // ==================== HISTORY FILTERS ====================
  const {
    historySearch,
    setHistorySearch,
    historyDateFilter,
    setHistoryDateFilter,
    historyCustomRange,
    setHistoryCustomRange,
    expandedReceipts,
    filteredReceipts,
    toggleReceiptExpansion
  } = useHistoryFilters({ savedReceipts });

  // ==================== CUSTOMER MANAGEMENT ====================
  const {
    customers,
    filteredCustomers,
    showCustomerSuggestions,
    setShowCustomerSuggestions,
    handleCustomerSearch,
    selectCustomer,
    loadCustomers,
    addCustomer: addCustomerToDb
  } = useCustomerManagement({ isTauri, businessId });

  // Load customers on mount
  useEffect(() => {
    if (!isLoading) {
      loadCustomers();
    }
  }, [isLoading, loadCustomers]);

  // ==================== PAGINATION ====================
  const inventoryPagination = usePagination(filteredInventoryItems, 20);
  const historyPagination = usePagination(filteredReceipts, 20);

  // ==================== RECEIPT MANAGEMENT ====================
  const calculateTotal = (receipt = currentReceipt) => {
    const itemsTotal = receipt.items.reduce((sum, item) => sum + item.amount, 0);
    return itemsTotal + parseFloat(receipt.others || 0) + parseFloat(receipt.roundOff || 0);
  };

  const addItemToReceipt = () => {
    if (newItem.name && newItem.qty > 0 && newItem.rate > 0) {
      const item = {
        id: Date.now(),
        name: newItem.name,
        qty: parseFloat(newItem.qty),
        rate: parseFloat(newItem.rate),
        amount: parseFloat(newItem.qty) * parseFloat(newItem.rate)
      };
      setCurrentReceipt(prev => ({ ...prev, items: [...prev.items, item] }));
      setNewItem(DEFAULT_NEW_ITEM);
      setShowItemSuggestions(false);
    }
  };

  const removeItemFromReceipt = (id) => {
    setCurrentReceipt(prev => ({ ...prev, items: prev.items.filter(item => item.id !== id) }));
  };

  const handleItemSearch = (searchText) => {
    setNewItem(prev => ({ ...prev, name: searchText }));
    setShowItemSuggestions(searchText.length > 0);
  };

  const handleSelectSuggestion = (item) => {
    setNewItem({ name: item.name, qty: 1, rate: item.sellingPrice });
    setShowItemSuggestions(false);
  };

  // Filter items for suggestions (memoized)
  const filteredSuggestions = useMemo(() => {
    const searchLower = (newItem.name || '').toLowerCase();
    return uniqueItems
      .filter(i => (i.totalStock > 0 || i.sellingPrice > 0) && i.name.toLowerCase().includes(searchLower))
      .slice(0, 8);
  }, [uniqueItems, newItem.name]);

  // Save receipt (create or update)
  const saveReceipt = async () => {
    if (currentReceipt.items.length === 0) return;

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
          for (const item of editingReceipt.items) {
            await db.restoreStockFIFO(item.name, item.qty, businessId);
          }
          for (const item of currentReceipt.items) {
            await db.deductStockFIFO(item.name, item.qty, businessId);
          }
          await db.updateReceipt(updatedReceipt);
        } catch (err) {
          console.error('Error updating receipt:', err);
          return;
        }
      }

      restoreStockLocal(editingReceipt.items);
      deductStockLocal(currentReceipt.items);
      setSavedReceipts(prev => prev.map(r => r.id === editingReceipt.id ? updatedReceipt : r));

      const newBillNo = isTauri ? await db.getNextBillNoForBusiness(businessId) : parseInt(localStorage.getItem(STORAGE_KEYS.BILL_NO) || '1');
      setEditingReceipt(null);
      setCurrentReceipt(getDefaultReceipt(newBillNo));
      showSuccess('Receipt updated!');
    } else {
      // CREATING NEW RECEIPT
      const receipt = { ...currentReceipt, id: Date.now(), total: calculateTotal(), savedAt: new Date().toISOString() };

      if (isTauri) {
        try {
          await db.addReceipt(receipt, businessId);
          for (const soldItem of currentReceipt.items) {
            await db.deductStockFIFO(soldItem.name, soldItem.qty, businessId);
          }
          await db.incrementBillNoForBusiness(businessId);
        } catch (err) {
          console.error('Error saving receipt:', err);
          return;
        }
      }

      setSavedReceipts(prev => [...prev, receipt]);
      deductStockLocal(currentReceipt.items);

      const newBillNo = currentReceipt.billNo + 1;
      if (!isTauri) {
        localStorage.setItem(STORAGE_KEYS.BILL_NO, newBillNo.toString());
      }
      setNextBillNo(newBillNo);
      setCurrentReceipt(getDefaultReceipt(newBillNo));
      showSuccess('Receipt saved!');
    }
  };

  // Edit receipt handlers
  const handleEditReceipt = (receipt) => {
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
    const billNo = isTauri ? await db.getNextBillNoForBusiness(businessId) : parseInt(localStorage.getItem(STORAGE_KEYS.BILL_NO) || '1');
    setCurrentReceipt(getDefaultReceipt(billNo));
  };

  // Print handlers
  const showPrintPreview = (receipt = currentReceipt) => {
    setPrintPreviewModal({ show: true, receipt: { ...receipt, total: receipt.total || calculateTotal(receipt) } });
  };

  const handlePrint = () => {
    const receipt = printPreviewModal.receipt;
    const itemsTotal = receipt.items.reduce((sum, item) => sum + item.amount, 0);

    // Create print-only styles
    const printStyles = document.createElement('style');
    printStyles.id = 'print-only-styles';
    printStyles.textContent = `
      @media print {
        body > *:not(#print-container) { display: none !important; }
        #print-container { display: block !important; }
      }
      #print-container {
        display: none;
        font-family: Arial, sans-serif;
        padding: 20px;
        max-width: 400px;
        margin: 0 auto;
        color: #333;
      }
      #print-container .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #333; }
      #print-container .logo { font-size: 32px; font-weight: 700; }
      #print-container .business-name { font-size: 18px; font-weight: 500; letter-spacing: 2px; }
      #print-container .document-type { font-size: 14px; text-decoration: underline; margin-top: 10px; }
      #print-container .customer-info { margin: 15px 0; padding: 10px 0; border-bottom: 1px dashed #ccc; }
      #print-container .info-row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; }
      #print-container table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; }
      #print-container th { background: #f8f8f8; padding: 10px 5px; text-align: left; border-bottom: 2px solid #333; }
      #print-container th:nth-child(n+2) { text-align: right; }
      #print-container td { padding: 8px 5px; border-bottom: 1px solid #eee; }
      #print-container td:nth-child(n+2) { text-align: right; }
      #print-container .totals { margin-top: 20px; border-top: 2px solid #333; padding-top: 15px; }
      #print-container .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; }
      #print-container .total-row.final { font-weight: 700; font-size: 16px; border-top: 1px solid #333; margin-top: 10px; padding-top: 10px; }
      #print-container .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
    `;

    // Create print container
    const printContainer = document.createElement('div');
    printContainer.id = 'print-container';
    printContainer.innerHTML = `
      <div class="header">
        <div class="logo">ba</div>
        <div class="business-name">${businessInfo.name}</div>
        ${businessInfo.address ? `<div style="font-size:12px;color:#666">${businessInfo.address}</div>` : ''}
        ${businessInfo.phone ? `<div style="font-size:12px;color:#666">Ph: ${businessInfo.phone}</div>` : ''}
        ${businessInfo.gstin ? `<div style="font-size:12px;color:#666">GSTIN: ${businessInfo.gstin}</div>` : ''}
        <div class="document-type">ESTIMATE</div>
      </div>
      <div class="customer-info">
        <div class="info-row"><span><strong>To:</strong> ${receipt.customerName || 'Walk-in Customer'}</span></div>
        <div class="info-row"><span><strong>Bill Date:</strong> ${formatDate(receipt.date)}</span><span><strong>Bill No:</strong> ${receipt.billNo}</span></div>
      </div>
      <table>
        <thead><tr><th style="width:45%">Particulars</th><th style="width:15%">Qty</th><th style="width:20%">Rate</th><th style="width:20%">Amount</th></tr></thead>
        <tbody>${receipt.items.map(item => `<tr><td>${item.name}</td><td>${formatIndianCurrency(item.qty)}</td><td>${formatIndianCurrency(item.rate)}</td><td>${formatIndianCurrency(item.amount)}</td></tr>`).join('')}</tbody>
      </table>
      <div class="totals">
        <div class="total-row"><span>Bill Total</span><span>${formatIndianCurrency(itemsTotal)}</span></div>
        <div class="total-row"><span>Others</span><span>${formatIndianCurrency(receipt.others || 0)}</span></div>
        <div class="total-row"><span>Round Off</span><span>${formatIndianCurrency(receipt.roundOff || 0)}</span></div>
        <div class="total-row final"><span>Net Amount</span><span>₹ ${formatIndianCurrency(receipt.total)}</span></div>
      </div>
      <div class="footer"><p>Thank you for your business!</p></div>
    `;

    // Remove any existing print elements
    document.getElementById('print-only-styles')?.remove();
    document.getElementById('print-container')?.remove();

    // Add to document
    document.head.appendChild(printStyles);
    document.body.appendChild(printContainer);

    // Trigger print
    window.print();

    // Cleanup after print dialog closes
    setTimeout(() => {
      document.getElementById('print-only-styles')?.remove();
      document.getElementById('print-container')?.remove();
    }, 500);
  };

  // PDF download handler
  const handleDownloadPDF = async (receipt = printPreviewModal.receipt || currentReceipt) => {
    const receiptToExport = { ...receipt, total: receipt.total || calculateTotal(receipt) };
    const success = await exportReceiptToPDF(receiptToExport, businessInfo, formatIndianCurrency, formatDate, false);
    if (success) {
      showSuccess('PDF downloaded!');
    }
  };

  // Delete handlers
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
      await deleteStockEntryHook(deleteModal.entryId);
    }
    setDeleteModal(DEFAULT_DELETE_MODAL);
  };

  // Stock entry handlers
  const addStockEntry = async () => {
    const success = await addStockEntryHook(newEntry);
    if (success) {
      setNewEntry(getDefaultNewEntry());
    }
  };

  const handleEditStock = (entry) => {
    setEditingStockId(entry.id);
    setEditingStockData({ ...entry });
  };

  const handleCancelEditStock = () => {
    setEditingStockId(null);
    setEditingStockData(null);
  };

  const handleSaveEditStock = async () => {
    const success = await saveEditStock(editingStockId, editingStockData);
    if (success) {
      setEditingStockId(null);
      setEditingStockData(null);
    }
  };

  const handleSaveRenameItem = async () => {
    const result = await saveRenameItem(renamingItem, setMergeModal);
    if (result.success || result.showMerge) {
      if (!result.showMerge) {
        setRenamingItem(null);
      }
    }
  };

  const handleConfirmMerge = async () => {
    const success = await confirmMerge(mergeModal);
    if (success) {
      setMergeModal(DEFAULT_MERGE_MODAL);
      setRenamingItem(null);
    }
  };

  // Business info handlers
  const saveBusinessInfo = async () => {
    if (isTauri) {
      try {
        // Update the current business in the businesses table
        if (currentBusiness?.id) {
          await db.updateBusiness({
            id: currentBusiness.id,
            name: businessInfo.name,
            address: businessInfo.address,
            phone: businessInfo.phone,
            gstin: businessInfo.gstin,
            icon: businessInfo.icon || ''
          });
        }
        // Also update legacy business_info table for backwards compatibility
        await db.updateBusinessInfo(businessInfo);
      } catch (err) {
        console.error('Error saving business info:', err);
      }
    }
    setEditingBusiness(false);
  };

  // ==================== KEYBOARD SHORTCUTS ====================
  useKeyboardShortcuts({
    onSave: () => {
      if (activeTab === 'create' && currentReceipt.items.length > 0) {
        saveReceipt();
      }
    },
    onPrint: () => {
      if (activeTab === 'create' && currentReceipt.items.length > 0) {
        showPrintPreview();
      }
    },
    onNew: () => {
      if (activeTab === 'create') {
        handleCancelEditReceipt();
      }
    },
    onDownloadPDF: () => {
      if (activeTab === 'create' && currentReceipt.items.length > 0) {
        handleDownloadPDF(currentReceipt);
      }
    },
    onEscape: () => {
      setDeleteModal(DEFAULT_DELETE_MODAL);
      setPrintPreviewModal(DEFAULT_PRINT_PREVIEW_MODAL);
      setMergeModal(DEFAULT_MERGE_MODAL);
      setEditingBusiness(false);
    }
  }, !isLoading);

  // ==================== COMPUTED VALUES ====================
  const filteredTotal = filteredReceipts.reduce((sum, r) => sum + r.total, 0);
  const filteredItemsSold = filteredReceipts.reduce((sum, r) => sum + r.items.reduce((s, i) => s + i.qty, 0), 0);

  // ==================== RENDER ====================
  // Show business selector if no business is selected
  if (businessLoading) {
    return <SkeletonPage />;
  }

  if (!isBusinessSelected) {
    return <BusinessSelector />;
  }

  if (isLoading) {
    return <SkeletonPage />;
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.background, fontFamily: "'Segoe UI', system-ui, sans-serif", color: theme.text }}>
      {successMessage && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', background: 'linear-gradient(135deg, #4ade80, #22c55e)', color: 'white', padding: '15px 25px', borderRadius: '10px', zIndex: 2000, fontWeight: '600', boxShadow: '0 5px 20px rgba(0,0,0,0.3)' }}>✓ {successMessage}</div>
      )}

      <DeleteModal
        show={deleteModal.show}
        isEntry={!!deleteModal.entryId}
        onCancel={() => setDeleteModal(DEFAULT_DELETE_MODAL)}
        onConfirm={confirmDelete}
      />

      <MergeModal
        show={mergeModal.show}
        mergeData={mergeModal}
        onCancel={() => {
          setMergeModal(DEFAULT_MERGE_MODAL);
          setRenamingItem(null);
        }}
        onConfirm={handleConfirmMerge}
      />

      <PrintPreviewModal
        show={printPreviewModal.show}
        receipt={printPreviewModal.receipt}
        businessInfo={businessInfo}
        onClose={() => setPrintPreviewModal(DEFAULT_PRINT_PREVIEW_MODAL)}
        onPrint={handlePrint}
        onDownloadPDF={() => handleDownloadPDF(printPreviewModal.receipt)}
      />

      <BusinessSettingsModal
        show={editingBusiness}
        businessInfo={businessInfo}
        onChange={setBusinessInfo}
        onSave={saveBusinessInfo}
      />

      {/* Business Manager Modal */}
      {showBusinessManager && (
        <BusinessManager
          onClose={() => setShowBusinessManager(false)}
        />
      )}

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={drawer.isOpen}
        onClose={drawer.close}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setEditingBusiness(true)}
        onManageBusinesses={() => setShowBusinessManager(true)}
        businessInfo={businessInfo}
      />

      {/* Header */}
      <div style={{ background: theme.headerBg, borderBottom: `1px solid ${theme.border}`, padding: isMobile ? '15px 20px' : '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '15px' }}>
          <div style={{ width: isMobile ? '40px' : '50px', height: isMobile ? '40px' : '50px', background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover})`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '16px' : '20px', fontWeight: '700', color: 'white' }}>{getBusinessIcon(currentBusiness)}</div>
          <div>
            <h1 style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: '600', margin: 0 }}>{businessInfo.name}</h1>
            {!isMobile && <p style={{ fontSize: '13px', opacity: 0.7, margin: 0 }}>Receipt Generator</p>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isMobile ? (
            /* Mobile: Show hamburger menu */
            <button onClick={drawer.open} style={{ ...btnSecondary, padding: '8px 12px', fontSize: '20px' }} title="Open Menu">☰</button>
          ) : (
            /* Desktop: Show theme toggle, switch business, and settings */
            <>
              <button onClick={toggleTheme} style={{ ...btnSecondary, padding: '10px 15px', fontSize: '18px' }} title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>{isDark ? '☀️' : '🌙'}</button>
              <button onClick={() => setShowBusinessManager(true)} style={btnSecondary}>🔄 Switch</button>
              <button onClick={() => setEditingBusiness(true)} style={btnSecondary}>⚙️ Settings</button>
            </>
          )}
        </div>
      </div>

      {/* Tabs - Hidden on mobile (shown in drawer) */}
      {!isMobile && (
        <div style={{ display: 'flex', gap: '10px', padding: '20px 40px', borderBottom: `1px solid ${theme.border}`, flexWrap: 'wrap', overflowX: 'auto' }}>
          {[
            { id: 'create', label: '📝 Create', count: null },
            { id: 'inventory', label: '📦 Inventory', count: totalUnits },
            { id: 'pricing', label: '💰 Pricing', count: uniqueItems.length },
            { id: 'history', label: '📋 History', count: savedReceipts.length }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: activeTab === tab.id ? `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover})` : theme.surface,
              border: activeTab === tab.id ? 'none' : `1px solid ${theme.border}`,
              color: activeTab === tab.id ? 'white' : theme.text, padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px',
              fontWeight: activeTab === tab.id ? '600' : '400', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              {tab.label}
              {tab.count !== null && <span style={{ background: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : theme.surfaceActive, padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>{tab.count}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Mobile Tab Indicator */}
      {isMobile && (
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${theme.border}`, background: theme.surface }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: theme.accent }}>
            {activeTab === 'create' && '📝 Create Receipt'}
            {activeTab === 'inventory' && '📦 Inventory'}
            {activeTab === 'pricing' && '💰 Pricing'}
            {activeTab === 'history' && '📋 History'}
          </span>
        </div>
      )}

      {/* Main Content */}
      <div style={{ padding: isMobile ? '20px' : '30px 40px' }}>
        {/* CREATE TAB */}
        {activeTab === 'create' && (
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '20px' : '30px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ background: theme.surface, borderRadius: '16px', padding: isMobile ? '15px' : '25px', border: `1px solid ${theme.border}`, boxShadow: theme.shadow || 'none' }}>
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

                {/* Receipt Info */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Bill No</label>
                    <input type="text" value={currentReceipt.billNo} readOnly style={{ ...inputStyle, background: 'rgba(255,255,255,0.02)', color: '#888' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Date</label>
                    <input type="date" value={currentReceipt.date} onChange={(e) => setCurrentReceipt(prev => ({ ...prev, date: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Customer</label>
                    <input
                      type="text"
                      placeholder="Search or add customer..."
                      value={currentReceipt.customerName}
                      onChange={(e) => {
                        setCurrentReceipt(prev => ({ ...prev, customerName: e.target.value }));
                        handleCustomerSearch(e.target.value);
                      }}
                      onFocus={() => setShowCustomerSuggestions(customers.length > 0 || currentReceipt.customerName.length > 0)}
                      onBlur={() => setTimeout(() => {
                        setShowCustomerSuggestions(false);
                        // Auto-save new customer when leaving field
                        if (currentReceipt.customerName.trim() && !customers.some(c => c.name.toLowerCase() === currentReceipt.customerName.trim().toLowerCase())) {
                          addCustomerToDb({ name: currentReceipt.customerName.trim() });
                        }
                      }, 200)}
                      style={inputStyle}
                    />
                    {showCustomerSuggestions && filteredCustomers.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: isDark ? '#1a1a2e' : '#fff', border: `1px solid ${theme.border}`, borderRadius: '8px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto', zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                        {filteredCustomers.map(customer => (
                          <div
                            key={customer.id}
                            onMouseDown={() => {
                              setCurrentReceipt(prev => ({ ...prev, customerName: customer.name }));
                              selectCustomer(customer);
                            }}
                            style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: `1px solid ${theme.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = theme.surfaceHover}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ fontSize: '13px' }}>{customer.name}</span>
                            {customer.phone && <span style={{ fontSize: '11px', opacity: 0.6 }}>{customer.phone}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Add Item */}
                <div style={{ background: 'rgba(233, 69, 96, 0.1)', borderRadius: '12px', padding: isMobile ? '15px' : '20px', marginBottom: '20px', border: '1px solid rgba(233, 69, 96, 0.2)' }}>
                  <h3 style={{ fontSize: '14px', marginBottom: '15px', fontWeight: '500' }}>Add Item</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
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
                      {showItemSuggestions && filteredSuggestions.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto', zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                          {filteredSuggestions.map(item => (
                            <div
                              key={item.name}
                              onMouseDown={() => handleSelectSuggestion(item)}
                              style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(233, 69, 96, 0.2)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <span style={{ fontSize: '13px' }}>{item.name}</span>
                              <span style={{ fontSize: '11px', opacity: 0.7 }}>₹{formatIndianCurrency(item.sellingPrice)} · {item.totalStock} in stock</span>
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

                {/* Receipt Items Table */}
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

                {/* Others & Round Off */}
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

                {/* Totals */}
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}><span style={{ opacity: 0.7 }}>Bill Total</span><span>₹ {formatIndianCurrency(currentReceipt.items.reduce((sum, item) => sum + item.amount, 0))}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}><span style={{ opacity: 0.7 }}>Others</span><span>₹ {formatIndianCurrency(currentReceipt.others)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}><span style={{ opacity: 0.7 }}>Round Off</span><span>₹ {formatIndianCurrency(currentReceipt.roundOff)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '18px', fontWeight: '600' }}><span>Net Amount</span><span style={{ color: '#4ade80' }}>₹ {formatIndianCurrency(calculateTotal())}</span></div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '15px' }}>
                  <button onClick={saveReceipt} disabled={currentReceipt.items.length === 0} style={{ ...btnPrimary, flex: 1, background: currentReceipt.items.length === 0 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #4ade80, #22c55e)', opacity: currentReceipt.items.length === 0 ? 0.5 : 1, cursor: currentReceipt.items.length === 0 ? 'not-allowed' : 'pointer', padding: '15px 25px' }}>{editingReceipt ? '💾 Update Receipt' : '💾 Save'}</button>
                  <button onClick={() => showPrintPreview()} disabled={currentReceipt.items.length === 0} style={{ ...btnPrimary, flex: 1, opacity: currentReceipt.items.length === 0 ? 0.5 : 1, cursor: currentReceipt.items.length === 0 ? 'not-allowed' : 'pointer', padding: '15px 25px' }}>🖨️ Print</button>
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div style={{ width: previewCollapsed ? 'auto' : '350px', transition: 'width 0.3s ease' }}>
              <div onClick={() => setPreviewCollapsed(!previewCollapsed)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 15px', background: 'rgba(255,255,255,0.05)', borderRadius: previewCollapsed ? '8px' : '8px 8px 0 0', cursor: 'pointer', marginBottom: previewCollapsed ? 0 : '-1px' }}>
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

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div style={{ background: theme.surface, borderRadius: '16px', padding: isMobile ? '15px' : '25px', border: `1px solid ${theme.border}`, boxShadow: theme.shadow || 'none' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '500' }}>📦 Inventory</h2>

            {/* Analytics Dashboard */}
            <InventoryDashboard stockEntries={stockEntries} savedReceipts={savedReceipts} />

            {/* Add Stock Entry Form */}
            <div style={{ background: `${theme.accent}15`, borderRadius: '12px', padding: isMobile ? '15px' : '20px', marginBottom: '25px', border: `1px solid ${theme.accent}30` }}>
              <h3 style={{ fontSize: '14px', marginBottom: '15px', fontWeight: '500' }}>Add Stock Entry</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '2fr 1fr 1fr 1fr', gap: isMobile ? '10px' : '15px', marginBottom: '15px', alignItems: 'end' }}>
                <div style={isMobile ? { gridColumn: '1 / -1' } : {}}>
                  <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Item Name</label>
                  <input type="text" placeholder="Item name" value={newEntry.name} onChange={(e) => setNewEntry(prev => ({ ...prev, name: e.target.value }))} list="item-names" style={inputStyle} />
                  <datalist id="item-names">{uniqueItems.map(item => <option key={item.name} value={item.name} />)}</datalist>
                </div>
                <div>
                  <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Purchase (₹)</label>
                  <input type="number" placeholder="100" value={newEntry.purchasePrice} onChange={(e) => setNewEntry(prev => ({ ...prev, purchasePrice: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Quantity</label>
                  <input type="number" placeholder="50" value={newEntry.quantity} onChange={(e) => setNewEntry(prev => ({ ...prev, quantity: e.target.value }))} style={inputStyle} />
                </div>
                <div style={isMobile ? { gridColumn: '1 / -1' } : {}}>
                  <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Date</label>
                  <input type="date" value={newEntry.date} onChange={(e) => setNewEntry(prev => ({ ...prev, date: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr auto', gap: isMobile ? '10px' : '15px', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Product Group</label>
                  <input type="text" placeholder="e.g., Electronics, Groceries" value={newEntry.productGroup} onChange={(e) => setNewEntry(prev => ({ ...prev, productGroup: e.target.value }))} list="product-groups" style={inputStyle} />
                  <datalist id="product-groups">{productGroups.map(g => <option key={g} value={g} />)}</datalist>
                </div>
                <div>
                  <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Provider</label>
                  <input type="text" placeholder="Supplier name" value={newEntry.provider} onChange={(e) => setNewEntry(prev => ({ ...prev, provider: e.target.value }))} list="providers" style={inputStyle} />
                  <datalist id="providers">{providers.map(p => <option key={p} value={p} />)}</datalist>
                </div>
                <button onClick={addStockEntry} style={{ ...btnPrimary, width: isMobile ? '100%' : 'auto' }}>+ Add</button>
              </div>
            </div>

            {/* Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: isMobile ? '10px' : '20px', marginBottom: '20px', padding: isMobile ? '10px' : '15px', background: theme.surfaceHover, borderRadius: '12px' }}>
              <div style={{ textAlign: 'center' }}><p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '3px' }}>Items</p><p style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '600' }}>{uniqueItems.length}</p></div>
              <div style={{ textAlign: 'center' }}><p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '3px' }}>Units</p><p style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '600' }}>{totalUnits}</p></div>
              <div style={{ textAlign: 'center' }}><p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '3px' }}>Value</p><p style={{ fontSize: isMobile ? '14px' : '18px', fontWeight: '600', color: theme.warning }}>₹{formatIndianCurrency(totalCostValue)}</p></div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap', alignItems: 'end' }}>
              <div style={{ minWidth: '160px' }}>
                <label style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Product Group</label>
                <select value={inventoryGroupFilter} onChange={(e) => setInventoryGroupFilter(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">All Groups</option>
                  {productGroups.map(group => <option key={group} value={group}>{group}</option>)}
                </select>
              </div>
              <div style={{ minWidth: '160px' }}>
                <label style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Provider</label>
                <select value={inventoryProviderFilter} onChange={(e) => setInventoryProviderFilter(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">All Providers</option>
                  {providers.map(provider => <option key={provider} value={provider}>{provider}</option>)}
                </select>
              </div>
              <div style={{ minWidth: '140px' }}>
                <label style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Show</label>
                <select value={inventoryStockFilter} onChange={(e) => setInventoryStockFilter(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="all">Active Inventory</option>
                  <option value="show-all">All</option>
                </select>
              </div>
              <div style={{ minWidth: '180px' }}>
                <label style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>Sort By</label>
                <select value={inventorySortBy} onChange={(e) => setInventorySortBy(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="stock-low">Stock Level (Low to High)</option>
                  <option value="stock-high">Stock Level (High to Low)</option>
                  <option value="date-recent">Last Purchase (Recent First)</option>
                  <option value="value-high">Total Value (High to Low)</option>
                </select>
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} style={{ ...btnSecondary, padding: '10px 16px', fontSize: '12px' }}>Clear Filters</button>
              )}
            </div>

            {/* Search */}
            <div style={{ marginBottom: '15px' }}>
              <input type="text" placeholder="Search items..." value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} style={{ ...inputStyle, maxWidth: '300px' }} />
            </div>

            {/* Stock Entries List */}
            {stockEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                <p style={{ fontSize: '48px', marginBottom: '15px' }}>📦</p>
                <p>No stock entries yet. Add your first entry above!</p>
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 60px', gap: '15px', padding: '10px 15px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', opacity: 0.7 }}>Item Name</span>
                  <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'right' }}>Stock</span>
                  <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'right' }}>Avg Cost</span>
                  <span></span>
                </div>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {filteredInventoryItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}><p>No items match "{inventorySearch}"</p></div>
                  ) : (
                    inventoryPagination.paginatedItems.map(([itemName, entries, metadata]) => {
                      const isExpanded = expandedItems[itemName];
                      // Use metadata from the filter hook for better performance
                      const totalRemaining = metadata.totalRemaining;
                      const totalQty = metadata.totalQty;
                      const totalValue = metadata.totalValue;
                      const totalCost = totalValue;
                      const avgCost = totalRemaining > 0 ? totalCost / totalRemaining : 0;

                      return (
                        <div key={itemName}>
                          <div onClick={() => toggleItemExpansion(itemName)} style={{ padding: '12px 15px', cursor: 'pointer', background: isExpanded ? 'rgba(255,255,255,0.05)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' }} onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }} onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}>
                            {/* Item Name Row */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                              {renamingItem?.oldName === itemName ? (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                                  <input type="text" value={renamingItem.newName} onChange={(e) => setRenamingItem(prev => ({ ...prev, newName: e.target.value }))} style={{ ...inputStyle, padding: '4px 8px', width: '120px', fontSize: '13px' }} autoFocus placeholder="Item name" onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRenameItem(); if (e.key === 'Escape') setRenamingItem(null); }} />
                                  <input type="text" value={renamingItem.productGroup || ''} onChange={(e) => setRenamingItem(prev => ({ ...prev, productGroup: e.target.value }))} style={{ ...inputStyle, padding: '4px 8px', width: '100px', fontSize: '12px' }} placeholder="Group" list="rename-groups" onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRenameItem(); if (e.key === 'Escape') setRenamingItem(null); }} />
                                  <datalist id="rename-groups">{productGroups.map(g => <option key={g} value={g} />)}</datalist>
                                  <button onClick={handleSaveRenameItem} style={{ background: 'rgba(74,222,128,0.2)', border: 'none', color: '#4ade80', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✓</button>
                                  <button onClick={() => setRenamingItem(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ opacity: 0.4, fontSize: '10px' }}>{isExpanded ? '▼' : '▶'}</span>
                                  <span style={{ fontSize: '14px', fontWeight: '500' }}>{itemName}</span>
                                  {entries[0]?.productGroup && <span style={{ padding: '2px 8px', background: 'rgba(233,69,96,0.2)', borderRadius: '10px', fontSize: '10px', color: '#e94560' }}>{entries[0].productGroup}</span>}
                                  <button onClick={(e) => { e.stopPropagation(); setRenamingItem({ oldName: itemName, newName: itemName, productGroup: entries[0]?.productGroup || '' }); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', opacity: 0.7 }}>✎</button>
                                </div>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', opacity: 0.9 }}>
                                <span>{totalRemaining} / {totalQty} units</span>
                                <span style={{ color: '#ff9f43' }}>₹{formatIndianCurrency(totalValue)}</span>
                              </div>
                            </div>

                            {/* Progress Bar & Stats Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <StockProgressBar current={totalRemaining} total={totalQty} />
                              </div>
                              <div style={{ fontSize: '11px', color: theme.textMuted, whiteSpace: 'nowrap' }}>
                                Avg: ₹{formatIndianCurrency(avgCost)}
                              </div>
                            </div>

                          </div>

                          {isExpanded && (
                            <div style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '8px 15px 8px 25px' }}>
                              {/* Table Header */}
                              <div style={{ display: 'grid', gridTemplateColumns: '95px 60px 75px 55px 1fr 32px', gap: '6px', padding: '6px 4px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '2px' }}>
                                <span style={{ fontSize: '10px', fontWeight: '600', opacity: 0.5, textTransform: 'uppercase' }}>Date</span>
                                <span style={{ fontSize: '10px', fontWeight: '600', opacity: 0.5, textTransform: 'uppercase', textAlign: 'right' }}>Qty</span>
                                <span style={{ fontSize: '10px', fontWeight: '600', opacity: 0.5, textTransform: 'uppercase', textAlign: 'right' }}>Price</span>
                                <span style={{ fontSize: '10px', fontWeight: '600', opacity: 0.5, textTransform: 'uppercase', textAlign: 'right' }}>Left</span>
                                <span style={{ fontSize: '10px', fontWeight: '600', opacity: 0.5, textTransform: 'uppercase' }}>Provider</span>
                                <span></span>
                              </div>
                              {/* Table Rows */}
                              {entries.map(entry => (
                                <div key={entry.id} style={{ display: 'grid', gridTemplateColumns: '95px 60px 75px 55px 1fr 32px', gap: '6px', padding: '5px 4px', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' }}>
                                  {editingStockId === entry.id ? (
                                    <>
                                      <input type="date" value={editingStockData?.date || ''} onChange={(e) => setEditingStockData(prev => ({ ...prev, date: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditStock(); if (e.key === 'Escape') handleCancelEditStock(); }} style={{ ...inputStyle, padding: '3px 5px', fontSize: '11px', width: '100%' }} />
                                      <input type="number" value={editingStockData?.quantity || ''} onChange={(e) => setEditingStockData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditStock(); if (e.key === 'Escape') handleCancelEditStock(); }} style={{ ...inputStyle, padding: '3px 5px', fontSize: '11px', textAlign: 'right', width: '100%' }} />
                                      <input type="number" value={editingStockData?.purchasePrice || ''} onChange={(e) => setEditingStockData(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditStock(); if (e.key === 'Escape') handleCancelEditStock(); }} style={{ ...inputStyle, padding: '3px 5px', fontSize: '11px', textAlign: 'right', width: '100%' }} />
                                      <span style={{ fontSize: '11px', textAlign: 'right', color: editingStockData?.remaining > 0 ? '#4ade80' : '#ff6b6b', fontWeight: '500', padding: '3px 5px', opacity: 0.7 }}>{editingStockData?.remaining}</span>
                                      <input type="text" value={editingStockData?.provider || ''} onChange={(e) => setEditingStockData(prev => ({ ...prev, provider: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditStock(); if (e.key === 'Escape') handleCancelEditStock(); }} list="edit-providers" style={{ ...inputStyle, padding: '3px 5px', fontSize: '11px', width: '100%' }} />
                                      <datalist id="edit-providers">{providers.map(p => <option key={p} value={p} />)}</datalist>
                                      <div style={{ display: 'flex', gap: '2px' }}>
                                        <button onClick={handleSaveEditStock} style={{ background: 'rgba(74,222,128,0.3)', border: 'none', color: '#4ade80', padding: '3px 5px', borderRadius: '3px', cursor: 'pointer', fontSize: '9px' }}>✓</button>
                                        <button onClick={handleCancelEditStock} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '3px 5px', borderRadius: '3px', cursor: 'pointer', fontSize: '9px' }}>✕</button>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <span onClick={() => handleEditStock(entry)} style={{ fontSize: '11px', opacity: 0.8, cursor: 'pointer', padding: '2px 4px', borderRadius: '3px', transition: 'background 0.1s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>{formatDate(entry.date)}</span>
                                      <span onClick={() => handleEditStock(entry)} style={{ fontSize: '11px', textAlign: 'right', cursor: 'pointer', padding: '2px 4px', borderRadius: '3px', transition: 'background 0.1s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>{entry.quantity}</span>
                                      <span onClick={() => handleEditStock(entry)} style={{ fontSize: '11px', textAlign: 'right', cursor: 'pointer', padding: '2px 4px', borderRadius: '3px', transition: 'background 0.1s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>₹{formatIndianCurrency(entry.purchasePrice)}</span>
                                      <span style={{ fontSize: '11px', textAlign: 'right', color: entry.remaining > 0 ? '#4ade80' : '#ff6b6b', fontWeight: '500', padding: '2px 4px' }}>{entry.remaining}</span>
                                      <span onClick={() => handleEditStock(entry)} style={{ fontSize: '10px', color: entry.provider ? '#60a5fa' : 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '2px 4px', borderRadius: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'background 0.1s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>{entry.provider || '—'}</span>
                                      <button onClick={() => setDeleteModal({ show: true, receiptId: null, entryId: entry.id })} style={{ background: 'transparent', border: 'none', color: '#ff6b6b', padding: '2px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', opacity: 0.5, transition: 'opacity 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}>✕</button>
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
                {/* Pagination Controls */}
                {inventoryPagination.totalPages > 1 && (
                  <div style={paginationStyles.container}>
                    <span>Showing {inventoryPagination.startItem}-{inventoryPagination.endItem} of {inventoryPagination.totalItems} items</span>
                    <div style={paginationStyles.controls}>
                      <button onClick={inventoryPagination.goToPrevPage} disabled={!inventoryPagination.hasPrevPage} style={{ ...paginationStyles.button, ...(inventoryPagination.hasPrevPage ? {} : paginationStyles.buttonDisabled) }}>← Prev</button>
                      <span style={paginationStyles.pageInfo}>Page {inventoryPagination.currentPage} of {inventoryPagination.totalPages}</span>
                      <button onClick={inventoryPagination.goToNextPage} disabled={!inventoryPagination.hasNextPage} style={{ ...paginationStyles.button, ...(inventoryPagination.hasNextPage ? {} : paginationStyles.buttonDisabled) }}>Next →</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PRICING TAB */}
        {activeTab === 'pricing' && (
          <div style={{ background: theme.surface, borderRadius: '16px', padding: isMobile ? '15px' : '25px', border: `1px solid ${theme.border}`, boxShadow: theme.shadow || 'none' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '500' }}>💰 Pricing</h2>
            {uniqueItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}><p style={{ fontSize: '48px', marginBottom: '15px' }}>💰</p><p>No items yet. Add stock entries in the Inventory tab first!</p></div>
            ) : (
              <div>
                {/* Desktop: Table header */}
                {!isMobile && (
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '15px', padding: '10px 15px', borderBottom: `1px solid ${theme.border}`, marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', opacity: 0.7 }}>Item Name</span>
                    <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'right' }}>Avg Cost</span>
                    <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'right' }}>Avg Sold</span>
                    <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'right' }}>Default Price</span>
                    <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'center' }}>Margin</span>
                    <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'right' }}>Stock</span>
                  </div>
                )}
                {uniqueItems.map(item => {
                  const margin = item.sellingPrice - item.avgCost;
                  const marginPercent = item.avgCost > 0 ? ((margin / item.avgCost) * 100).toFixed(0) : (item.sellingPrice > 0 ? '∞' : '--');
                  return isMobile ? (
                    /* Mobile: Card layout */
                    <div key={item.name} style={{ padding: '15px', background: theme.surfaceHover, borderRadius: '12px', marginBottom: '10px', border: `1px solid ${theme.borderLight}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '600' }}>{item.name}</span>
                        <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '15px', background: item.totalStock > 10 ? `${theme.success}20` : item.totalStock > 0 ? `${theme.warning}20` : `${theme.danger}20`, color: item.totalStock > 10 ? theme.success : item.totalStock > 0 ? theme.warning : theme.danger }}>{item.totalStock} in stock</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                        <div><span style={{ fontSize: '11px', opacity: 0.6 }}>Avg Cost</span><p style={{ fontSize: '14px', color: theme.warning, margin: '2px 0 0' }}>₹{formatIndianCurrency(item.avgCost)}</p></div>
                        <div><span style={{ fontSize: '11px', opacity: 0.6 }}>Avg Sold</span><p style={{ fontSize: '14px', color: item.avgSellingPrice > 0 ? theme.info : theme.textMuted, margin: '2px 0 0' }}>{item.avgSellingPrice > 0 ? `₹${formatIndianCurrency(item.avgSellingPrice)}` : '--'}</p></div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}><label style={{ fontSize: '11px', opacity: 0.6 }}>Selling Price</label><input type="number" value={item.sellingPrice || ''} onChange={(e) => updateSellingPrice(item.name, e.target.value)} placeholder="0" style={{ ...inputStyle, padding: '10px 12px', textAlign: 'right', color: theme.success, fontWeight: '600' }} /></div>
                        <div style={{ textAlign: 'center', minWidth: '60px' }}><span style={{ fontSize: '11px', opacity: 0.6 }}>Margin</span><p style={{ fontSize: '14px', fontWeight: '600', color: margin >= 0 ? theme.success : theme.danger, margin: '2px 0 0' }}>{marginPercent !== '--' && marginPercent !== '∞' ? `+${marginPercent}%` : marginPercent}</p></div>
                      </div>
                    </div>
                  ) : (
                    /* Desktop: Table row */
                    <div key={item.name} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '15px', padding: '15px', background: theme.surfaceHover, borderBottom: `1px solid ${theme.borderLight}`, alignItems: 'center' }}>
                      <span style={{ fontSize: '14px' }}>{item.name}</span>
                      <span style={{ fontSize: '13px', color: theme.warning, textAlign: 'right' }}>₹{formatIndianCurrency(item.avgCost)}</span>
                      <span style={{ fontSize: '13px', color: item.avgSellingPrice > 0 ? theme.info : theme.textMuted, textAlign: 'right' }}>{item.avgSellingPrice > 0 ? `₹${formatIndianCurrency(item.avgSellingPrice)}` : '--'}</span>
                      <div><input type="number" value={item.sellingPrice || ''} onChange={(e) => updateSellingPrice(item.name, e.target.value)} placeholder="0" style={{ ...inputStyle, padding: '8px 12px', textAlign: 'right', color: theme.success, fontWeight: '600' }} /></div>
                      <span style={{ fontSize: '12px', textAlign: 'center', color: margin >= 0 ? theme.success : theme.danger }}>{marginPercent !== '--' && marginPercent !== '∞' ? `+${marginPercent}%` : marginPercent}</span>
                      <span style={{ fontSize: '13px', textAlign: 'right', padding: '4px 10px', borderRadius: '15px', background: item.totalStock > 10 ? `${theme.success}20` : item.totalStock > 0 ? `${theme.warning}20` : `${theme.danger}20`, color: item.totalStock > 10 ? theme.success : item.totalStock > 0 ? theme.warning : theme.danger, display: 'inline-block' }}>{item.totalStock}</span>
                    </div>
                  );
                })}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? '10px' : '20px', marginTop: '25px', padding: isMobile ? '15px' : '20px', background: theme.surfaceHover, borderRadius: '12px' }}>
                  <div style={{ textAlign: 'center' }}><p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '5px' }}>Total Items</p><p style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '600' }}>{uniqueItems.length}</p></div>
                  <div style={{ textAlign: 'center' }}><p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '5px' }}>Potential Selling Value</p><p style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '600', color: theme.success }}>₹{formatIndianCurrency(uniqueItems.reduce((sum, item) => sum + (item.sellingPrice * item.totalStock), 0))}</p></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div style={{ background: theme.surface, borderRadius: '16px', padding: isMobile ? '15px' : '25px', border: `1px solid ${theme.border}`, boxShadow: theme.shadow || 'none' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '500' }}>📋 Saved Receipts</h2>

            {/* Date Filters */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {[{ id: 'today', label: 'Today' }, { id: 'week', label: 'This Week' }, { id: 'month', label: 'This Month' }, { id: 'custom', label: 'Custom' }].map(filter => (
                <button key={filter.id} onClick={() => setHistoryDateFilter(filter.id)} style={{ background: historyDateFilter === filter.id ? `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover})` : theme.surfaceHover, border: historyDateFilter === filter.id ? 'none' : `1px solid ${theme.border}`, color: historyDateFilter === filter.id ? 'white' : theme.text, padding: isMobile ? '6px 12px' : '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: historyDateFilter === filter.id ? '600' : '400' }}>{filter.label}</button>
              ))}
            </div>

            {historyDateFilter === 'custom' && (
              <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div><label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>From</label><input type="date" value={historyCustomRange.from} onChange={(e) => setHistoryCustomRange(prev => ({ ...prev, from: e.target.value }))} style={{ ...inputStyle, width: isMobile ? '100%' : '150px' }} /></div>
                <div><label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px' }}>To</label><input type="date" value={historyCustomRange.to} onChange={(e) => setHistoryCustomRange(prev => ({ ...prev, to: e.target.value }))} style={{ ...inputStyle, width: isMobile ? '100%' : '150px' }} /></div>
              </div>
            )}

            {/* Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: isMobile ? '10px' : '20px', marginBottom: '20px', padding: isMobile ? '10px' : '15px', background: theme.surfaceHover, borderRadius: '12px' }}>
              <div style={{ textAlign: 'center' }}><p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '3px' }}>Receipts</p><p style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '600' }}>{filteredReceipts.length}</p></div>
              <div style={{ textAlign: 'center' }}><p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '3px' }}>Total Sales</p><p style={{ fontSize: isMobile ? '14px' : '18px', fontWeight: '600', color: theme.success }}>₹{formatIndianCurrency(filteredTotal)}</p></div>
              <div style={{ textAlign: 'center' }}><p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '3px' }}>Items Sold</p><p style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '600' }}>{filteredItemsSold}</p></div>
            </div>

            <SalesChart receipts={filteredReceipts} />

            <div style={{ marginBottom: '15px' }}><input type="text" placeholder="Search by bill #, customer, or item..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} style={{ ...inputStyle, maxWidth: isMobile ? '100%' : '350px' }} /></div>

            {savedReceipts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', opacity: 0.5 }}><p style={{ fontSize: '64px', marginBottom: '20px' }}>📋</p><p>No saved receipts yet.</p></div>
            ) : (
              <div>
                {/* Desktop: Table header */}
                {!isMobile && (
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 100px 100px', gap: '15px', padding: '10px 15px', borderBottom: `1px solid ${theme.border}`, marginBottom: '5px' }}>
                    <span style={{ fontSize: '12px', opacity: 0.7 }}>Bill #</span>
                    <span style={{ fontSize: '12px', opacity: 0.7 }}>Customer</span>
                    <span style={{ fontSize: '12px', opacity: 0.7 }}>Date</span>
                    <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'right' }}>Amount</span>
                    <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'center' }}>Actions</span>
                  </div>
                )}
                <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
                  {filteredReceipts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}><p>No receipts found for this period{historySearch ? ` matching "${historySearch}"` : ''}</p></div>
                  ) : (
                    historyPagination.paginatedItems.map(receipt => {
                      const isExpanded = expandedReceipts[receipt.id];
                      return isMobile ? (
                        /* Mobile: Card layout */
                        <div key={receipt.id} style={{ background: theme.surfaceHover, borderRadius: '12px', marginBottom: '10px', border: `1px solid ${theme.borderLight}`, overflow: 'hidden' }}>
                          <div onClick={() => toggleReceiptExpansion(receipt.id)} style={{ padding: '12px 15px', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontSize: '15px', fontWeight: '600' }}>#{receipt.billNo}</span>
                              <span style={{ fontSize: '16px', fontWeight: '600', color: theme.success }}>₹{formatIndianCurrency(receipt.total)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '13px', color: theme.textSecondary }}>{receipt.customerName || 'Walk-in'}</span>
                              <span style={{ fontSize: '12px', color: theme.textMuted }}>{formatDate(receipt.date)}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', padding: '10px 15px', borderTop: `1px solid ${theme.borderLight}`, background: theme.surface }} onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleEditReceipt(receipt)} style={{ flex: 1, background: theme.surfaceActive, border: `1px solid ${theme.border}`, color: theme.text, padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✎ Edit</button>
                            <button onClick={() => showPrintPreview(receipt)} style={{ flex: 1, background: `${theme.accent}20`, border: 'none', color: theme.accent, padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>🖨️ Print</button>
                            <button onClick={() => setDeleteModal({ show: true, receiptId: receipt.id, entryId: null })} style={{ background: `${theme.danger}20`, border: 'none', color: theme.danger, padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                          </div>
                          {isExpanded && (
                            <div style={{ background: theme.surface, borderTop: `1px solid ${theme.borderLight}`, padding: '12px 15px' }}>
                              {receipt.items.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: idx < receipt.items.length - 1 ? `1px solid ${theme.borderLight}` : 'none' }}>
                                  <span style={{ fontSize: '13px' }}>{item.name} x{item.qty}</span>
                                  <span style={{ fontSize: '13px' }}>₹{formatIndianCurrency(item.amount)}</span>
                                </div>
                              ))}
                              {(receipt.others > 0 || receipt.roundOff !== 0) && (
                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px dashed ${theme.border}`, fontSize: '12px' }}>
                                  {receipt.others > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.7 }}><span>Others:</span><span>₹{formatIndianCurrency(receipt.others)}</span></div>}
                                  {receipt.roundOff !== 0 && <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.7 }}><span>Round Off:</span><span>₹{formatIndianCurrency(receipt.roundOff)}</span></div>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Desktop: Table row */
                        <div key={receipt.id}>
                          <div onClick={() => toggleReceiptExpansion(receipt.id)} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 100px 100px', gap: '15px', padding: '12px 15px', cursor: 'pointer', background: isExpanded ? theme.surfaceActive : 'transparent', borderBottom: `1px solid ${theme.borderLight}`, alignItems: 'center', transition: 'background 0.15s' }} onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = theme.surfaceHover; }} onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ opacity: 0.4, fontSize: '10px' }}>{isExpanded ? '▼' : '▶'}</span><span style={{ fontSize: '14px', fontWeight: '600' }}>#{receipt.billNo}</span></div>
                            <span style={{ fontSize: '13px' }}>{receipt.customerName || 'Walk-in'}</span>
                            <span style={{ fontSize: '13px', opacity: 0.7 }}>{formatDate(receipt.date)}</span>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: theme.success, textAlign: 'right' }}>₹{formatIndianCurrency(receipt.total)}</span>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => handleEditReceipt(receipt)} style={{ background: theme.surfaceActive, border: 'none', color: theme.text, padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✎</button>
                              <button onClick={() => showPrintPreview(receipt)} style={{ background: `${theme.accent}30`, border: 'none', color: theme.accent, padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>🖨️</button>
                              <button onClick={() => setDeleteModal({ show: true, receiptId: receipt.id, entryId: null })} style={{ background: `${theme.danger}20`, border: 'none', color: theme.danger, padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div style={{ background: theme.surfaceHover, borderBottom: `1px solid ${theme.border}`, padding: '10px 15px 15px 40px' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead><tr style={{ opacity: 0.6 }}><th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '500' }}>Item</th><th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '500' }}>Qty</th><th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '500' }}>Rate</th><th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '500' }}>Amount</th></tr></thead>
                                <tbody>{receipt.items.map((item, idx) => (<tr key={idx} style={{ borderTop: `1px solid ${theme.borderLight}` }}><td style={{ padding: '6px 8px' }}>{item.name}</td><td style={{ padding: '6px 8px', textAlign: 'right' }}>{item.qty}</td><td style={{ padding: '6px 8px', textAlign: 'right' }}>₹{formatIndianCurrency(item.rate)}</td><td style={{ padding: '6px 8px', textAlign: 'right' }}>₹{formatIndianCurrency(item.amount)}</td></tr>))}</tbody>
                              </table>
                              {(receipt.others > 0 || receipt.roundOff !== 0) && (
                                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px dashed ${theme.border}`, fontSize: '12px' }}>
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
                {/* Pagination Controls */}
                {historyPagination.totalPages > 1 && (
                  <div style={paginationStyles.container}>
                    <span>Showing {historyPagination.startItem}-{historyPagination.endItem} of {historyPagination.totalItems} receipts</span>
                    <div style={paginationStyles.controls}>
                      <button onClick={historyPagination.goToPrevPage} disabled={!historyPagination.hasPrevPage} style={{ ...paginationStyles.button, ...(historyPagination.hasPrevPage ? {} : paginationStyles.buttonDisabled) }}>← Prev</button>
                      <span style={paginationStyles.pageInfo}>Page {historyPagination.currentPage} of {historyPagination.totalPages}</span>
                      <button onClick={historyPagination.goToNextPage} disabled={!historyPagination.hasNextPage} style={{ ...paginationStyles.button, ...(historyPagination.hasNextPage ? {} : paginationStyles.buttonDisabled) }}>Next →</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
