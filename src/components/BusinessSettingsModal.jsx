import React, { useState, useEffect } from 'react';
import { getDbPath, setDbPath, closeDb, isTauri } from '../db';
import { useTheme, getThemedStyles } from '../contexts/ThemeContext';
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

// Business icon preview component
const BusinessIconPreview = ({ name, icon, theme }) => {
  const initials = getBusinessInitials(name);
  const displayIcon = icon || initials;
  const isEmoji = /\p{Emoji}/u.test(displayIcon) && displayIcon.length <= 2;

  return (
    <div style={{
      width: 44,
      height: 44,
      borderRadius: '10px',
      background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: isEmoji ? 22 : 17,
      fontWeight: '700',
      color: 'white',
      flexShrink: 0
    }}>
      {displayIcon}
    </div>
  );
};

const BusinessSettingsModal = ({ show, businessInfo, onChange, onSave }) => {
  const { theme } = useTheme();
  const { inputStyle, btnPrimary, btnSecondary } = getThemedStyles(theme);
  const isMobile = useIsMobile();
  // Data location state
  const [currentDataPath, setCurrentDataPath] = useState('');
  const [newDataPath, setNewDataPath] = useState('');
  const [migrateData, setMigrateData] = useState(true);
  const [isChangingPath, setIsChangingPath] = useState(false);
  const [pathError, setPathError] = useState('');
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);

  // Load current path when modal opens
  useEffect(() => {
    if (show && isTauri()) {
      getDbPath().then(setCurrentDataPath).catch(() => {});
    }
  }, [show]);

  // Folder picker handler
  const handleBrowseFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Data Storage Location'
      });
      if (selected) {
        setNewDataPath(selected);
        setPathError('');
      }
    } catch (e) {
      setPathError('Failed to open folder picker');
    }
  };

  // Change location handler
  const handleChangeLocation = async () => {
    if (!newDataPath) return;

    setIsChangingPath(true);
    setPathError('');

    try {
      const { join } = await import('@tauri-apps/api/path');
      const { exists, readFile, writeFile } = await import('@tauri-apps/plugin-fs');

      const newDbPath = await join(newDataPath, 'receipt_app.db');

      // Close current connection first to flush WAL
      await closeDb();

      // If migrating, copy existing database using read/write (more reliable than copyFile)
      if (migrateData && currentDataPath) {
        try {
          const sourceExists = await exists(currentDataPath);
          if (sourceExists) {
            // Read the source database as bytes
            const data = await readFile(currentDataPath);
            // Write to the new location
            await writeFile(newDbPath, data);

            // Also copy WAL and SHM files if they exist
            const walPath = currentDataPath + '-wal';
            const shmPath = currentDataPath + '-shm';

            if (await exists(walPath)) {
              const walData = await readFile(walPath);
              await writeFile(newDbPath + '-wal', walData);
            }
            if (await exists(shmPath)) {
              const shmData = await readFile(shmPath);
              await writeFile(newDbPath + '-shm', shmData);
            }
          }
        } catch (copyErr) {
          setPathError(`Could not copy database: ${copyErr.message || copyErr}`);
          setIsChangingPath(false);
          return;
        }
      }

      // Save new path to settings
      await setDbPath(newDbPath);

      // Show restart prompt
      setShowRestartPrompt(true);
    } catch (e) {
      setPathError(`Failed to change location: ${e.message || e}`);
    } finally {
      setIsChangingPath(false);
    }
  };

  if (!show) return null;

  const isTauriEnv = isTauri();

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: isMobile ? '10px' : '20px' }}>
      <div style={{ background: theme.name === 'dark' ? '#1a1a2e' : '#ffffff', padding: isMobile ? '20px' : '30px', borderRadius: '16px', width: isMobile ? '95vw' : '450px', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${theme.border}` }}>
        <h2 style={{ marginBottom: '20px', fontSize: '20px', color: theme.text }}>Business Settings</h2>

        {/* Business Info Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input
            type="text"
            placeholder="Business Name"
            value={businessInfo.name}
            onChange={(e) => onChange({ ...businessInfo, name: e.target.value })}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Address"
            value={businessInfo.address}
            onChange={(e) => onChange({ ...businessInfo, address: e.target.value })}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Phone Number"
            value={businessInfo.phone}
            onChange={(e) => onChange({ ...businessInfo, phone: e.target.value })}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="GSTIN (Optional)"
            value={businessInfo.gstin}
            onChange={(e) => onChange({ ...businessInfo, gstin: e.target.value })}
            style={inputStyle}
          />

          {/* Icon Field */}
          <div>
            <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px', color: theme.text }}>
              Icon (optional)
            </label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="text"
                value={businessInfo.icon || ''}
                onChange={(e) => onChange({ ...businessInfo, icon: e.target.value })}
                placeholder="Emoji or 2 letters"
                maxLength={2}
                style={{ ...inputStyle, width: '100px', textAlign: 'center', fontSize: '18px' }}
              />
              <BusinessIconPreview
                name={businessInfo.name}
                icon={businessInfo.icon}
                theme={theme}
              />
              <span style={{ fontSize: '11px', color: theme.textMuted }}>
                Leave blank to use initials
              </span>
            </div>
          </div>
        </div>

        {/* Data Location Section - Only show in Tauri */}
        {isTauriEnv && (
          <div style={{ marginTop: '25px', paddingTop: '20px', borderTop: `1px solid ${theme.border}` }}>
            <h3 style={{ fontSize: '16px', marginBottom: '15px', color: theme.text }}>Data Location</h3>

            {/* Current location display */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px', color: theme.text }}>
                Current Location
              </label>
              <div style={{
                padding: '10px 12px',
                background: theme.surface,
                borderRadius: '6px',
                fontSize: '12px',
                wordBreak: 'break-all',
                color: theme.textMuted,
                border: `1px solid ${theme.border}`
              }}>
                {currentDataPath || 'Loading...'}
              </div>
            </div>

            {/* Folder picker */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '5px', color: theme.text }}>
                New Location
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={newDataPath}
                  readOnly
                  placeholder="Select a folder..."
                  style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}
                  onClick={handleBrowseFolder}
                />
                <button onClick={handleBrowseFolder} style={{ ...btnSecondary, whiteSpace: 'nowrap' }}>
                  Browse...
                </button>
              </div>
            </div>

            {/* Migration checkbox & button */}
            {newDataPath && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={migrateData}
                      onChange={(e) => setMigrateData(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span style={{ fontSize: '13px', color: theme.text }}>
                      Copy existing data to new location
                    </span>
                  </label>
                </div>

                <button
                  onClick={handleChangeLocation}
                  disabled={isChangingPath}
                  style={{
                    ...btnSecondary,
                    width: '100%',
                    opacity: isChangingPath ? 0.5 : 1,
                    cursor: isChangingPath ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isChangingPath ? 'Changing...' : 'Change Data Location'}
                </button>
              </>
            )}

            {/* Error message */}
            {pathError && (
              <p style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '10px' }}>
                {pathError}
              </p>
            )}
          </div>
        )}

        {/* Save button */}
        <button onClick={onSave} style={{ ...btnPrimary, width: '100%', marginTop: '20px' }}>
          Save & Close
        </button>
      </div>

      {/* Restart Prompt Modal */}
      {showRestartPrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: isMobile ? '10px' : '20px'
        }}>
          <div style={{
            background: theme.name === 'dark' ? '#1a1a2e' : '#ffffff',
            padding: isMobile ? '20px' : '30px',
            borderRadius: '16px',
            width: isMobile ? '95vw' : '350px',
            maxWidth: '350px',
            textAlign: 'center',
            border: `1px solid ${theme.border}`
          }}>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>✅</div>
            <h3 style={{ marginBottom: '10px', fontSize: '18px', color: theme.text }}>Restart Required</h3>
            <p style={{ opacity: 0.7, marginBottom: '20px', fontSize: '14px', color: theme.text }}>
              Data location has been changed. Please restart the app to use the new location.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ ...btnPrimary, width: '100%' }}
            >
              Restart Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessSettingsModal;
