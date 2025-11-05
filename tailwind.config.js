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
        // ATUALIZADO: 'primary' usa 'neutral' (cinza puro)
        primary: {
          DEFAULT: colors.neutral[500],
          hover: colors.neutral[600],
          light: colors.neutral[400],
          dark: colors.neutral[700],
        },
        // ATUALIZADO: Paleta de 'background' trocada de 'slate' (azul) para 'zinc' (cinza)
        background: {
          light: colors.zinc[100], // era '#f1f5f9'
          dark: colors.zinc[900],  // era '#0f172a'
        },
        // ATUALIZADO: Paleta de 'card' trocada de 'slate' para 'zinc'
        card: {
          light: '#ffffff',
          dark: colors.zinc[800], // era '#1e293b'
        },
        // ATUALIZADO: Paleta de 'border' trocada de 'slate' para 'zinc'
        border: {
          light: colors.zinc[300], // era '#d1d5db'
          dark: colors.zinc[700],  // era '#334155'
        },
        // ATUALIZADO: Paleta de 'text' trocada de 'slate' para 'zinc'
        text: {
          DEFAULT: colors.zinc[800],       // era '#1e293b'
          'dark-DEFAULT': colors.zinc[100], // era '#f1f5f9'
          heading: colors.zinc[900],       // era '#0f172a'
          'dark-heading': '#ffffff',
          subtle: colors.zinc[500],        // era '#64748b'
          'dark-subtle': colors.zinc[400], // era '#94a3b8'
        },
        'success-color': '#10b981',
        'danger-color': '#ef4444',
        'warning-color': '#f59e0b',
        // ATUALIZADO: 'info-color' usa 'neutral' (cinza)
        'info-color': colors.neutral[500], // era '#3b82f6'
        'goal-met-both': '#10b981',
        'goal-met-one': '#f59e0b',
        'goal-not-met': '#ef4444',
      },
      boxShadow: {
        'card-shadow': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        // ATUALIZADO: 'military' usa sombra 'neutral' (cinza)
        // (rgb(115, 115, 115) é o 'neutral-500')
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
        // ATUALIZADO: 'gradient-primary' usa 'neutral' (cinza)
        // ('#737373' é neutral-500, '#525252' é neutral-600)
        'gradient-primary': 'linear-gradient(135deg, #737373 0%, #525252 100%)',
        'gradient-success': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'gradient-warning': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        // ATUALIZADO: 'gradient-dark' usa 'zinc' (cinza)
        'gradient-dark': 'linear-gradient(135deg, #27272a 0%, #18181b 100%)', // era 'slate'
      },
    },
  },
  plugins: [],
}