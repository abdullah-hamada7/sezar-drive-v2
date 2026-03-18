/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#F7F3EB', /* Cashmere/Bone */
          secondary: '#FFFFFF',
          tertiary: '#EAE5D9',
          card: '#FFFFFF',
          hover: '#F0EBE1',
          input: '#FFFFFF',
          inverse: '#141311',
        },
        primary: {
          DEFAULT: '#D46340', /* Terracotta */
          light: '#E27D5F',
          dark: '#B54D2E',
          50: '#FDF3F0',
          100: '#FBE4DD',
          900: '#522013',
        },
        accent: {
          olive: '#4A5D4E', /* Muted Olive */
          gold: '#C5A880',
        },
        surface: 'rgba(255, 255, 255, 0.95)',
        text: {
          DEFAULT: '#141311', /* Deep Charcoal */
          secondary: '#4A4843',
          muted: '#8A867D',
          inverse: '#F7F3EB',
        },
        success: '#4A5D4E',
        danger: '#A83232',
        warning: '#D49540',
        info: '#3B6882',
        border: '#E8E2D5',
        'border-light': '#F2EFE8',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['"Outfit"', 'sans-serif'],
        sans: ['"Outfit"', 'sans-serif'],
      },
      borderRadius: {
        none: '0',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        full: '9999px',
      },
      spacing: {
        '4xs': '0.125rem',
        '3xs': '0.25rem',
        '2xs': '0.375rem',
        xs: '0.5rem',
        sm: '0.75rem',
        md: '1rem',
        lg: '1.25rem',
        xl: '1.5rem',
        '2xl': '2rem',
        '3xl': '3rem',
        '4xl': '4rem',
      },
      boxShadow: {
        soft: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        highlight: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
        glow: '0 0 15px rgba(17, 17, 17, 0.35)',
      },
      backdropBlur: {
        xs: '2px',
      },
      transitionDuration: {
        fast: '100ms',
        base: '200ms',
      }
    },
  },
  plugins: [],
}
