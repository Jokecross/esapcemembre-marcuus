/**
 * Un anneau de progression.
 *
 * Il dit la même chose qu'une barre, en occupant un carré — c'est ce qui
 * permet de le poser à côté d'un titre sans manger de largeur, et c'est ce
 * qui donne à l'interface son air d'outil plutôt que de page web.
 */
export default function Anneau({
  valeur = 0,            // de 0 à 1
  taille = 52,
  epaisseur = 5,
  couleur = '#E86C46',
  fond = '#F1E6E0',
  texte,
  className = '',
}) {
  const rayon = (taille - epaisseur) / 2
  const perimetre = 2 * Math.PI * rayon
  const part = Math.max(0, Math.min(1, Number(valeur) || 0))

  return (
    <span
      className={`relative grid flex-none place-items-center ${className}`}
      style={{ width: taille, height: taille }}
    >
      <svg
        width={taille}
        height={taille}
        viewBox={`0 0 ${taille} ${taille}`}
        className="absolute -rotate-90"
        aria-hidden="true"
      >
        <circle cx={taille / 2} cy={taille / 2} r={rayon} fill="none" stroke={fond} strokeWidth={epaisseur} />
        <circle
          cx={taille / 2}
          cy={taille / 2}
          r={rayon}
          fill="none"
          stroke={couleur}
          strokeWidth={epaisseur}
          strokeLinecap="round"
          strokeDasharray={perimetre}
          strokeDashoffset={perimetre * (1 - part)}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      {texte != null && (
        <b
          className="relative font-title font-extrabold text-navy"
          style={{ fontSize: taille < 46 ? 11 : taille < 60 ? 13 : 15 }}
        >
          {texte}
        </b>
      )}
    </span>
  )
}
