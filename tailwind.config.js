/** @type {import('tailwindcss').Config} */
// Charte Marcuus : la DA de la page de vente (blanc, crème, pêche, corail,
// bouton vert, Lora + Roboto). Les noms de couleur sont ceux de l'espace
// d'origine (navy = titres, ink = texte…) : les écrans n'ont pas à changer.
// `panel` reste sombre (noir chaud, comme le pied de page) : c'est le bloc
// mis en avant, avec son texte clair.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0E0B0A',            // titres et texte fort
        ink: '#3A302C',             // texte courant
        muted: '#7A706B',
        line: '#EFE4DE',
        'line-strong': '#E2D3CA',
        accent: '#E86C46',          // le corail
        'accent-light': '#F6CDBE',
        'accent-pastel': '#FEECE7', // fond teinté de corail
        'on-accent': '#FFFFFF',     // texte posé sur l'accent
        canvas: '#FFFBF8',          // fond de page
        surface: '#FFFFFF',         // cartes
        panel: '#1F1A18',           // blocs mis en avant (sombres)
        success: '#1F9D55',
        'success-bg': '#DDF5E6',
      },
      fontFamily: {
        title: ['Lora', 'Georgia', 'serif'],
        body: ['Roboto', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(74,63,59,.05), 0 10px 26px -16px rgba(74,63,59,.22)',
        lift: '0 18px 40px -18px rgba(74,63,59,.35)',
      },
    },
  },
  plugins: [],
}
