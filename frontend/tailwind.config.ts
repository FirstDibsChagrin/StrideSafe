import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          orange: '#f97316',
          green: '#22c55e',
          red: '#ef4444',
          amber: '#f59e0b',
          violet: '#a78bfa',
        },
        bg: {
          base: '#07070f',
          card: '#0e0e1c',
          elevated: '#141426',
        },
        border: {
          DEFAULT: '#1c1c30',
          subtle: '#141420',
        },
      },
      animation: {
        'spin': 'spin 0.8s linear infinite',
      },
    },
  },
  plugins: [],
}
export default config
