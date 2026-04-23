import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class', 'media'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"DM Mono"', '"JetBrains Mono"', '"Fira Code"', '"SF Mono"', 'monospace'],
      },
      colors: {
        // Databricks brand — Lava (primary accent)
        lava: {
          50: '#FFF1F0',
          100: '#FFE0DD',
          200: '#FFC2BB',
          300: '#FF9E94',
          400: '#FF7B6D',
          500: '#FF5F46',
          600: '#FF3621',
          700: '#BD2B26',
          800: '#8C1F1B',
          900: '#5C1412',
        },
        // Databricks brand — Navy (dark backgrounds)
        navy: {
          700: '#243F4A',
          800: '#1B3139',
          900: '#0B2026',
        },
        // Databricks brand — Oat (light backgrounds)
        oat: {
          light: '#F9F7F4',
          DEFAULT: '#F2EDE7',
          medium: '#E5DDD3',
        },
        // Databricks brand — semantic
        semantic: {
          success: '#00A972',
          warning: '#FFAB00',
          error: '#BD2B26',
          info: '#2272B4',
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
