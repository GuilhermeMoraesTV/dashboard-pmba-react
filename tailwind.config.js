import colors from 'tailwindcss/colors';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: colors.neutral[500],
          hover: colors.neutral[600],
          light: colors.neutral[400],
          dark: colors.neutral[700],
        },
        background: {
          light: colors.zinc[100],
          dark: '#0a0a0a', // Fundo sólido conforme identidade visual
        },
        // ATUALIZADO: Cards sem transparência em ambos os temas
        card: {
          light: '#f4f4f5', // Cinza claro no modo light
          dark: '#25282A', // Grafite sólido no modo dark
        },
        border: {
          light: colors.zinc[300],
          dark: '#3b3f42',
        },
        text: {
          DEFAULT: colors.zinc[900],
          'dark-DEFAULT': '#ffffff',
          heading: colors.zinc[950],
          'dark-heading': '#ffffff',
          subtle: colors.zinc[600],
          'dark-subtle': colors.zinc[300],
        },
        'success-color': '#10b981',
        'danger-color': '#ef4444',
        'warning-color': '#f59e0b',
        'info-color': colors.neutral[500],
        'goal-met-both': '#10b981',
        'goal-met-one': '#f59e0b',
        'goal-not-met': '#ef4444',
      },
      boxShadow: {
        'card-shadow': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'military': '0 0 10px rgba(115, 115, 115, 0.3)',
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
        'gradient-primary': 'linear-gradient(135deg, #737373 0%, #525252 100%)',
        'gradient-success': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'gradient-warning': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        'gradient-dark': 'linear-gradient(135deg, #27272a 0%, #18181b 100%)',
      },
    },
  },
  plugins: [],
}
