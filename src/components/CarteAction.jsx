import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import Icone from './Icone.jsx'
import { APP, OUTIL } from '../lib/marque'

/**
 * « Ta prochaine action » : la seule carte sombre de la page, donc la seule
 * qu'on ne peut pas rater.
 *
 * Elle répond à la question que l'élève se pose en arrivant — qu'est-ce que
 * je fais maintenant ? — et elle le fait à sa place. L'ordre des cas compte :
 * d'abord ce qui bloque (les introductions), puis ce qui est nouveau (le
 * workshop), puis la suite du programme.
 */
export default function CarteAction({ etat, intros, parcours, introFaite, onOuvrirModule }) {
  const action = decider({ etat, intros, parcours, introFaite })
  const naviguer = useNavigate()
  const [cherche, setCherche] = useState(false)
  if (!action) return null

  /* Reprendre un module, c'est reprendre à la première leçon non vue. On
     va la chercher au clic plutôt qu'au chargement : la page d'accueil
     n'a pas besoin de connaître les leçons de tous les modules pour
     afficher une carte. */
  async function reprendre() {
    if (cherche) return
    setCherche(true)
    const [{ data: lecons }, { data: vues }] = await Promise.all([
      supabase
        .from('lessons')
        .select('id, position')
        .eq('module_id', action.module)
        .order('position'),
      supabase.from('lesson_progress').select('lesson_id'),
    ])
    setCherche(false)
    const faites = new Set((vues || []).map((v) => v.lesson_id))
    const suivante = (lecons || []).find((l) => !faites.has(l.id)) || (lecons || [])[0]
    // Sans leçon — module vide, ou requête en échec — on déplie le module
    // sur place : l'élève voit au moins où il en est.
    if (suivante) naviguer(`/lecon/${suivante.id}`)
    else onOuvrirModule?.(action.module)
  }

  return (
    <section className="relative mt-5 overflow-hidden rounded-[22px] bg-panel p-6 shadow-[0_18px_40px_rgba(0,0,0,.18)] sm:p-8 lg:mt-7">
      {/* Un halo très discret : assez pour que la carte ne soit pas un
          rectangle plat, pas assez pour qu'on le remarque. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-accent-light/[.14]"
      />

      <div className="relative flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:gap-8">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/[.12] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[.12em] text-[#DDE1E7]">
            <Icone nom={action.icone} taille={14} />
            {action.etiquette}
          </span>

          <h2 className="mt-3.5 font-title text-[23px] font-extrabold leading-tight tracking-tight text-white sm:text-[30px]">
            {action.titre}
          </h2>

          <p className="mt-2.5 max-w-[42ch] text-[15px] leading-relaxed text-[#C9C2B2]">
            {action.texte}
          </p>

          {action.details && (
            <div className="mt-4 flex items-center gap-3.5 text-[13px] font-bold text-[#BFB8A8]">
              {action.details.map((d, i) => (
                <span key={d} className="flex items-center gap-3.5">
                  {i > 0 && <span className="h-[3px] w-[3px] rounded-full bg-[#6B7380]" />}
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>

        {action.module ? (
          <button
            onClick={reprendre}
            disabled={cherche}
            className="inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-full bg-surface px-7 py-3.5 font-title text-[15px] font-extrabold text-navy transition hover:-translate-y-0.5 disabled:opacity-70 sm:px-8 sm:py-4"
          >
            {cherche ? 'Un instant…' : action.bouton}
            <Icone nom="fleche" taille={18} />
          </button>
        ) : (
          <Link
            to={action.lien}
            className="inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-full bg-surface px-7 py-3.5 font-title text-[15px] font-extrabold text-navy transition hover:-translate-y-0.5 sm:px-8 sm:py-4"
          >
            {action.bouton}
            <Icone nom="fleche" taille={18} />
          </Link>
        )}
      </div>
    </section>
  )
}

function decider({ etat, intros, parcours, introFaite }) {
  // 1. Les introductions bloquent tout : rien d'autre ne compte.
  if (intros?.length && !introFaite) {
    return {
      etiquette: 'Commence ici',
      icone: 'lecture',
      titre: 'Regarde ton introduction',
      texte:
        "Les vidéos pour comprendre où tu mets les pieds. Tant qu'elles ne sont pas vues, le reste reste fermé.",
      bouton: 'Regarder',
      lien: `/lecon/${intros[0].id}`,
    }
  }

  // 2. Le workshop, tant qu'il n'est pas terminé. Pour un ancien élève qui
  //    ne l'a pas commencé, c'est la nouveauté qui le concerne.
  if (etat && !etat.equipe && etat.jour < 7) {
    const neuf = etat.dispense || etat.jour === 0
    return {
      etiquette: neuf ? 'Nouveau' : 'Ta prochaine action',
      icone: 'outil',
      titre: neuf ? 'Construis ton cockpit en 7 jours' : `Jour ${etat.jour} de ton workshop`,
      texte: neuf
        ? `Sept jours, sept prompts à coller dans ${OUTIL} : ton ${APP} prend forme jour après jour.`
        : `Un prompt à coller dans ${OUTIL}. Quelques minutes, et ton ${APP} avance d'un cran.`,
      details: neuf ? null : ['1 vidéo', '1 prompt à coller'],
      bouton: neuf ? 'Découvrir' : 'Continuer',
      lien: '/workshop',
    }
  }

  // 3. Sinon, la suite du programme.
  const enCours = parcours?.find((m) => m.unlocked && m.completion < 1)
  if (enCours) {
    return {
      etiquette: 'Ta prochaine action',
      icone: 'lecture',
      titre: enCours.title,
      texte: `Module ${enCours.position} · ${enCours.done_count} leçon${enCours.done_count > 1 ? 's' : ''} sur ${enCours.lesson_count} déjà vue${enCours.done_count > 1 ? 's' : ''}. Reprends là où tu t'es arrêté.`,
      bouton: 'Reprendre',
      // Le bouton menait à « / », c'est-à-dire la page où l'on est déjà :
      // il ne se passait rien. C'est le module qu'il faut ouvrir.
      module: enCours.id,
    }
  }

  // 4. Tout est fait.
  return {
    etiquette: 'Bravo',
    icone: 'valide',
    titre: 'Tu as terminé ton programme',
    texte:
      'Tes modules sont tous vus et ton workshop est terminé. Maintenant, tout se joue dans ce que tu publies chaque jour.',
    bouton: 'Revoir le workshop',
    lien: '/workshop',
  }
}
