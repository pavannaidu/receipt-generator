// Date utility functions

// Format date to DD-MM-YYYY for display
// Handles YYYY-MM-DD strings without timezone conversion issues
export const formatDate = (date) => {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Parse YYYY-MM-DD string directly to avoid UTC conversion
    const [year, month, day] = date.split('-');
    return `${day}-${month}-${year}`;
  }
  // Fallback for Date objects
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

// Get today's date in YYYY-MM-DD format using local timezone (NOT UTC)
// This fixes the off-by-one day issue in IST timezone
export const getLocalDateString = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get date string in YYYY-MM-DD format (local timezone) - alias for consistency
export const getDateString = getLocalDateString;
