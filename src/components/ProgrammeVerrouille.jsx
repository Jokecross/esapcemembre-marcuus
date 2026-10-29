import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

/**
 * Le bandeau qui annonce l'ouverture du reste du programme.
 *
 * Les premiers modules sont ouverts dès l'inscription — le jour 0 a été
 * fait avec le setter. Tous les autres de sa formule arrivent au jour 3
 * du workshop. Plutôt que
 * de laisser l'élève buter sur des cadenas sans explication, on lui dit
 * quand et pourquoi, et on l'envoie construire son outil en attendant.
 */
export default function ProgrammeVerrouille({ etat }) {
  if (!etat || etat.dispense || etat.equipe) return null
  if (etat.jour >= etat.jour_deblocage) return null

  const restants = etat.jour_deblocage - etat.jour
  const n = etat.modules_avant ?? 1
  const ouverts = n > 1 ? `tes ${n} premiers modules` : 'ton premier module'

  return (
    <section className="card flex flex-wrap items-center gap-4 border-accent/25 bg-gradient-to-r from-accent-pastel to-surface p-5">
      <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-surface text-xl shadow-card">
        🔓
      </span>

      <div className="min-w-0 flex-1">
        <b className="block font-title font-extrabold text-navy">
          Tout ton programme s'ouvre au jour {etat.jour_deblocage} de ton workshop
        </b>
        <span className="text-sm">
          {restants === 1
            ? 'Demain, tous tes modules seront accessibles. En attendant, avance sur ton workshop.'
            : `Encore ${restants} jours. En attendant, tu as ${ouverts} et ton workshop.`}
        </span>
      </div>

      <Link to="/workshop" className="btn whitespace-nowrap px-5 py-2.5 text-sm">
        {etat.jour === 0 ? 'Voir le workshop' : `Faire le jour ${etat.jour}`}
      </Link>
    </section>
  )
}

/** L'état du workshop, partagé par la page d'accueil. */
export function useEtatWorkshop(actif = true) {
  const [etat, setEtat] = useState(null)
  useEffect(() => {
    if (!actif) return
    supabase.rpc('mon_etat_workshop').then(({ data }) => setEtat(data || null))
  }, [actif])
  return etat
}
