import { useState, useMemo } from 'react';
import { getLocalDateString } from '../utils/dateUtils';
import { DATE_FILTER_OPTIONS } from '../constants/defaults';

/**
 * Custom hook for receipt history filtering
 * Handles search and date range filtering
 */
export function useHistoryFilters({ savedReceipts }) {
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState(DATE_FILTER_OPTIONS.TODAY);
  const [historyCustomRange, setHistoryCustomRange] = useState({
    from: getLocalDateString(),
    to: getLocalDateString()
  });
  const [expandedReceipts, setExpandedReceipts] = useState({});

  // Helper to get date string in YYYY-MM-DD format (local timezone)
  const getDateString = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get date range based on filter
  const getDateRange = () => {
    const today = new Date();
    const todayStr = getDateString(today);

    switch (historyDateFilter) {
      case DATE_FILTER_OPTIONS.TODAY:
        return { from: todayStr, to: todayStr };
      case DATE_FILTER_OPTIONS.WEEK: {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { from: getDateString(weekAgo), to: todayStr };
      }
      case DATE_FILTER_OPTIONS.MONTH: {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return { from: getDateString(monthAgo), to: todayStr };
      }
      case DATE_FILTER_OPTIONS.CUSTOM:
        return {
          from: historyCustomRange.from,
          to: historyCustomRange.to
        };
      default:
        return { from: todayStr, to: todayStr };
    }
  };

  // Get filtered receipts (memoized)
  const filteredReceipts = useMemo(() => {
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
  }, [savedReceipts, historySearch, historyDateFilter, historyCustomRange]);

  // Toggle receipt expansion
  const toggleReceiptExpansion = (receiptId) => {
    setExpandedReceipts(prev => ({
      ...prev,
      [receiptId]: !prev[receiptId]
    }));
  };

  // Calculate summary stats for filtered receipts
  const summaryStats = useMemo(() => {
    const totalSales = filteredReceipts.reduce((sum, r) => sum + r.total, 0);
    const totalReceipts = filteredReceipts.length;
    return { totalSales, totalReceipts };
  }, [filteredReceipts]);

  return {
    // State
    historySearch,
    setHistorySearch,
    historyDateFilter,
    setHistoryDateFilter,
    historyCustomRange,
    setHistoryCustomRange,
    expandedReceipts,

    // Computed
    filteredReceipts,
    summaryStats,
    dateRange: getDateRange(),

    // Actions
    toggleReceiptExpansion
  };
}
