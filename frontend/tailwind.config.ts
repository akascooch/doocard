import type { Config } from "tailwindcss"
import { fontFamily } from "tailwindcss/defaultTheme"

const config = {
  future: {
    respectDefaultRingColorOpacity: true,
  },
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '!./src/**/*.spec.{ts,tsx}',
    '!./src/**/__tests__/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "2rem",
        lg: "4rem",
        xl: "5rem",
        "2xl": "6rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px",
      },
    },
    extend: {
      // Doocard Brand Colors
      colors: {
        brand: {
          grey: {
            DEFAULT: '#8D99AE',
            light: '#EDF2F4',
            dark: '#2B2D42',
            50: '#EDF2F4',
            100: '#EDF2F4',
            200: '#EDF2F4',
            300: '#8D99AE',
            400: '#8D99AE',
            500: '#8D99AE',
            600: '#2B2D42',
            700: '#2B2D42',
            800: '#2B2D42',
            900: '#2B2D42',
          },
          green: {
            DEFAULT: '#2B2D42',
            light: '#8D99AE',
            dark: '#2B2D42',
            50: '#EDF2F4',
            100: '#EDF2F4',
            200: '#8D99AE',
            300: '#8D99AE',
            400: '#8D99AE',
            500: '#2B2D42',
            600: '#2B2D42',
            700: '#2B2D42',
            800: '#2B2D42',
            900: '#2B2D42',
          },
          dark: '#2B2D42',
          light: '#EDF2F4',
        },
        
        // Semantic colors using CSS variables
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        error: 'hsl(var(--error))',
        chart: {
          2: 'hsl(var(--chart-2))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Preflight reads gray.200 (default border) and gray.400 (placeholder).
        // Point only those two shades at palette tokens so the bundle does not emit Tailwind gray.
        gray: {
          200: 'hsl(var(--border))',
          400: 'hsl(var(--card-foreground))',
        },
      },
      borderColor: {
        DEFAULT: 'hsl(var(--border))',
      },
      ringColor: {
        DEFAULT: 'hsl(var(--ring))',
      },
      ringOffsetColor: {
        DEFAULT: 'hsl(var(--background))',
      },
      
      // Border Radius
      borderRadius: {
        xl: '1rem',      // 16px
        '2xl': '1.25rem', // 20px
        '3xl': '1.5rem',  // 24px
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      
      // Spacing (using 4px base)
      spacing: {
        '4.5': '1.125rem',  // 18px
        '5.5': '1.375rem',  // 22px
        '13': '3.25rem',    // 52px
        '15': '3.75rem',    // 60px
        '17': '4.25rem',    // 68px
        '18': '4.5rem',     // 72px
        '22': '5.5rem',     // 88px
        '26': '6.5rem',     // 104px
        '30': '7.5rem',     // 120px
      },
      
      // Typography
      fontFamily: {
        sans: ["Inter", "Vazirmatn", ...fontFamily.sans],
        display: ["Inter", ...fontFamily.sans],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      
      // Box Shadow
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        'glow': '0 0 20px rgb(43 45 66 / 0.28)',
      },
      
      // Animations
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "slide-in-from-top": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-in-from-bottom": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-in-from-left": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-in-from-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "scale-out": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(0.95)", opacity: "0" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.26s cubic-bezier(0.16, 0.84, 0.24, 1)",
        "fade-out": "fade-out 0.26s cubic-bezier(0.16, 0.84, 0.24, 1)",
        "slide-in-from-top": "slide-in-from-top 0.42s cubic-bezier(0.16, 0.84, 0.24, 1)",
        "slide-in-from-bottom": "slide-in-from-bottom 0.42s cubic-bezier(0.16, 0.84, 0.24, 1)",
        "slide-in-from-left": "slide-in-from-left 0.42s cubic-bezier(0.16, 0.84, 0.24, 1)",
        "slide-in-from-right": "slide-in-from-right 0.42s cubic-bezier(0.16, 0.84, 0.24, 1)",
        "scale-in": "scale-in 0.26s cubic-bezier(0.16, 0.84, 0.24, 1)",
        "scale-out": "scale-out 0.26s cubic-bezier(0.16, 0.84, 0.24, 1)",
        "spin-slow": "spin-slow 3s linear infinite",
        "bounce-subtle": "bounce-subtle 2s ease-in-out infinite",
        "pulse-subtle": "pulse-subtle 2s ease-in-out infinite",
      },
      
      // Transition durations
      transitionDuration: {
        xs: '120ms',
        md: '260ms',
        lg: '420ms',
      },
      
      // Transition timing functions
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.16, 0.84, 0.24, 1)',
      },
      
      // Z-index scale
      zIndex: {
        '1': '1',
        '2': '2',
        '3': '3',
        '4': '4',
        '5': '5',
        '10': '10',
        '20': '20',
        '30': '30',
        '40': '40',
        '50': '50',
        'dropdown': '1000',
        'sticky': '1020',
        'fixed': '1030',
        'modal-backdrop': '1040',
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
