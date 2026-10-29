import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * L'accompagnement 1-1, proposé une fois le programme terminé.
 *
 * Jamais avant : une offre payante mise en avant au milieu d'un programme
 * annoncé gratuit donne une cible à l'objection « où est le piège ? ».
 * Ici, l'élève a déjà reçu ce qu'on lui avait promis — ce n'est plus une
 * vente, c'est une suite.
 *
 * « Terminé » se compte sur la formule de chacun : `my_modules()` ne
 * renvoie que les modules auxquels l'élève a droit, donc un mensuel qui
 * finit les siens voit ce bloc sans avoir à passer à l'annuel.
 */
export default function ProchainesEtapes({ termine }) {
  const [offre, setOffre] = useState(null)

  useEffect(() => {
    if (!termine) return
    supabase
      .from('prochaines_etapes')
      .select('actif, eyebrow, titre, texte, cta_libelle, cta_url, note')
      .maybeSingle()
      .then(({ data }) => setOffre(data?.actif ? data : null))
  }, [termine])

  if (!termine || !offre) return null

  return (
    <section className="card mt-8 overflow-hidden border-accent/60 bg-panel text-white shadow-lift">
      <div className="p-7 sm:p-9">
        <p className="text-xs font-extrabold uppercase tracking-[.14em] text-accent-light">
          {offre.eyebrow || 'Les prochaines étapes'}
        </p>

        <h2 className="mt-3 max-w-2xl font-title text-2xl font-extrabold leading-tight text-white sm:text-3xl">
          {offre.titre}
        </h2>

        {offre.texte && (
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#C9C2B2]">{offre.texte}</p>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-4">
          <a
            href={offre.cta_url}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-full bg-surface px-7 py-3.5 font-title text-[15px] font-extrabold text-navy transition hover:-translate-y-0.5 hover:shadow-lift"
          >
            {offre.cta_libelle}
            <span aria-hidden="true">→</span>
          </a>

          {offre.note && <span className="text-sm text-[#A2A9B4]">{offre.note}</span>}
        </div>
      </div>
    </section>
  )
}
