// Force theme injection for immediate effect
export function injectThemeOverrides() {
  if (typeof window === 'undefined') return;

  // Create a style element with ultra-aggressive overrides
  const style = document.createElement('style');
  style.id = 'force-theme-overrides';
  style.textContent = `
    /* Ultra-aggressive theme overrides */
    *, *::before, *::after {
      color: #A1D1B1 !important;
    }
    
    body, html {
      background-color: #1C2529 !important;
      color: #A1D1B1 !important;
    }
    
    h1, h2, h3, h4, h5, h6, p, span, div, a, button, input, textarea, select, label, li, td, th {
      color: #A1D1B1 !important;
    }
    
    /* Override all problematic text classes */
    .text-gray-900, .text-gray-800, .text-gray-700, .text-gray-600, .text-gray-500, 
    .text-gray-400, .text-gray-300, .text-gray-200, .text-gray-100, .text-gray-50,
    .text-neutral-900, .text-neutral-800, .text-neutral-700, .text-neutral-600, .text-neutral-500,
    .text-neutral-400, .text-neutral-300, .text-neutral-200, .text-neutral-100, .text-neutral-50,
    .text-slate-900, .text-slate-800, .text-slate-700, .text-slate-600, .text-slate-500,
    .text-slate-400, .text-slate-300, .text-slate-200, .text-slate-100, .text-slate-50,
    .text-zinc-900, .text-zinc-800, .text-zinc-700, .text-zinc-600, .text-zinc-500,
    .text-zinc-400, .text-zinc-300, .text-zinc-200, .text-zinc-100, .text-zinc-50,
    .text-stone-900, .text-stone-800, .text-stone-700, .text-stone-600, .text-stone-500,
    .text-stone-400, .text-stone-300, .text-stone-200, .text-stone-100, .text-stone-50,
    .text-muted-foreground, .text-foreground, .text-primary-foreground, .text-secondary-foreground {
      color: #A1D1B1 !important;
    }
    
    /* Override all problematic background classes */
    .bg-gray-900, .bg-gray-800, .bg-gray-700, .bg-gray-600, .bg-gray-500,
    .bg-gray-400, .bg-gray-300, .bg-gray-200, .bg-gray-100, .bg-gray-50,
    .bg-neutral-900, .bg-neutral-800, .bg-neutral-700, .bg-neutral-600, .bg-neutral-500,
    .bg-neutral-400, .bg-neutral-300, .bg-neutral-200, .bg-neutral-100, .bg-neutral-50,
    .bg-slate-900, .bg-slate-800, .bg-slate-700, .bg-slate-600, .bg-slate-500,
    .bg-slate-400, .bg-slate-300, .bg-slate-200, .bg-slate-100, .bg-slate-50,
    .bg-zinc-900, .bg-zinc-800, .bg-zinc-700, .bg-zinc-600, .bg-zinc-500,
    .bg-zinc-400, .bg-zinc-300, .bg-zinc-200, .bg-zinc-100, .bg-zinc-50,
    .bg-stone-900, .bg-stone-800, .bg-stone-700, .bg-stone-600, .bg-stone-500,
    .bg-stone-400, .bg-stone-300, .bg-stone-200, .bg-stone-100, .bg-stone-50,
    .bg-background, .bg-muted, .bg-primary, .bg-secondary, .bg-card {
      background-color: #1C2529 !important;
      color: #A1D1B1 !important;
    }
    
    /* Placeholder text */
    ::placeholder {
      color: rgba(161, 209, 177, 0.6) !important;
    }
    
    /* Input and form elements */
    input, textarea, select {
      background-color: #1C2529 !important;
      border: 1px solid rgba(161, 209, 177, 0.3) !important;
      color: #A1D1B1 !important;
    }
    
    /* Buttons */
    button {
      background-color: #A1D1B1 !important;
      color: #1C2529 !important;
      border: none !important;
    }
    
    /* Cards and containers */
    .card, .panel, .box, .container, .sidebar {
      background-color: #1C2529 !important;
      color: #A1D1B1 !important;
      border: 1px solid rgba(161, 209, 177, 0.1) !important;
    }
  `;
  
  // Remove existing override if any
  const existingStyle = document.getElementById('force-theme-overrides');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  // Inject the new style
  document.head.appendChild(style);
}

// Auto-inject on page load
if (typeof window !== 'undefined') {
  injectThemeOverrides();
  
  // Also inject on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', injectThemeOverrides);
  
  // Re-inject after any dynamic content changes
  const observer = new MutationObserver(() => {
    injectThemeOverrides();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });
}
