import React from 'react';
import { formatIndianCurrency } from '../utils/formatters';
import { formatDate } from '../utils/dateUtils';

const ReceiptPreview = ({ receipt, businessInfo, calculateTotal }) => {
  const itemsTotal = receipt.items.reduce((sum, item) => sum + item.amount, 0);
  const total = receipt.total || (calculateTotal ? calculateTotal(receipt) : itemsTotal);

  return (
    <div style={{ background: 'white', borderRadius: '16px', padding: '25px', color: '#333', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
      <div style={{ textAlign: 'center', marginBottom: '15px', paddingBottom: '15px', borderBottom: '2px solid #333' }}>
        <div style={{ fontSize: '28px', fontWeight: '700', marginBottom: '5px' }}>ba</div>
        <div style={{ fontSize: '14px', fontWeight: '600', letterSpacing: '1px' }}>{businessInfo.name}</div>
        {businessInfo.address && <div style={{ fontSize: '11px', color: '#666' }}>{businessInfo.address}</div>}
        {businessInfo.phone && <div style={{ fontSize: '11px', color: '#666' }}>Ph: {businessInfo.phone}</div>}
        {businessInfo.gstin && <div style={{ fontSize: '11px', color: '#666' }}>GSTIN: {businessInfo.gstin}</div>}
        <div style={{ fontSize: '12px', textDecoration: 'underline', marginTop: '8px' }}>ESTIMATE</div>
      </div>
      <div style={{ fontSize: '12px', marginBottom: '15px' }}>
        <div style={{ marginBottom: '5px' }}><strong>To:</strong> {receipt.customerName || 'Customer Name'}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><strong>Bill Date:</strong> {formatDate(receipt.date)}</span>
          <span><strong>Bill No:</strong> {receipt.billNo}</span>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '15px' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid #333' }}>Particulars</th>
            <th style={{ padding: '6px', textAlign: 'right', borderBottom: '1px solid #333' }}>Qty</th>
            <th style={{ padding: '6px', textAlign: 'right', borderBottom: '1px solid #333' }}>Rate</th>
            <th style={{ padding: '6px', textAlign: 'right', borderBottom: '1px solid #333' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.length === 0 ? (
            <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>No items added</td></tr>
          ) : receipt.items.map((item, idx) => (
            <tr key={item.id || idx}>
              <td style={{ padding: '5px', borderBottom: '1px solid #eee' }}>{item.name}</td>
              <td style={{ padding: '5px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatIndianCurrency(item.qty)}</td>
              <td style={{ padding: '5px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatIndianCurrency(item.rate)}</td>
              <td style={{ padding: '5px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatIndianCurrency(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ borderTop: '2px solid #333', paddingTop: '10px', fontSize: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span>Bill Total</span><span>{formatIndianCurrency(itemsTotal)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span>Others</span><span>{formatIndianCurrency(receipt.others)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span>Round Off</span><span>{formatIndianCurrency(receipt.roundOff)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '14px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #333' }}><span>Net Amount</span><span>₹ {formatIndianCurrency(total)}</span></div>
      </div>
    </div>
  );
};

export default ReceiptPreview;
