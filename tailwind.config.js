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
        // Nossa cor de destaque (Vermelho Sutil)
        accent: {
          DEFAULT: colors.red[500],
          hover: colors.red[600],
          light: colors.red[400],
          soft: 'rgba(239, 68, 68, 0.1)', // Vermelho bem clarinho para fundos
        },
        // Escala de Cinzas Profissionais (Zinco)
        gray: colors.zinc,

        // Cores Semânticas
        background: {
          light: '#f4f4f5', // Zinc-100
          dark: '#09090b',  // Zinc-950 (Cinza muito escuro, não preto)
        },
        card: {
          light: '#ffffff',
          dark: '#18181b',  // Zinc-900
        },
        border: {
          light: colors.zinc[200],
          dark: colors.zinc[800],
        },
        text: {
          primary: colors.zinc[900],
          secondary: colors.zinc[500],
          dark: {
            primary: colors.zinc[50],
            secondary: colors.zinc[400],
          }
        },

        // Mantendo compatibilidade com seu código existente
        primary: {
          DEFAULT: colors.zinc[800], // Botões principais agora são cinza escuro no light
          hover: colors.zinc[900],
          light: colors.zinc[400],
          dark: colors.zinc[200],    // No dark mode, primary vira claro
        },
        'success-color': '#10b981', // Emerald
        'danger-color': '#ef4444',  // Red
        'warning-color': '#f59e0b', // Amber

        // Cores do Gráfico de 14 dias
        'goal-met-both': '#10b981', // Verde
        'goal-met-one': '#f59e0b',  // Laranja
        'goal-not-met': '#ef4444',  // Vermelho
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'glow': '0 0 15px rgba(239, 68, 68, 0.15)', // Brilho vermelho sutil
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}