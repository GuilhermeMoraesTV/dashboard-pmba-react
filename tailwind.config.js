export default {
  // 1. Diga ao Tailwind onde encontrar seus arquivos
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  // 3. Habilite o dark mode baseado em classe (o seu .dark-mode)
  darkMode: 'class',

  theme: {
    extend: {
      // 4. Adicione sua fonte 'Poppins'
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },

      // 2. Mapeie TODAS as suas cores do :root
      colors: {
        'primary-color': '#3498db',
        'secondary-color': '#2c3e50',
        'background-color': '#f4f6f9',
        'card-background-color': '#ffffff',
        'text-color': '#34495e',
        'heading-color': '#2c3e50',
        'subtle-text-color': '#7f8c8d',
        'success-color': '#27ae60',
        'danger-color': '#c0392b',
        'warning-color': '#f39c12',
        'excellent-color': '#08F7FE',
        'border-color': '#e4e7ea',
        'goal-met-both': '#2ecc71',
        'goal-met-one': '#f1c40f',
        'goal-not-met': '#e74c3c',

        // Cores do Dark Mode
        'dark': {
          'primary-color': '#3498db',
          'secondary-color': '#3B597C',
          'background-color': '#2c3e50',
          'card-background-color': '#34495e',
          'text-color': '#ecf0f1',
          'heading-color': '#ffffff',
          'subtle-text-color': '#95a5a6',
          'border-color': '#46607e',
          'goal-met-both': '#27ae60',
          'goal-met-one': '#f39c12',
          'goal-not-met': '#c0392b',
        }
      },
      // Mapeie sua sombra (pode ajustar 'md' para 'lg' se preferir)
      boxShadow: {
        'card-shadow': '0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)',
      }
    },
  },
  plugins: [],
}