import { useState, useMemo } from 'react';

/**
 * Custom hook for pagination
 * @param {Array} items - The full array of items to paginate
 * @param {number} itemsPerPage - Number of items per page (default 25)
 */
export function usePagination(items, itemsPerPage = 25) {
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(items.length / itemsPerPage);
  }, [items.length, itemsPerPage]);

  // Get paginated items
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, itemsPerPage]);

  // Reset to page 1 when items change significantly
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Navigation handlers
  const goToPage = (page) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);

  // Info for display
  const startItem = items.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, items.length);

  return {
    // Data
    paginatedItems,
    currentPage,
    totalPages,
    totalItems: items.length,

    // Display info
    startItem,
    endItem,

    // Navigation
    goToPage,
    goToNextPage,
    goToPrevPage,
    goToFirstPage,
    goToLastPage,

    // Helpers
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages || totalPages === 0
  };
}

/**
 * Pagination controls component styles
 */
export const paginationStyles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    marginTop: '10px',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.7)'
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  button: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s'
  },
  buttonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed'
  },
  pageInfo: {
    padding: '6px 12px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '6px'
  }
};
