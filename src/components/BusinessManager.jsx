import React, { useState } from 'react';
import { useTheme, getThemedStyles } from '../contexts/ThemeContext';
import { useBusiness } from '../contexts/BusinessContext';
import { useIsMobile } from '../hooks/useMediaQuery';

// Helper to get business initials from name
const getBusinessInitials = (name) => {
  if (!name) return '??';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

// Business icon component
const BusinessIcon = ({ business, size = 40, theme }) => {
  const initials = getBusinessInitials(business?.name);
  const displayIcon = business?.icon || initials;
  const isEmoji = /\p{Emoji}/u.test(displayIcon) && displayIcon.length <= 2;

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '10px',
      background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: isEmoji ? size * 0.5 : size * 0.4,
      fontWeight: '700',
      color: 'white',
      flexShrink: 0
    }}>
      {displayIcon}
    </div>
  );
};

export default function BusinessManager({ onClose, onSwitchBusiness }) {
  const { theme, isDark } = useTheme();
  const styles = getThemedStyles(theme);
  const isMobile = useIsMobile();
  const {
    businesses,
    currentBusiness,
    addBusiness,
    editBusiness,
    removeBusiness,
    setCurrentBusiness
  } = useBusiness();

  const [mode, setMode] = useState('list'); // 'list', 'create', 'edit'
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    gstin: '',
    icon: ''
  });
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleStartCreate = () => {
    setFormData({ name: '', address: '', phone: '', gstin: '', icon: '' });
    setEditingBusiness(null);
    setError(null);
    setMode('create');
  };

  const handleStartEdit = (business) => {
    setFormData({
      name: business.name,
      address: business.address || '',
      phone: business.phone || '',
      gstin: business.gstin || '',
      icon: business.icon || ''
    });
    setEditingBusiness(business);
    setError(null);
    setMode('edit');
  };

  const handleCancel = () => {
    setMode('list');
    setEditingBusiness(null);
    setFormData({ name: '', address: '', phone: '', gstin: '', icon: '' });
    setError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Business name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (mode === 'edit' && editingBusiness) {
        await editBusiness({
          ...editingBusiness,
          name: formData.name.trim(),
          address: formData.address.trim(),
          phone: formData.phone.trim(),
          gstin: formData.gstin.trim(),
          icon: formData.icon.trim()
        });
      } else {
        await addBusiness({
          name: formData.name.trim(),
          address: formData.address.trim(),
          phone: formData.phone.trim(),
          gstin: formData.gstin.trim(),
          icon: formData.icon.trim()
        });
      }
      handleCancel();
    } catch (e) {
      console.error('Business save error:', e);
      setError(e.message || e.toString() || 'Failed to save business');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (businessId) => {
    try {
      await removeBusiness(businessId);
      setConfirmDelete(null);
    } catch (e) {
      setError(e.message || 'Failed to delete business');
    }
  };

  const handleSwitch = (business) => {
    setCurrentBusiness(business);
    if (onSwitchBusiness) {
      onSwitchBusiness(business);
    }
    onClose();
  };

  const modalStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: isMobile ? '16px' : '20px',
    backdropFilter: 'blur(4px)'
  };

  const contentStyle = {
    ...styles.cardStyle,
    width: '100%',
    maxWidth: isMobile ? '100%' : '500px',
    maxHeight: '90vh',
    overflow: 'auto',
    padding: isMobile ? '20px' : '30px'
  };

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: isMobile ? '18px' : '20px',
            fontWeight: '600',
            color: theme.text
          }}>
            {mode === 'list' && 'Manage Businesses'}
            {mode === 'create' && 'Create Business'}
            {mode === 'edit' && 'Edit Business'}
          </h2>
          <button
            onClick={mode === 'list' ? onClose : handleCancel}
            style={{
              background: 'none',
              border: 'none',
              color: theme.textMuted,
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            {mode === 'list' ? '\u00D7' : '\u2190'}
          </button>
        </div>

        {/* List View */}
        {mode === 'list' && (
          <>
            <div style={{ marginBottom: '16px' }}>
              {businesses.map(business => (
                <div
                  key={business.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    background: business.id === currentBusiness?.id ? `${theme.accent}15` : theme.surface,
                    border: `1px solid ${business.id === currentBusiness?.id ? theme.accent : theme.border}`,
                    borderRadius: '10px',
                    marginBottom: '8px'
                  }}
                >
                  <BusinessIcon business={business} size={36} theme={theme} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{
                        fontSize: '15px',
                        fontWeight: '500',
                        color: theme.text
                      }}>{business.name}</span>
                      {business.id === currentBusiness?.id && (
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          background: theme.accent,
                          color: 'white',
                          borderRadius: '4px',
                          fontWeight: '600'
                        }}>ACTIVE</span>
                      )}
                    </div>
                    {business.gstin && (
                      <div style={{
                        fontSize: '12px',
                        color: theme.textMuted,
                        marginTop: '2px'
                      }}>GSTIN: {business.gstin}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {business.id !== currentBusiness?.id && (
                      <button
                        onClick={() => handleSwitch(business)}
                        style={{
                          background: theme.accent,
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          color: 'white',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        Switch
                      </button>
                    )}
                    <button
                      onClick={() => handleStartEdit(business)}
                      style={{
                        background: theme.surfaceHover,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '6px',
                        padding: '6px 12px',
                        color: theme.text,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Edit
                    </button>
                    {businesses.length > 1 && business.id !== currentBusiness?.id && (
                      <button
                        onClick={() => setConfirmDelete(business)}
                        style={{
                          background: `${theme.danger}15`,
                          border: `1px solid ${theme.danger}30`,
                          borderRadius: '6px',
                          padding: '6px 12px',
                          color: theme.danger,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleStartCreate}
              style={{
                width: '100%',
                ...styles.btnPrimary
              }}
            >
              + Add New Business
            </button>

            {/* Delete Confirmation */}
            {confirmDelete && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: `${theme.danger}10`,
                border: `1px solid ${theme.danger}30`,
                borderRadius: '10px'
              }}>
                <p style={{
                  margin: '0 0 12px 0',
                  color: theme.text,
                  fontSize: '14px'
                }}>
                  Delete <strong>{confirmDelete.name}</strong>? This will remove all data associated with this business.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    style={styles.btnSecondary}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(confirmDelete.id)}
                    style={{
                      ...styles.btnPrimary,
                      background: theme.danger
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Create/Edit Form */}
        {(mode === 'create' || mode === 'edit') && (
          <form onSubmit={handleSave}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  color: theme.textSecondary,
                  fontSize: '13px',
                  fontWeight: '500'
                }}>Business Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter business name"
                  style={styles.inputStyle}
                  autoFocus
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  color: theme.textSecondary,
                  fontSize: '13px',
                  fontWeight: '500'
                }}>Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter address"
                  style={styles.inputStyle}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  color: theme.textSecondary,
                  fontSize: '13px',
                  fontWeight: '500'
                }}>Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone number"
                  style={styles.inputStyle}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  color: theme.textSecondary,
                  fontSize: '13px',
                  fontWeight: '500'
                }}>GSTIN</label>
                <input
                  type="text"
                  value={formData.gstin}
                  onChange={(e) => setFormData(prev => ({ ...prev, gstin: e.target.value }))}
                  placeholder="GSTIN number"
                  style={styles.inputStyle}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  color: theme.textSecondary,
                  fontSize: '13px',
                  fontWeight: '500'
                }}>Icon (optional)</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                    placeholder="Emoji or 2 letters"
                    maxLength={2}
                    style={{ ...styles.inputStyle, width: '120px', textAlign: 'center', fontSize: '18px' }}
                  />
                  <BusinessIcon
                    business={{ name: formData.name, icon: formData.icon }}
                    size={44}
                    theme={theme}
                  />
                  <span style={{ fontSize: '12px', color: theme.textMuted }}>
                    Leave blank to use initials
                  </span>
                </div>
              </div>

              {error && (
                <div style={{
                  padding: '12px',
                  background: `${theme.danger}20`,
                  border: `1px solid ${theme.danger}40`,
                  borderRadius: '8px',
                  color: theme.danger,
                  fontSize: '13px'
                }}>{error}</div>
              )}

              <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '8px'
              }}>
                <button
                  type="button"
                  onClick={handleCancel}
                  style={styles.btnSecondary}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    ...styles.btnPrimary,
                    flex: 1,
                    opacity: isSaving ? 0.7 : 1
                  }}
                >
                  {isSaving ? 'Saving...' : (mode === 'edit' ? 'Save Changes' : 'Create Business')}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
