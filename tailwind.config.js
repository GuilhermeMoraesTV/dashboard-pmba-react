/** @type {import('tailwindcss').Config} */
import colors from 'tailwindcss/colors'; // 1. Importe as cores do Tailwind

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // 2. Isso permite o Light/Dark
  theme: {
    extend: {
      colors: {
        // --- Cores do Tema ---
        // 'primary' será o vermelho militar
        primary: {
          DEFAULT: '#dc2626', // red-600
          hover: '#b91c1c',   // red-700
          light: '#ef4444',   // red-500
        },
        // 3. Cores de fundo (Modo Light e Dark) - Cinza Suave
        background: {
          light: colors.slate[100], // #f1f5f9 (Cinza claro)
          dark: colors.slate[900],   // #0f172a (Cinza escuro "suave")
        },
        // 4. Cores dos "Cards"
        card: {
          light: colors.white,
          dark: colors.slate[800],   // #1e293b (Um pouco mais claro que o fundo)
        },
        // 5. Cores de Borda
        border: {
          light: colors.slate[200], // #e2e8f0
          dark: colors.slate[700],  // #334155
        },
        // 6. Cores de Texto
        text: {
          DEFAULT: colors.slate[800], // Cor principal (light mode)
          'dark-DEFAULT': colors.slate[200], // Cor principal (dark mode)

          heading: colors.slate[900],
          'dark-heading': colors.white,

          subtle: colors.slate[500],
          'dark-subtle': colors.slate[400],
        },

        // Cores de Estado (sem alteração)
        'success-color': '#10b981',
        'danger-color': '#dc2626',
        'warning-color': '#f59e0b',
        'info-color': '#3b82f6',
      },
      // Suas outras extensões (mantidas 100%)
      boxShadow: {
        'card-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', // Sombra mais suave
        'military': '0 0 10px rgba(220, 38, 38, 0.3), 0 0 20px rgba(220, 38, 38, 0.2)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeInFromBottom 0.5s ease-out',
        'slide-in-left': 'slideInFromLeft 0.5s ease-out',
        'slide-in-right': 'slideInFromRight 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeInFromBottom: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInFromLeft: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInFromRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      backgroundImage: {
        // Estes provavelmente não serão mais usados, mas mantidos por segurança
        'military-gradient': 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
        'military-pattern': 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.05) 10px, rgba(255,255,255,.05) 20px)',
      },
    },
  },
  plugins: [],
}