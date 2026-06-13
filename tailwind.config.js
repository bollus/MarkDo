/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './note.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        panel: '18px',
        card: '10px',
        control: '9px'
      },
      colors: {
        primary: '#2563eb',
        'primary-hover': '#1d4ed8',
        ink: '#111827',
        muted: '#64748b',
        line: 'rgba(120, 150, 200, 0.24)',
        neutral: {
          700: '#5a5a5a',
          800: '#424242',
          850: '#363636',
          900: '#2a2a2a'
        }
      },
      boxShadow: {
        glass: 'inset 0 1px 0 rgba(255,255,255,.82), inset 0 -1px 0 rgba(148,163,184,.14)',
        focus: '0 0 0 3px rgba(37,99,235,.12)'
      }
    }
  },
  plugins: []
};
