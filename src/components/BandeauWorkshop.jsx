import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

/**
 * Le bandeau rouge des anciens élèves.
 *
 * Ceux qui étaient là avant le workshop ne sont bloqués par rien — ils
 * gardent leur programme complet. Mais ils ne savent pas que l'outil
 * existe : ce bandeau le leur annonce et ouvre les sept jours d'un coup.
 *
 * Il ne s'affiche que pour eux (`workshop_dispense`), et disparaît quand
 * ils le ferment — le choix est retenu sur leur navigateur.
 */
export default function BandeauWorkshop({ member }) {
  const [reglages, setReglages] = useState(null)
  const [ferme, setFerme] = useState(() => {
    try {
      return localStorage.getItem('bandeau_workshop_ferme') === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (!member?.workshop_dispense) return
    supabase
      .from('workshop_reglages')
      .select('bandeau_actif, bandeau_texte, bandeau_lien_texte')
      .maybeSingle()
      .then(({ data }) => setReglages(data?.bandeau_actif ? data : null))
  }, [member])

  if (ferme || !member?.workshop_dispense || !reglages) return null

  function fermer() {
    setFerme(true)
    try {
      localStorage.setItem('bandeau_workshop_ferme', '1')
    } catch {
      /* navigation privée : le bandeau reviendra, ce n'est pas grave */
    }
  }

  return (
    <div className="border-b border-[#7D1B20] bg-[#A3242A] text-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
        <span aria-hidden="true" className="text-lg leading-none">🚀</span>

        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">
          {reglages.bandeau_texte}
        </p>

        <Link
          to="/workshop"
          className="whitespace-nowrap rounded-full bg-surface px-4 py-1.5 font-title text-sm font-extrabold text-red-700 transition hover:bg-red-50"
        >
          {reglages.bandeau_lien_texte} →
        </Link>

        <button
          onClick={fermer}
          aria-label="Fermer"
          className="text-lg leading-none text-white/70 transition hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
