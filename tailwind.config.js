/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter var', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
        display: ['Plus Jakarta Sans', 'Inter var', 'system-ui', 'sans-serif'],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: 'var(--tw-prose-body)',
            fontSize: '0.9375rem',
            lineHeight: '1.6',
            p: {
              marginTop: '1em',
              marginBottom: '1em',
            },
            '[class~="lead"]': {
              fontSize: '1.125em',
              lineHeight: '1.6',
              marginTop: '1em',
              marginBottom: '1em',
            },
            h1: {
              fontFamily: 'Plus Jakarta Sans, Inter var, system-ui, sans-serif',
              fontWeight: '600',
              fontSize: '1.875rem',
              marginTop: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '1.2',
            },
            h2: {
              fontFamily: 'Plus Jakarta Sans, Inter var, system-ui, sans-serif',
              fontWeight: '600',
              fontSize: '1.5rem',
              marginTop: '2rem',
              marginBottom: '0.75rem',
              lineHeight: '1.3',
            },
            h3: {
              fontFamily: 'Plus Jakarta Sans, Inter var, system-ui, sans-serif',
              fontWeight: '600',
              fontSize: '1.25rem',
              marginTop: '1.5rem',
              marginBottom: '0.75rem',
              lineHeight: '1.4',
            },
            code: {
              fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
              fontWeight: '400',
              fontSize: '0.875em',
            },
          },
        },
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'ripple': {
          '0%': {
            transform: 'scale(1)',
            opacity: '1'
          },
          '100%': {
            transform: 'scale(2)',
            opacity: '0'
          }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'ripple': 'ripple 2s infinite'
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
