import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

export function StockProgressBar({ current, total }) {
  const { theme } = useTheme();
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  const getColor = () => {
    if (percentage === 0) return theme.textMuted;
    if (percentage > 50) return theme.success || '#4ade80';
    if (percentage > 10) return theme.warning || '#ff9f43';
    return theme.danger || '#e94560';
  };

  const color = getColor();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      width: '100%'
    }}>
      <div style={{
        flex: 1,
        height: '8px',
        background: theme.surfaceHover || `${theme.surface}80`,
        borderRadius: '4px',
        overflow: 'hidden',
        border: `1px solid ${theme.border}`
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          background: color,
          transition: 'width 0.3s ease',
          borderRadius: '3px'
        }} />
      </div>
      <span style={{
        fontSize: '12px',
        fontWeight: '600',
        color: color,
        minWidth: '45px',
        textAlign: 'right'
      }}>
        {percentage}%
      </span>
    </div>
  );
}
