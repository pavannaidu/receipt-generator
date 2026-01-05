import ReceiptPreview from './ReceiptPreview';
import { useTheme, getThemedStyles } from '../contexts/ThemeContext';
import { useIsMobile } from '../hooks/useMediaQuery';

const PrintPreviewModal = ({ show, receipt, businessInfo, onClose, onPrint, onDownloadPDF }) => {
  const { theme } = useTheme();
  const { btnPrimary, btnSecondary } = getThemedStyles(theme);
  const isMobile = useIsMobile();

  if (!show || !receipt) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: isMobile ? '10px' : '20px' }}>
      <div style={{ background: theme.name === 'dark' ? '#1a1a2e' : '#ffffff', borderRadius: '16px', width: isMobile ? '95vw' : '500px', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto', border: `1px solid ${theme.border}` }}>
        <div style={{ padding: isMobile ? '15px' : '20px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', margin: 0, color: theme.text }}>Print Preview</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.text, fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: isMobile ? '15px' : '20px' }}>
          <ReceiptPreview receipt={receipt} businessInfo={businessInfo} />
        </div>
        <div style={{ padding: isMobile ? '15px' : '20px', borderTop: `1px solid ${theme.border}`, display: 'flex', gap: '10px', flexDirection: isMobile ? 'column' : 'row' }}>
          <button onClick={onClose} style={{ ...btnSecondary, flex: 1 }}>Close</button>
          {onDownloadPDF && (
            <button onClick={onDownloadPDF} style={{ ...btnSecondary, flex: 1, background: `${theme.info}20`, color: theme.info }}>PDF</button>
          )}
          <button onClick={onPrint} style={{ ...btnPrimary, flex: 1 }}>Print</button>
        </div>
      </div>
    </div>
  );
};

export default PrintPreviewModal;
