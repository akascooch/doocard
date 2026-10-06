/**
 * DEPRECATED — DO NOT IMPORT.
 * Previously forced data-theme=dark and non-palette inline colors on every load.
 * The function is now a no-op and must not set color-scheme, data-theme, or colors.
 * Live theme: next-themes in src/components/providers.tsx.
 */
function forceDarkTheme() {}

if (typeof window !== 'undefined') {
  window.forceDarkTheme = forceDarkTheme
}
