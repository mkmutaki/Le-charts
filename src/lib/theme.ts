
/**
 * Theme utilities for managing dark/light mode
 */

// Initialize theme based on localStorage or system preference, defaulting to dark mode
export const initializeTheme = (): void => {
  // If theme is explicitly set to light in localStorage, use it
  if (localStorage.theme === 'light') {
    document.documentElement.classList.remove('dark');
    return;
  }
  
  // For any other case (theme is 'dark' or not set), use dark mode
  document.documentElement.classList.add('dark');
  localStorage.theme = 'dark';
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
