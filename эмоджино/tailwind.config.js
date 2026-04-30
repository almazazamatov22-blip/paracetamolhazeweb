/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#08080d',
        card: '#111119',
        card2: '#16161f',
        border: '#1e1e2e',
        text: '#eaeaf0',
        muted: '#6b6b80',
        accent: '#f59e0b',
        accent2: '#fbbf24',
        ok: '#10b981',
        err: '#ef4444',
        film: '#06b6d4',
        serial: '#f43f5e',
        purple: '#9146ff',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
    },
  },
  plugins: [],
}