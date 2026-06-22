/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Opção 1 — Salmão + Azul Petróleo
        base: '#F8FAFC',        // fundo da página
        panel: '#FFFFFF',       // superfície / cards
        panel2: '#F1F5F9',      // superfície sutil / inputs
        edge: '#E2E8F0',        // borda
        edge2: '#CBD5E1',       // borda mais forte
        ink: '#2D3748',         // texto
        mute: '#64748B',        // texto secundário
        faint: '#94A3B8',       // texto fraco
        accent: '#FF8A80',      // salmão (destaque/ativo)
        accentdim: '#F4796E',   // salmão escuro (hover)
        secondary: '#1F4E5F',   // azul petróleo (sidebar / CTA)
        secondarydim: '#163B49',
        up: '#16A34A',
        degraded: '#D97706',
        down: '#DC2626',
        unknown: '#94A3B8',
      },
      fontFamily: {
        sans: ['Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 10px 24px -16px rgba(15,23,42,0.18)',
      },
    },
  },
  plugins: [],
};
