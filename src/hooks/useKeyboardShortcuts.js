import { useEffect, useCallback } from 'react';

/**
 * Custom hook for global keyboard shortcuts
 * @param {Object} shortcuts - Map of shortcut keys to handlers
 * @param {boolean} enabled - Whether shortcuts are active
 */
export function useKeyboardShortcuts(shortcuts, enabled = true) {
  const handleKeyDown = useCallback((event) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in inputs/textareas
    const target = event.target;
    const isInputFocused =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    // Allow Escape to work even in inputs
    if (event.key === 'Escape' && shortcuts.onEscape) {
      event.preventDefault();
      shortcuts.onEscape();
      return;
    }

    // Skip other shortcuts if input is focused
    if (isInputFocused) return;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifierKey = isMac ? event.metaKey : event.ctrlKey;

    // Ctrl/Cmd + S - Save
    if (modifierKey && event.key === 's') {
      event.preventDefault();
      shortcuts.onSave?.();
      return;
    }

    // Ctrl/Cmd + P - Print
    if (modifierKey && event.key === 'p') {
      event.preventDefault();
      shortcuts.onPrint?.();
      return;
    }

    // Ctrl/Cmd + N - New
    if (modifierKey && event.key === 'n') {
      event.preventDefault();
      shortcuts.onNew?.();
      return;
    }

    // Ctrl/Cmd + D - Download PDF
    if (modifierKey && event.key === 'd') {
      event.preventDefault();
      shortcuts.onDownloadPDF?.();
      return;
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, enabled]);
}

/**
 * Keyboard shortcuts help text for display
 */
export const KEYBOARD_SHORTCUTS = [
  { keys: ['Ctrl', 'S'], mac: ['Cmd', 'S'], action: 'Save receipt' },
  { keys: ['Ctrl', 'P'], mac: ['Cmd', 'P'], action: 'Print receipt' },
  { keys: ['Ctrl', 'N'], mac: ['Cmd', 'N'], action: 'New receipt' },
  { keys: ['Ctrl', 'D'], mac: ['Cmd', 'D'], action: 'Download PDF' },
  { keys: ['Esc'], mac: ['Esc'], action: 'Close modal / Cancel' }
];
