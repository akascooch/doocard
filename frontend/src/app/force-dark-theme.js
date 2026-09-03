// Force Dark Theme Script - Doocard Modern Design
(function() {
  'use strict';
  
  // Force dark theme immediately
  function forceDarkTheme() {
    // Set color scheme
    document.documentElement.style.colorScheme = 'dark';
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    
    // Force body styles
    document.body.style.backgroundColor = '#1C2529';
    document.body.style.color = '#FAFAFA';
    document.body.classList.add('dark', 'force-dark');
    
    // Override any existing styles
    const style = document.createElement('style');
    style.textContent = `
      html, body, #__next {
        background-color: #1C2529 !important;
        color: #FAFAFA !important;
        color-scheme: dark !important;
      }
      
      .bg-white, .bg-gray-50, .bg-gray-100, .bg-slate-50, .bg-zinc-50 {
        background-color: #232D32 !important;
        color: #FAFAFA !important;
      }
      
      .text-gray-900, .text-gray-800, .text-gray-700, .text-black {
        color: #FAFAFA !important;
      }
      
      .bg-blue-500, .bg-blue-600, .bg-indigo-500, .bg-purple-500, .bg-pink-500 {
        background-color: #A1D1B1 !important;
        color: #1C2529 !important;
      }
      
      .text-blue-500, .text-blue-600, .text-indigo-500, .text-purple-500, .text-pink-500 {
        color: #A1D1B1 !important;
      }
      
      button, .btn {
        background-color: #A1D1B1 !important;
        color: #1C2529 !important;
        border-color: #A1D1B1 !important;
      }
      
      input, textarea, select {
        background-color: #2D373C !important;
        color: #FAFAFA !important;
        border-color: #374146 !important;
      }
    `;
    
    document.head.appendChild(style);
    
    // Override any existing theme classes
    document.querySelectorAll('.light').forEach(el => {
      el.classList.remove('light');
      el.classList.add('dark');
    });
    
    // Set meta theme-color
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = '#1C2529';
    
    // Set meta color-scheme
    let metaColorScheme = document.querySelector('meta[name="color-scheme"]');
    if (!metaColorScheme) {
      metaColorScheme = document.createElement('meta');
      metaColorScheme.name = 'color-scheme';
      document.head.appendChild(metaColorScheme);
    }
    metaColorScheme.content = 'dark';
  }
  
  // Run immediately
  forceDarkTheme();
  
  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceDarkTheme);
  } else {
    forceDarkTheme();
  }
  
  // Run when page loads
  window.addEventListener('load', forceDarkTheme);
  
  // Run when page becomes visible (for SPA navigation)
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      setTimeout(forceDarkTheme, 100);
    }
  });
  
  // Override any theme switching functions
  if (window.setTheme) {
    const originalSetTheme = window.setTheme;
    window.setTheme = function(theme) {
      forceDarkTheme();
    };
  }
  
  // Override next-themes if present
  if (window.__NEXT_THEMES__) {
    window.__NEXT_THEMES__.setTheme = function() {
      forceDarkTheme();
    };
  }
  
})();

