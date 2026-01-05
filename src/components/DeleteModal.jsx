import React from 'react';
import { useTheme, getThemedStyles } from '../contexts/ThemeContext';
import { useIsMobile } from '../hooks/useMediaQuery';

const DeleteModal = ({ show, isEntry, onCancel, onConfirm }) => {
  const { theme } = useTheme();
  const { btnPrimary, btnSecondary } = getThemedStyles(theme);
  const isMobile = useIsMobile();

  if (!show) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: isMobile ? '10px' : '20px' }}>
      <div style={{ background: theme.name === 'dark' ? '#1a1a2e' : '#ffffff', padding: isMobile ? '20px' : '30px', borderRadius: '16px', width: isMobile ? '95vw' : '400px', maxWidth: '400px', border: `1px solid ${theme.border}`, textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '15px' }}>🗑️</div>
        <h2 style={{ marginBottom: '10px', fontSize: '20px', color: theme.text }}>Delete {isEntry ? 'Entry' : 'Receipt'}?</h2>
        <p style={{ opacity: 0.7, marginBottom: '25px', fontSize: '14px', color: theme.text }}>This action cannot be undone.</p>
        <div style={{ display: 'flex', gap: '15px', flexDirection: isMobile ? 'column' : 'row' }}>
          <button onClick={onCancel} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
          <button onClick={onConfirm} style={{ ...btnPrimary, flex: 1 }}>Delete</button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
