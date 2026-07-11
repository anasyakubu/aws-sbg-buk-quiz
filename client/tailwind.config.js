/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#16191F', soft: '#232A34', line: '#2E3642' }, // AWS Squid Ink family
        amber: { aws: '#FF9900', dark: '#E68A00' },                    // AWS Orange
        paper: '#FFFFFF',
        fog: '#F5F6F7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(22,25,31,0.06), 0 4px 16px rgba(22,25,31,0.06)',
        lift: '0 2px 4px rgba(22,25,31,0.08), 0 12px 32px rgba(22,25,31,0.10)',
      },
      borderRadius: { card: '14px' },
    },
  },
  plugins: [],
};
