import React from 'react';
import ReceiptPreview from './ReceiptPreview';
import { btnPrimary, btnSecondary } from '../styles/theme';

const PrintPreviewModal = ({ show, receipt, businessInfo, onClose, onPrint }) => {
  if (!show || !receipt) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: '#1a1a2e', borderRadius: '16px', width: '500px', maxHeight: '90vh', overflow: 'auto', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', margin: 0, color: 'white' }}>Print Preview</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '20px' }}>
          <ReceiptPreview receipt={receipt} businessInfo={businessInfo} />
        </div>
        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '15px' }}>
          <button onClick={onClose} style={{ ...btnSecondary, flex: 1 }}>Close</button>
          <button onClick={onPrint} style={{ ...btnPrimary, flex: 1 }}>Print</button>
        </div>
      </div>
    </div>
  );
};

export default PrintPreviewModal;
