import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { APP, OUTIL } from '../lib/marque'

/**
 * Le tour de l'espace membre, juste après le guide de bienvenue.
 *
 * Trois arrêts, un par endroit où l'élève ira travailler. On éclaire
 * l'entrée du menu plutôt que de décrire la page : ce qu'il doit retenir,
 * c'est où cliquer demain, pas ce qu'il y a derrière aujourd'hui.
 *
 * L'espace reste visible et lisible pendant le tour — c'est ce qui le
 * distingue d'une suite de fenêtres : on montre l'outil, on ne le cache
 * pas.
 */
const ARRETS = [
  {
    cle: 'accueil',
    titre: 'Ton programme',
    texte:
      "C'est ici que vivent les vidéos de ton programme : tout ce que ta formule contient est ouvert dès maintenant.",
  },
  {
    cle: 'workshop',
    titre: `Ton ${APP}, en 7 jours`,
    texte:
      `Chaque jour, un prompt à coller dans ${OUTIL}. Jour après jour, ton ${APP} prend forme : c'est l'outil avec lequel tu prépares ton Black Friday. C'est la partie qu'il ne faut pas sauter.`,
  },
  {
    cle: 'outils',
    titre: 'Tes outils',
    texte:
      "Les outils qu'on utilise au quotidien, avec leurs liens et les éventuels codes de réduction. Reviens-y dès que tu as besoin d'un accès.",
  },
]

const MARGE = 10

export default function TourGuide({ onFini }) {
  const [i, setI] = useState(0)
  const [zone, setZone] = useState(null)

  const arret = ARRETS[i]

  // La cible change selon la largeur : barre latérale sur ordinateur,
  // barre d'onglets sur téléphone. On prend celle qui est à l'écran.
  const mesurer = useCallback(() => {
    const cibles = [
      document.querySelector(`[data-tour="${arret.cle}"]`),
      document.querySelector(`[data-tour-mobile="${arret.cle}"]`),
    ].filter((el) => el && el.getBoundingClientRect().width > 0)
    const el = cibles[0]
    if (!el) return setZone(null)
    const r = el.getBoundingClientRect()
    setZone({ x: r.left - MARGE, y: r.top - MARGE, w: r.width + MARGE * 2, h: r.height + MARGE * 2 })
  }, [arret])

  useLayoutEffect(mesurer, [mesurer])

  useEffect(() => {
    window.addEventListener('resize', mesurer)
    window.addEventListener('scroll', mesurer, true)
    return () => {
      window.removeEventListener('resize', mesurer)
      window.removeEventListener('scroll', mesurer, true)
    }
  }, [mesurer])

  async function fermer() {
    await supabase.rpc('tour_termine')
    onFini()
  }

  function suivant() {
    if (i + 1 < ARRETS.length) setI(i + 1)
    else fermer()
  }

  // Sans cible mesurable — fenêtre minuscule, menu absent — mieux vaut
  // laisser l'élève tranquille que l'enfermer devant un trou noir.
  if (!zone) return null

  const basDeLEcran = zone.y > window.innerHeight / 2
  const surLeCote = window.innerWidth >= 1024

  const carte = surLeCote
    ? { left: zone.x + zone.w + 14, top: Math.min(zone.y, window.innerHeight - 260) }
    : {
        left: 16,
        right: 16,
        ...(basDeLEcran ? { bottom: window.innerHeight - zone.y + 14 } : { top: zone.y + zone.h + 14 }),
      }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-label={arret.titre}>
      {/* Le voile est percé à l'endroit éclairé : une ombre démesurée
          autour d'un rectangle transparent, plutôt qu'un masque SVG. */}
      <div
        onClick={suivant}
        className="absolute rounded-2xl transition-all duration-300 ease-out"
        style={{
          left: zone.x,
          top: zone.y,
          width: zone.w,
          height: zone.h,
          boxShadow: '0 0 0 9999px rgba(0,0,0,.62)',
        }}
      />

      <div
        className="card absolute w-auto max-w-[340px] p-5 shadow-[0_28px_70px_-20px_rgba(0,0,0,.6)]
                   sm:max-w-[360px]"
        style={carte}
      >
        <div className="flex items-center gap-2">
          <span className="eyebrow text-accent">
            {i + 1} / {ARRETS.length}
          </span>
          <span className="flex flex-1 gap-1">
            {ARRETS.map((_, n) => (
              <span
                key={n}
                className={`h-1 flex-1 rounded-full ${n <= i ? 'bg-accent' : 'bg-line'}`}
              />
            ))}
          </span>
        </div>

        <h2 className="mt-3 font-title text-[19px] font-extrabold leading-tight text-navy">
          {arret.titre}
        </h2>
        <p className="mt-2 text-sm leading-relaxed">{arret.texte}</p>

        <div className="mt-5 flex items-center gap-3">
          <button onClick={suivant} className="btn flex-1 px-5 py-2.5 text-sm">
            {i + 1 < ARRETS.length ? 'Suivant' : "C'est parti"}
          </button>
          <button onClick={fermer} className="text-xs font-semibold text-muted hover:text-navy">
            Passer
          </button>
        </div>
      </div>
    </div>
  )
}
