/** Tokens extraídos dos frames do Figma "Frontend Challenge" (Kurio). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Roboto Mono"', 'ui-monospace', 'monospace'], mono: ['"Roboto Mono"', 'ui-monospace', 'monospace'] },
      colors: {
        bg: '#140D0A',        // fundo da página
        surface: '#241612',   // cards, sidebar, modais
        band: '#38220F',      // faixa do rodapé
        line: '#432C1B',      // divisórias
        field: '#3F2319',     // borda de campos
        accent: '#D28A4C',    // botões e destaques
        price: '#E89B55',     // preços e links ativos
        ink: '#F5F1EB',       // texto principal
        muted: '#CFB28C',     // texto secundário
        hint: '#B39463',      // placeholder e preço riscado
        required: '#F0805F',  // asterisco de obrigatório
        danger: '#FF8A7A', success: '#7FD49B', warn: '#F2C14E',
      },
      keyframes: { shimmer: { '100%': { transform: 'translateX(100%)' } } },
      animation: { shimmer: 'shimmer 1.4s infinite' },
    },
  },
  plugins: [],
}
