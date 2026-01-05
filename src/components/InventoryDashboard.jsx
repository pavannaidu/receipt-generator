import React, { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { formatIndianCurrency } from '../utils/formatters';
import { useIsMobile } from '../hooks/useMediaQuery';

export function InventoryDashboard({ stockEntries, savedReceipts }) {
  const { theme } = useTheme();
  const isMobile = useIsMobile();

  const metrics = useMemo(() => {
    const uniqueItems = new Set(stockEntries.map(e => e.name)).size;

    const totalValue = stockEntries.reduce((sum, e) =>
      sum + (e.remaining * e.purchasePrice), 0
    );

    const lowStockItems = new Set(
      stockEntries
        .filter(e => e.remaining > 0 && e.remaining < 10)
        .map(e => e.name)
    ).size;

    const outOfStockItems = new Set(
      stockEntries
        .filter(e => e.remaining === 0)
        .map(e => e.name)
    ).size;

    return {
      uniqueItems,
      totalValue,
      lowStockItems,
      outOfStockItems
    };
  }, [stockEntries]);

  const MetricCard = ({ label, value, icon, color }) => (
    <div style={{
      background: theme.surface,
      border: `1px solid ${theme.border}`,
      borderRadius: '12px',
      padding: isMobile ? '16px' : '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      boxShadow: theme.shadow || 'none'
    }}>
      <div style={{
        fontSize: '12px',
        color: theme.textMuted,
        fontWeight: '500'
      }}>
        {icon} {label}
      </div>
      <div style={{
        fontSize: isMobile ? '24px' : '28px',
        fontWeight: '700',
        color: color || theme.text
      }}>
        {value}
      </div>
    </div>
  );

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile
        ? '1fr'
        : 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: isMobile ? '12px' : '16px',
      marginBottom: isMobile ? '20px' : '24px'
    }}>
      <MetricCard
        label="Total Items"
        value={metrics.uniqueItems}
        icon="📦"
      />
      <MetricCard
        label="Total Value"
        value={`₹${formatIndianCurrency(metrics.totalValue)}`}
        icon="💰"
      />
      <MetricCard
        label="Low Stock"
        value={metrics.lowStockItems}
        icon="⚠️"
        color={theme.warning}
      />
      <MetricCard
        label="Out of Stock"
        value={metrics.outOfStockItems}
        icon="🚫"
        color={theme.danger}
      />
    </div>
  );
}
