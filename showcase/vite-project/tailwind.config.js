/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          black: '#050505',
          card: '#0a0a0c',
          blue: '#0066FF',
          blueHover: '#0052cc',
          border: 'rgba(255, 255, 255, 0.08)',
          textMuted: '#8e8e93',
          green: '#34c759',
          red: '#ff3b30'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif']
      }
    },
  },
  plugins: [],
}
