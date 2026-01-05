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

export default function BusinessSelector() {
  const { theme } = useTheme();
  const styles = getThemedStyles(theme);
  const isMobile = useIsMobile();
  const {
    businesses,
    hasBusinesses,
    loading,
    setCurrentBusiness,
    addBusiness
  } = useBusiness();

  const [showCreateForm, setShowCreateForm] = useState(!hasBusinesses);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    gstin: ''
  });
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleCreateBusiness = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Business name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const newBusiness = await addBusiness({
        name: formData.name.trim(),
        address: formData.address.trim(),
        phone: formData.phone.trim(),
        gstin: formData.gstin.trim()
      });
      setCurrentBusiness(newBusiness);
    } catch (e) {
      setError(e.message || 'Failed to create business');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectBusiness = (business) => {
    setCurrentBusiness(business);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.background
      }}>
        <div style={{ color: theme.text, fontSize: '18px' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: theme.background,
      padding: isMobile ? '20px' : '40px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: isMobile ? '100%' : '600px',
        ...styles.cardStyle,
        padding: isMobile ? '24px' : '40px'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 10px',
            borderRadius: '16px',
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px'
          }}>📋</div>
          <h1 style={{
            fontSize: isMobile ? '20px' : '24px',
            fontWeight: '600',
            color: theme.text,
            margin: '0 0 8px 0'
          }}>
            {hasBusinesses ? 'Select Business' : 'Create Your First Business'}
          </h1>
          <p style={{
            color: theme.textMuted,
            fontSize: '14px',
            margin: 0
          }}>
            {hasBusinesses
              ? 'Choose a business to manage or create a new one'
              : 'Get started by setting up your business details'
            }
          </p>
        </div>

        {/* Business List */}
        {hasBusinesses && !showCreateForm && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: '12px'
            }}>
              {businesses.map(business => (
                <button
                  key={business.id}
                  onClick={() => handleSelectBusiness(business)}
                  style={{
                    background: theme.surface,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '12px',
                    padding: '16px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = theme.accent;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme.border;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <BusinessIcon business={business} size={44} theme={theme} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: theme.text,
                      marginBottom: '4px'
                    }}>{business.name}</div>
                    {business.gstin && (
                      <div style={{
                        fontSize: '12px',
                        color: theme.textMuted,
                        background: theme.surfaceHover,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        display: 'inline-block'
                      }}>GSTIN: {business.gstin}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowCreateForm(true)}
              style={{
                width: '100%',
                marginTop: '16px',
                ...styles.btnSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '18px' }}>+</span>
              Create New Business
            </button>
          </div>
        )}

        {/* Create Form */}
        {(showCreateForm || !hasBusinesses) && (
          <form onSubmit={handleCreateBusiness}>
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

              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                gap: '16px'
              }}>
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
                {hasBusinesses && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormData({ name: '', address: '', phone: '', gstin: '' });
                      setError(null);
                    }}
                    style={styles.btnSecondary}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    ...styles.btnPrimary,
                    flex: 1,
                    opacity: isSaving ? 0.7 : 1
                  }}
                >
                  {isSaving ? 'Creating...' : (hasBusinesses ? 'Create Business' : 'Get Started')}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
