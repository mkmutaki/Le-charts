
/**
 * Theme utilities for managing dark/light mode
 */

// Initialize theme based on localStorage or system preference
export const initializeTheme = (): void => {
  // If theme is explicitly set to dark, use it
  if (localStorage.theme === 'dark') {
    document.documentElement.classList.add('dark');
    return;
  }
  
  // If theme is explicitly set to light or not set, remove dark class
  document.documentElement.classList.remove('dark');
};

// Toggle between light and dark mode
export const toggleTheme = (): void => {
  if (document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.remove('dark');
    localStorage.theme = 'light';
  } else {
    document.documentElement.classList.add('dark');
    localStorage.theme = 'dark';
  }
};

// Get current theme
export const getCurrentTheme = (): 'dark' | 'light' => {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};
