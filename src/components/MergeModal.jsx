import React from 'react';
import { btnPrimary, btnSecondary } from '../styles/theme';

const MergeModal = ({ show, mergeData, onCancel, onConfirm }) => {
  if (!show) return null;

  const { oldName, targetName, oldEntries, targetEntries } = mergeData;

  const oldTotal = oldEntries.reduce((sum, e) => sum + e.remaining, 0);
  const targetTotal = targetEntries.reduce((sum, e) => sum + e.remaining, 0);
  const combinedTotal = oldTotal + targetTotal;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#1a1a2e',
        padding: '30px',
        borderRadius: '16px',
        width: '450px',
        maxHeight: '80vh',
        overflowY: 'auto',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h2 style={{ marginBottom: '10px', fontSize: '18px', color: 'white', textAlign: 'center' }}>
          Merge Items?
        </h2>

        <p style={{ opacity: 0.7, marginBottom: '20px', fontSize: '14px', color: 'white', textAlign: 'center' }}>
          An item named "<strong>{targetName}</strong>" already exists. Would you like to merge all stock entries?
        </p>

        {/* Summary comparison */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: '15px',
          marginBottom: '20px',
          alignItems: 'start'
        }}>
          {/* Old item summary */}
          <div style={{
            padding: '15px',
            background: 'rgba(255,107,107,0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(255,107,107,0.2)'
          }}>
            <p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '6px', color: 'white' }}>Source</p>
            <p style={{ fontWeight: '600', marginBottom: '8px', color: '#ff6b6b', fontSize: '14px', wordBreak: 'break-word' }}>{oldName}</p>
            <p style={{ fontSize: '12px', color: 'white' }}>{oldEntries.length} entries</p>
            <p style={{ fontSize: '12px', color: 'white' }}>{oldTotal} units</p>
          </div>

          {/* Arrow */}
          <div style={{ alignSelf: 'center', fontSize: '20px', opacity: 0.5, color: 'white' }}>→</div>

          {/* Target item summary */}
          <div style={{
            padding: '15px',
            background: 'rgba(74,222,128,0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(74,222,128,0.2)'
          }}>
            <p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '6px', color: 'white' }}>Target</p>
            <p style={{ fontWeight: '600', marginBottom: '8px', color: '#4ade80', fontSize: '14px', wordBreak: 'break-word' }}>{targetName}</p>
            <p style={{ fontSize: '12px', color: 'white' }}>{targetEntries.length} entries</p>
            <p style={{ fontSize: '12px', color: 'white' }}>{targetTotal} units</p>
          </div>
        </div>

        {/* Result preview */}
        <div style={{
          padding: '15px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '6px', color: 'white' }}>After Merge</p>
          <p style={{ fontSize: '16px', fontWeight: '600', color: '#4ade80' }}>
            {combinedTotal} units in {oldEntries.length + targetEntries.length} entries
          </p>
          <p style={{ fontSize: '11px', opacity: 0.6, marginTop: '6px', color: 'white' }}>
            Target's selling price will be preserved
          </p>
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <button onClick={onCancel} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
          <button onClick={onConfirm} style={{ ...btnPrimary, flex: 1, background: 'linear-gradient(135deg, #4ade80, #22c55e)' }}>
            Merge Items
          </button>
        </div>
      </div>
    </div>
  );
};

export default MergeModal;
