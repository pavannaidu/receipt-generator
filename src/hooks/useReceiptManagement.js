import { useState, useCallback, useEffect } from 'react';
import * as db from '../db';
import { formatIndianCurrency, generateId, escapeHtml } from '../utils/formatters';
import { formatDate } from '../utils/dateUtils';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { getDefaultReceipt, DEFAULT_NEW_ITEM } from '../constants/defaults';

/**
 * Custom hook for receipt management
 * Handles receipt CRUD, printing, and bill numbering
 */
export function useReceiptManagement({
  savedReceipts,
  setSavedReceipts,
  businessInfo,
  nextBillNo,
  setNextBillNo,
  isTauri,
  deductStockLocal,
  restoreStockLocal,
  showSuccess,
  businessId
}) {
  const [currentReceipt, setCurrentReceipt] = useState(getDefaultReceipt(nextBillNo));
  const [newItem, setNewItem] = useState(DEFAULT_NEW_ITEM);
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);

  // Update bill number when nextBillNo changes (from data loader)
  useEffect(() => {
    if (nextBillNo && !editingReceipt) {
      setCurrentReceipt(prev => ({ ...prev, billNo: nextBillNo }));
    }
  }, [nextBillNo, editingReceipt]);

  // Calculate receipt total
  const calculateTotal = useCallback((receipt = currentReceipt) => {
    const itemsTotal = receipt.items.reduce((sum, item) => sum + item.amount, 0);
    return itemsTotal + parseFloat(receipt.others || 0) + parseFloat(receipt.roundOff || 0);
  }, [currentReceipt]);

  // Add item to current receipt
  const addItemToReceipt = useCallback(() => {
    if (newItem.name && newItem.qty > 0 && newItem.rate > 0) {
      const item = {
        id: generateId(),
        name: newItem.name,
        qty: parseFloat(newItem.qty),
        rate: parseFloat(newItem.rate),
        amount: parseFloat(newItem.qty) * parseFloat(newItem.rate)
      };
      setCurrentReceipt(prev => ({ ...prev, items: [...prev.items, item] }));
      setNewItem(DEFAULT_NEW_ITEM);
      setShowItemSuggestions(false);
    }
  }, [newItem]);

  // Remove item from receipt
  const removeItemFromReceipt = useCallback((id) => {
    setCurrentReceipt(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  }, []);

  // Handle item search
  const handleItemSearch = useCallback((searchText) => {
    setNewItem(prev => ({ ...prev, name: searchText }));
    setShowItemSuggestions(searchText.length > 0);
  }, []);

  // Handle item selection from suggestions
  const handleSelectSuggestion = useCallback((item) => {
    setNewItem({ name: item.name, qty: 1, rate: item.sellingPrice });
    setShowItemSuggestions(false);
  }, []);

  // Save receipt (create or update)
  const saveReceipt = useCallback(async () => {
    if (currentReceipt.items.length === 0) return false;

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
            await db.restoreStockFIFO(item.name, item.qty, businessId);
          }
          // Deduct new stock
          for (const item of currentReceipt.items) {
            await db.deductStockFIFO(item.name, item.qty, businessId);
          }
          // Update receipt in database
          await db.updateReceipt(updatedReceipt);
        } catch (err) {
          console.error('Error updating receipt:', err);
          return false;
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
      const newBillNo = isTauri
        ? await db.getNextBillNoForBusiness(businessId)
        : parseInt(localStorage.getItem(STORAGE_KEYS.BILL_NO) || '1');

      setEditingReceipt(null);
      setCurrentReceipt(getDefaultReceipt(newBillNo));
      showSuccess('Receipt updated!');
    } else {
      // CREATING NEW RECEIPT
      const receipt = {
        ...currentReceipt,
        id: generateId(),
        total: calculateTotal(),
        savedAt: new Date().toISOString()
      };

      if (isTauri) {
        try {
          await db.addReceipt(receipt, businessId);
          for (const soldItem of currentReceipt.items) {
            await db.deductStockFIFO(soldItem.name, soldItem.qty, businessId);
          }
          await db.incrementBillNoForBusiness(businessId);
        } catch (err) {
          console.error('Error saving receipt:', err);
          return false;
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

    return true;
  }, [
    currentReceipt,
    editingReceipt,
    calculateTotal,
    isTauri,
    businessId,
    setSavedReceipts,
    setNextBillNo,
    deductStockLocal,
    restoreStockLocal,
    showSuccess
  ]);

  // Edit receipt handler
  const handleEditReceipt = useCallback(async (receipt) => {
    setEditingReceipt(receipt);
    setCurrentReceipt({
      billNo: receipt.billNo,
      date: receipt.date,
      customerName: receipt.customerName,
      items: receipt.items.map(item => ({
        ...item,
        id: item.id || Date.now() + Math.random()
      })),
      others: receipt.others || 0,
      roundOff: receipt.roundOff || 0
    });
    return 'create'; // Return tab to switch to
  }, []);

  // Cancel edit receipt
  const handleCancelEditReceipt = useCallback(async () => {
    setEditingReceipt(null);
    const billNo = isTauri
      ? await db.getNextBillNoForBusiness(businessId)
      : parseInt(localStorage.getItem(STORAGE_KEYS.BILL_NO) || '1');
    setCurrentReceipt(getDefaultReceipt(billNo));
  }, [isTauri, businessId]);

  // Delete receipt
  const deleteReceipt = useCallback(async (receiptId) => {
    if (isTauri) {
      try {
        await db.deleteReceipt(receiptId);
      } catch (err) {
        console.error('Error deleting receipt:', err);
        return false;
      }
    }
    setSavedReceipts(prev => prev.filter(r => r.id !== receiptId));
    showSuccess('Receipt deleted');
    return true;
  }, [isTauri, setSavedReceipts, showSuccess]);

  // Generate print content
  const generatePrintContent = useCallback((receipt) => {
    const itemsTotal = receipt.items.reduce((sum, item) => sum + item.amount, 0);
    return `<!DOCTYPE html><html><head><title>Receipt #${receipt.billNo}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:20px}.receipt{max-width:400px;margin:0 auto}.header{text-align:center;margin-bottom:20px;padding-bottom:15px;border-bottom:2px solid #333}.logo{font-size:32px;font-weight:700}.business-name{font-size:18px;font-weight:500;letter-spacing:2px}.document-type{font-size:14px;text-decoration:underline;margin-top:10px}.info-row{display:flex;justify-content:space-between;margin:8px 0;font-size:14px}.customer-info{margin:15px 0;padding:10px 0;border-bottom:1px dashed #ccc}table{width:100%;border-collapse:collapse;margin:15px 0;font-size:13px}th{background:#f8f8f8;padding:10px 5px;text-align:left;border-bottom:2px solid #333}th:nth-child(2),th:nth-child(3),th:nth-child(4){text-align:right}td{padding:8px 5px;border-bottom:1px solid #eee}td:nth-child(2),td:nth-child(3),td:nth-child(4){text-align:right}.totals{margin-top:20px;border-top:2px solid #333;padding-top:15px}.total-row{display:flex;justify-content:space-between;padding:5px 0;font-size:14px}.total-row.final{font-weight:700;font-size:16px;border-top:1px solid #333;margin-top:10px;padding-top:10px}.footer{margin-top:30px;text-align:center;font-size:12px;color:#666}@media print{body{padding:0}}</style></head><body><div class="receipt"><div class="header"><div class="logo">ba</div><div class="business-name">${escapeHtml(businessInfo.name)}</div>${businessInfo.address ? `<div style="font-size:12px;color:#666">${escapeHtml(businessInfo.address)}</div>` : ''}${businessInfo.phone ? `<div style="font-size:12px;color:#666">Ph: ${escapeHtml(businessInfo.phone)}</div>` : ''}${businessInfo.gstin ? `<div style="font-size:12px;color:#666">GSTIN: ${escapeHtml(businessInfo.gstin)}</div>` : ''}<div class="document-type">ESTIMATE</div></div><div class="customer-info"><div class="info-row"><span><strong>To:</strong> ${escapeHtml(receipt.customerName) || 'Walk-in Customer'}</span></div><div class="info-row"><span><strong>Bill Date:</strong> ${formatDate(receipt.date)}</span><span><strong>Bill No:</strong> ${receipt.billNo}</span></div></div><table><thead><tr><th style="width:45%">Particulars</th><th style="width:15%">Qty</th><th style="width:20%">Rate</th><th style="width:20%">Amount</th></tr></thead><tbody>${receipt.items.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${formatIndianCurrency(item.qty)}</td><td>${formatIndianCurrency(item.rate)}</td><td>${formatIndianCurrency(item.amount)}</td></tr>`).join('')}</tbody></table><div class="totals"><div class="total-row"><span>Bill Total</span><span>${formatIndianCurrency(itemsTotal)}</span></div><div class="total-row"><span>Others</span><span>${formatIndianCurrency(receipt.others || 0)}</span></div><div class="total-row"><span>Round Off</span><span>${formatIndianCurrency(receipt.roundOff || 0)}</span></div><div class="total-row final"><span>Net Amount</span><span>₹ ${formatIndianCurrency(receipt.total)}</span></div></div><div class="footer"><p>Thank you for your business!</p></div></div><script>window.onload=function(){window.print()}</script></body></html>`;
  }, [businessInfo]);

  // Handle print
  const handlePrint = useCallback((receipt) => {
    const printContent = generatePrintContent(receipt);
    const printFrame = document.createElement('iframe');
    printFrame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(printFrame);
    printFrame.contentWindow.document.open();
    printFrame.contentWindow.document.write(printContent);
    printFrame.contentWindow.document.close();
    setTimeout(() => {
      if (document.body.contains(printFrame)) {
        document.body.removeChild(printFrame);
      }
    }, 5000);
  }, [generatePrintContent]);

  return {
    // State
    currentReceipt,
    setCurrentReceipt,
    newItem,
    setNewItem,
    showItemSuggestions,
    setShowItemSuggestions,
    editingReceipt,

    // Actions
    calculateTotal,
    addItemToReceipt,
    removeItemFromReceipt,
    handleItemSearch,
    handleSelectSuggestion,
    saveReceipt,
    handleEditReceipt,
    handleCancelEditReceipt,
    deleteReceipt,
    handlePrint,
    generatePrintContent
  };
}
