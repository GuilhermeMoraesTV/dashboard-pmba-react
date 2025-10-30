/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Cores Primárias - Tema Militar
        'primary-color': '#dc2626',
        'primary-hover': '#b91c1c',
        'primary-light': '#ef4444',

        // Cores de Fundo
        'background-color': '#0a0a0a',
        'card-background-color': '#1a1a1a',
        'dark-background-color': '#000000',
        'dark-card-background-color': '#0f0f0f',

        // Cores de Texto
        'text-color': '#e5e7eb',
        'heading-color': '#ffffff',
        'subtle-text-color': '#9ca3af',
        'dark-text-color': '#f3f4f6',
        'dark-heading-color': '#ffffff',
        'dark-subtle-text-color': '#6b7280',

        // Cores de Borda
        'border-color': '#1f2937',
        'dark-border-color': '#374151',

        // Cores de Estado
        'success-color': '#10b981',
        'danger-color': '#dc2626',
        'warning-color': '#f59e0b',
        'info-color': '#3b82f6',
      },
      boxShadow: {
        'card-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
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
        'military-gradient': 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
        'military-pattern': 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.05) 10px, rgba(255,255,255,.05) 20px)',
      },
    },
  },
  plugins: [],
}