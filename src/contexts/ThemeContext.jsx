import { createContext, useContext, useState, useEffect } from 'react';

const THEME_STORAGE_KEY = 'receiptApp_theme';

// Theme definitions
export const themes = {
  dark: {
    name: 'dark',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    surface: 'rgba(255,255,255,0.03)',
    surfaceHover: 'rgba(255,255,255,0.05)',
    surfaceActive: 'rgba(255,255,255,0.08)',
    text: '#e8e8e8',
    textSecondary: 'rgba(255,255,255,0.7)',
    textMuted: 'rgba(255,255,255,0.5)',
    border: 'rgba(255,255,255,0.1)',
    borderLight: 'rgba(255,255,255,0.05)',
    inputBg: 'rgba(255,255,255,0.05)',
    headerBg: 'rgba(0,0,0,0.3)',
    accent: '#e94560',
    accentHover: '#ff6b6b',
    success: '#4ade80',
    warning: '#ff9f43',
    danger: '#ff6b6b',
    info: '#60a5fa'
  },
  light: {
    name: 'light',
    background: 'linear-gradient(135deg, #f5f5f5 0%, #eeeeee 50%, #e8e8e8 100%)',
    surface: '#ffffff',
    surfaceHover: '#ffffff',
    surfaceActive: '#ffffff',
    text: '#1a1a1a',
    textSecondary: '#525252',
    textMuted: '#a3a3a3',
    border: 'rgba(0,0,0,0.12)',
    borderLight: 'rgba(0,0,0,0.06)',
    inputBg: '#ffffff',
    inputBorder: 'rgba(0,0,0,0.15)',
    headerBg: 'rgba(255,255,255,0.95)',
    shadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
    accent: '#4f46e5',
    accentHover: '#4338ca',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    info: '#0284c7'
  }
};

// Create context
const ThemeContext = createContext(null);

// Provider component
export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved && themes[saved]) return saved;
      // Check system preference
      if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    }
    return 'dark';
  });

  const theme = themes[themeName];

  // Persist theme preference
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeName);
  }, [themeName]);

  const toggleTheme = () => {
    setThemeName(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const setTheme = (name) => {
    if (themes[name]) {
      setThemeName(name);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, themeName, toggleTheme, setTheme, isDark: themeName === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to use theme
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Generate themed styles
export function getThemedStyles(theme) {
  return {
    inputStyle: {
      width: '100%',
      padding: '12px 15px',
      background: theme.inputBg,
      border: `1px solid ${theme.border}`,
      borderRadius: '10px',
      color: theme.text,
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s, box-shadow 0.2s'
    },
    btnPrimary: {
      background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover})`,
      border: 'none',
      borderRadius: '10px',
      padding: '12px 25px',
      color: 'white',
      fontWeight: '600',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'transform 0.2s, box-shadow 0.2s'
    },
    btnSecondary: {
      background: theme.surface,
      border: `1px solid ${theme.border}`,
      borderRadius: '10px',
      padding: '12px 25px',
      color: theme.text,
      fontWeight: '500',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'background 0.2s'
    },
    cardStyle: {
      background: theme.surface,
      borderRadius: '16px',
      padding: '25px',
      border: `1px solid ${theme.border}`,
      boxShadow: theme.shadow || 'none'
    }
  };
}
