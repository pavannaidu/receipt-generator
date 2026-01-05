import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const MobileDrawer = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  onOpenSettings,
  onManageBusinesses,
  businessInfo
}) => {
  const { theme, toggleTheme, isDark } = useTheme();

  const tabs = [
    { id: 'create', label: 'Create Receipt', icon: '📝' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'pricing', label: 'Pricing', icon: '💰' },
    { id: 'history', label: 'History', icon: '📋' }
  ];

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    onClose();
  };

  const handleSettingsClick = () => {
    onOpenSettings();
    onClose();
  };

  const handleManageBusinessesClick = () => {
    if (onManageBusinesses) {
      onManageBusinesses();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 998,
          animation: 'fadeIn 0.2s ease-out'
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(280px, 80vw)',
          background: theme.name === 'dark' ? '#1a1a2e' : '#ffffff',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.25s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontWeight: '600', fontSize: '16px', color: theme.text }}>Menu</span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: theme.text,
              padding: '4px',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Business Info Summary */}
        {businessInfo?.name && (
          <div style={{
            padding: '15px 20px',
            background: theme.surface,
            borderBottom: `1px solid ${theme.border}`
          }}>
            <div style={{ fontWeight: '600', fontSize: '14px', color: theme.text }}>
              {businessInfo.name}
            </div>
            {businessInfo.phone && (
              <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '4px' }}>
                {businessInfo.phone}
              </div>
            )}
          </div>
        )}

        {/* Navigation Tabs */}
        <div style={{ flex: 1, padding: '15px 10px', overflowY: 'auto' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              style={{
                width: '100%',
                padding: '14px 15px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: activeTab === tab.id ? theme.surfaceActive : 'transparent',
                border: 'none',
                borderRadius: '10px',
                color: activeTab === tab.id ? theme.accent : theme.text,
                fontWeight: activeTab === tab.id ? '600' : '500',
                fontSize: '15px',
                cursor: 'pointer',
                marginBottom: '5px',
                transition: 'background 0.15s'
              }}
            >
              <span style={{ fontSize: '18px' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '15px 20px',
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            style={{
              width: '100%',
              padding: '12px 15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: '10px',
              color: theme.text,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
            <span style={{ fontSize: '18px' }}>{isDark ? '🌙' : '☀️'}</span>
          </button>

          {/* Switch Business Button */}
          <button
            onClick={handleManageBusinessesClick}
            style={{
              width: '100%',
              padding: '12px 15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: `${theme.accent}15`,
              border: `1px solid ${theme.accent}30`,
              borderRadius: '10px',
              color: theme.accent,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <span>Switch Business</span>
            <span style={{ fontSize: '18px' }}>🔄</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={handleSettingsClick}
            style={{
              width: '100%',
              padding: '12px 15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: '10px',
              color: theme.text,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <span>Settings</span>
            <span style={{ fontSize: '18px' }}>⚙️</span>
          </button>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
};

export default MobileDrawer;
