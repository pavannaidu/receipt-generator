// Currency and number formatting utilities

export const formatIndianCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
