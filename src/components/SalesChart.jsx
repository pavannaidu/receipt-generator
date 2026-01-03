import React from 'react';
import { formatIndianCurrency } from '../utils/formatters';
import { formatDate } from '../utils/dateUtils';

const SalesChart = ({ receipts }) => {
  if (!receipts || receipts.length === 0) return null;

  // Group receipts by date and sum totals
  const salesByDate = {};
  receipts.forEach(r => {
    salesByDate[r.date] = (salesByDate[r.date] || 0) + r.total;
  });

  // Sort dates and get data points
  const sortedDates = Object.keys(salesByDate).sort();
  if (sortedDates.length === 0) return null;

  const dataPoints = sortedDates.map(date => ({
    date,
    value: salesByDate[date]
  }));

  const maxValue = Math.max(...dataPoints.map(d => d.value));

  return (
    <div style={{ marginBottom: '20px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
      <h3 style={{ fontSize: '14px', marginBottom: '20px', opacity: 0.8, fontWeight: '500' }}>Sales Trend</h3>

      {/* Bar Chart */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px', paddingBottom: '30px', position: 'relative' }}>
        {dataPoints.map((point, i) => {
          const barHeight = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
                position: 'relative'
              }}
            >
              {/* Value label on top */}
              <div style={{
                fontSize: '11px',
                color: '#4ade80',
                fontWeight: '600',
                marginBottom: '4px',
                whiteSpace: 'nowrap'
              }}>
                {point.value >= 1000 ? `${(point.value / 1000).toFixed(1)}k` : point.value.toFixed(0)}
              </div>

              {/* Bar */}
              <div
                style={{
                  width: '100%',
                  maxWidth: '40px',
                  height: `${Math.max(barHeight, 2)}%`,
                  background: 'linear-gradient(180deg, #4ade80 0%, #22c55e 100%)',
                  borderRadius: '4px 4px 0 0',
                  minHeight: '4px',
                  transition: 'height 0.3s ease'
                }}
              />

              {/* Date label */}
              <div style={{
                position: 'absolute',
                bottom: '-25px',
                fontSize: '10px',
                color: 'rgba(255,255,255,0.5)',
                whiteSpace: 'nowrap',
                transform: dataPoints.length > 5 ? 'rotate(-45deg)' : 'none',
                transformOrigin: 'top center'
              }}>
                {formatDate(point.date).slice(0, 5)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary line */}
      <div style={{
        marginTop: '15px',
        paddingTop: '15px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '12px',
        opacity: 0.7
      }}>
        <span>{dataPoints.length} day{dataPoints.length !== 1 ? 's' : ''}</span>
        <span>Total: ₹{formatIndianCurrency(dataPoints.reduce((sum, d) => sum + d.value, 0))}</span>
      </div>
    </div>
  );
};

export default SalesChart;
