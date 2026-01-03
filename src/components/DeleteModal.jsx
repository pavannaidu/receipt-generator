import React from 'react';
import { btnPrimary, btnSecondary } from '../styles/theme';

const DeleteModal = ({ show, isEntry, onCancel, onConfirm }) => {
  if (!show) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1a1a2e', padding: '30px', borderRadius: '16px', width: '400px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '15px' }}>🗑️</div>
        <h2 style={{ marginBottom: '10px', fontSize: '20px', color: 'white' }}>Delete {isEntry ? 'Entry' : 'Receipt'}?</h2>
        <p style={{ opacity: 0.7, marginBottom: '25px', fontSize: '14px', color: 'white' }}>This action cannot be undone.</p>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button onClick={onCancel} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
          <button onClick={onConfirm} style={{ ...btnPrimary, flex: 1 }}>Delete</button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
