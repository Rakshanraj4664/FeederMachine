import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        panel: '0 20px 80px rgba(0, 0, 0, 0.45), inset 0 0 1px rgba(140, 255, 255, 0.1)',
        glow: '0 0 40px rgba(34, 211, 238, 0.18)',
      },
      backgroundImage: {
        'panel-grid': 'radial-gradient(circle at top left, rgba(34, 211, 238, 0.12), transparent 25%), radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.12), transparent 20%)',
      },
      colors: {
        neon: {
          500: '#00f0ff',
          600: '#00c8ff',
          700: '#0ca8f7',
        },
      },
      borderRadius: {
        'panel': '2rem',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
