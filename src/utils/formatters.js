// Currency and number formatting utilities

export const formatIndianCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Generate a unique ID safe from collisions under rapid calls
let idCounter = 0;
export const generateId = () => {
  const now = Date.now();
  idCounter = (idCounter + 1) % 1000;
  return now * 1000 + idCounter;
};

// Escape HTML to prevent XSS when interpolating into innerHTML
export const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
