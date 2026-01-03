// Theme constants and reusable styles

export const colors = {
  primary: '#e94560',
  primaryGradient: 'linear-gradient(135deg, #e94560, #ff6b6b)',
  success: '#4ade80',
  successGradient: 'linear-gradient(135deg, #4ade80, #22c55e)',
  warning: '#ff9f43',
  danger: '#ff6b6b',
  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  cardBg: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.1)',
  borderLight: 'rgba(255,255,255,0.05)',
  text: '#e8e8e8',
  textMuted: 'rgba(255,255,255,0.7)',
};

export const inputStyle = {
  width: '100%',
  padding: '12px 15px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.05)',
  color: 'white',
  fontSize: '14px',
};

export const btnPrimary = {
  background: 'linear-gradient(135deg, #e94560, #ff6b6b)',
  border: 'none',
  color: 'white',
  padding: '12px 20px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600',
};

export const btnSecondary = {
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)',
  color: 'white',
  padding: '12px 20px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '14px',
};

export const btnSmall = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '6px 10px',
  borderRadius: '6px',
  fontSize: '12px',
};

export const cardStyle = {
  background: 'rgba(255,255,255,0.05)',
  borderRadius: '16px',
  padding: '25px',
  border: '1px solid rgba(255,255,255,0.1)',
};

export const tabStyle = {
  active: {
    background: 'linear-gradient(135deg, #e94560, #ff6b6b)',
    color: 'white',
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  inactive: {
    background: 'transparent',
    color: '#a0a0a0',
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
  },
};
