/**
 * Les icônes de l'espace membre, dessinées au trait.
 *
 * Un jeu unique, de même épaisseur et de même taille : c'est ce qui donne
 * à l'interface son air de produit fini. Les emojis sont réservés aux
 * textes, jamais à l'interface.
 */
const TRACES = {
  accueil: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
  programme: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M8 9h8M8 13h5" /></>,
  outil: <path d="M14.7 6.3a4 4 0 0 1-5 5L5 16v3h3l4.7-4.7a4 4 0 0 0 5-5l-2.3 2.3-2-2 2.3-2.3Z" />,
  ressources: <><path d="M5 4h9l5 5v11H5z" /><path d="M14 4v5h5" /></>,
  coach: <><path d="M21 12a8 8 0 1 1-3.1-6.3" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
  lecture: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  valide: <path d="m4.5 12.5 5 5 10-11" />,
  cadenas: <><rect x="4.5" y="10" width="15" height="10" rx="2.5" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></>,
  fleche: <path d="M5 12h13M13 6l6 6-6 6" />,
  document: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h4" /></>,
  prompt: <path d="M8 4a2.5 2.5 0 1 0 2.5 2.5V17.5A2.5 2.5 0 1 0 8 20h8a2.5 2.5 0 1 0-2.5-2.5V6.5A2.5 2.5 0 1 0 16 4z" />,
  cible: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></>,
  copier: <><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15" /></>,
  deconnexion: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  reglages: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.5H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.7 7.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10.5 3V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3Z" /></>,
}

export default function Icone({ nom, taille = 20, className = '', epaisseur = 1.6 }) {
  const trace = TRACES[nom]
  if (!trace) return null
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={epaisseur}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className}`}
    >
      {trace}
    </svg>
  )
}
