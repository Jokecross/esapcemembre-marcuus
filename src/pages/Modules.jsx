import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import Icone from '../components/Icone.jsx'
import Anneau from '../components/Anneau.jsx'
import CarteAction from '../components/CarteAction.jsx'
import BandeOutils from '../components/BandeOutils.jsx'
import ProchainesEtapes from '../components/ProchainesEtapes.jsx'
import ProgrammeVerrouille, { useEtatWorkshop } from '../components/ProgrammeVerrouille.jsx'

/**
 * La page d'accueil de l'élève.
 *
 * L'ordre suit la priorité, pas l'historique des ajouts : où j'en suis, quoi
 * faire maintenant, mes outils, mon programme, le reste. Un seul bloc porte
 * le poids visuel — la carte d'action — et tout le reste s'efface derrière.
 */
export default function Modules({ member }) {
  const [modules, setModules] = useState(null)
  const [ouvert, setOuvert] = useState(null)
  const etat = useEtatWorkshop(true)

  const charger = useCallback(() => {
    // my_modules() renvoie déjà le pourcentage et l'état du verrou, calculés
    // côté base : rien à recalculer ici.
    supabase.rpc('my_modules').then(({ data }) => {
      setModules(data || [])
      const suite = (data || []).filter((m) => !m.is_intro && !m.is_bonus && m.lesson_count > 0)
      const prochain = suite.find((m) => m.unlocked && m.completion < 1)
      setOuvert((avant) => avant ?? prochain?.id ?? suite[0]?.id ?? null)
    })
  }, [])

  useEffect(() => {
    charger()
  }, [charger])

  if (!modules) return <p className="text-muted">Chargement du programme…</p>

  const intros = modules.filter((m) => m.is_intro)
  // Un module sans vidéo ni fichier (Copify, liste d'influenceurs…) s'affiche
  // « Bientôt disponible » et ne compte pas dans l'avancement.
  const programme = modules.filter((m) => !m.is_intro && !m.is_bonus)
  const parcours = programme.filter((m) => m.lesson_count > 0)
  const bonus = modules.filter((m) => m.is_bonus)
  // Pourquoi un module est fermé : le jour 3 pas encore atteint, ou un
  // module que la formule ne contient pas.
  const raison =
    etat && !etat.equipe && !etat.dispense && etat.jour < etat.jour_deblocage
      ? `S'ouvre au jour ${etat.jour_deblocage} de ton workshop`
      : 'Pas encore ouvert'
  const faits = parcours.filter((m) => m.completion >= 1).length
  const termine = parcours.length > 0 && faits === parcours.length
  const avancement = parcours.length ? faits / parcours.length : 0

  const resteDuProgramme =
    etat && !etat.dispense && !etat.equipe && etat.jour < etat.jour_deblocage

  return (
    <>
      {/* ---------- Où j'en suis ---------- */}
      <div className="flex items-center gap-4 sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{dateDuJour()}</p>
          <h1 className="mt-1.5 font-title text-[25px] font-extrabold tracking-tight text-navy sm:text-[31px]">
            Bonjour {member?.first_name || ''}
          </h1>
        </div>

        {/* Sur téléphone : un seul anneau à côté du titre. Sur ordinateur :
            les deux compteurs, détaillés. */}
        <Anneau
          valeur={avancement}
          taille={58}
          texte={`${Math.round(avancement * 100)}%`}
          className="sm:hidden"
        />

        <div className="hidden items-center gap-6 sm:flex">
          <Compteur
            valeur={avancement}
            titre="Programme"
            detail={`${faits} / ${parcours.length} modules`}
            texte={`${Math.round(avancement * 100)}%`}
          />
          {etat && !etat.dispense && !etat.equipe && (
            <>
              <span className="h-10 w-px bg-line" />
              <Compteur
                valeur={etat.jour / 7}
                titre="Ton workshop"
                detail={etat.jour >= 7 ? 'Terminé' : `Jour ${etat.jour} sur 7`}
                texte={`${etat.jour}/7`}
                couleur="#3A302C"
              />
            </>
          )}
        </div>
      </div>

      {/* Deux tuiles chiffrées, seulement sur téléphone */}
      <div className="mt-4 flex gap-2.5 sm:hidden">
        <TuileChiffre titre="Programme" valeur={faits} total={parcours.length} />
        {etat && !etat.dispense && !etat.equipe && (
          <TuileChiffre titre="Workshop" valeur={`J${etat.jour}`} total="7" />
        )}
      </div>

      {/* ---------- Quoi faire maintenant ---------- */}
      <CarteAction
        etat={etat}
        intros={intros}
        parcours={parcours}
        introFaite
        onOuvrirModule={(id) => {
          setOuvert(id)
          document.getElementById(`module-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }}
      />

      {/* ---------- Les outils ---------- */}
      <BandeOutils />

      {/* ---------- Le programme ---------- */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Ton espace</p>
            <h2 className="mt-1 font-title text-[19px] font-extrabold tracking-tight text-navy">
              Ton programme
            </h2>
          </div>
          <p className="text-[13px] text-muted">
            <b className="font-title text-navy">{faits}</b> / {parcours.length} modules terminés
          </p>
        </div>

        {resteDuProgramme && (
          <div className="mt-4">
            <ProgrammeVerrouille etat={etat} />
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {programme.map((m, i) => (
            <CarteModule
              key={m.id}
              id={`module-${m.id}`}
              module={m}
              numero={i + 1}
              raison={raison}
              ouvert={ouvert === m.id}
              onToggle={() => setOuvert(ouvert === m.id ? null : m.id)}
            />
          ))}
        </div>
      </section>

      {/* ---------- Les bonus ---------- */}
      {bonus.length > 0 && (
        <section className="mt-10">
          <p className="eyebrow">Bonus</p>
          <h2 className="mt-1 font-title text-[19px] font-extrabold tracking-tight text-navy">
            Modules vidéo bonus{' '}
            <span className="font-body text-[14px] font-semibold text-muted">(TikTok Shop, etc.)</span>
          </h2>
          <p className="mt-1 text-[13.5px] text-muted">
            Du plus, à regarder en complément : l'essentiel reste ton outil et les modules de ton
            programme.
          </p>

          {/* Pas de module à ouvrir : les vidéos bonus sont listées
              directement. Fermées, leurs titres ne sont pas lisibles : on
              dit seulement quand elles s'ouvrent. */}
          <div className="mt-4 flex flex-col gap-3">
            {bonus.map((m) =>
              m.unlocked ? (
                <section key={m.id} id={`module-${m.id}`} className="card overflow-hidden pt-2.5">
                  <ListeLecons moduleId={m.id} />
                </section>
              ) : (
                <div key={m.id} className="card flex items-center gap-3.5 p-4 opacity-[.55] sm:p-[18px_20px]">
                  <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-canvas text-muted">
                    <Icone nom="cadenas" taille={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block font-title text-[15px] font-extrabold text-navy">
                      {m.lesson_count} vidéo{m.lesson_count > 1 ? 's' : ''} bonus
                    </b>
                    <span className="text-[13px] text-muted">{raison}</span>
                  </span>
                </div>
              ),
            )}
          </div>
        </section>
      )}

      <ProchainesEtapes termine={termine} />
    </>
  )
}

/* ------------------------------------------------------------------ */

function Compteur({ valeur, titre, detail, texte, couleur }) {
  return (
    <div className="flex items-center gap-3">
      <Anneau valeur={valeur} taille={52} texte={texte} couleur={couleur} />
      <span className="text-[13px] leading-tight text-muted">
        {titre}
        <b className="block font-title text-[15px] text-navy">{detail}</b>
      </span>
    </div>
  )
}

function TuileChiffre({ titre, valeur, total }) {
  return (
    <div className="card flex-1 px-3.5 py-3">
      <p className="eyebrow">{titre}</p>
      <p className="mt-1 font-title text-[19px] font-extrabold text-navy">
        {valeur}
        <span className="text-[13px] text-muted"> / {total}</span>
      </p>
    </div>
  )
}

function CarteModule({ id, module: m, numero, raison, ouvert, onToggle }) {
  const part = Number(m.completion) || 0
  const fini = part >= 1

  if (!(m.lesson_count > 0)) {
    return (
      <div id={id} className="card flex items-center gap-3.5 p-4 sm:p-[18px_20px]">
        <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-canvas font-title text-sm font-extrabold text-muted">
          {numero}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block font-title text-[15px] font-extrabold text-navy">{m.title}</b>
          <span className="text-[13px] text-muted">Bientôt disponible</span>
        </span>
      </div>
    )
  }

  if (!m.unlocked) {
    return (
      <div id={id} className="card flex items-center gap-3.5 p-4 opacity-[.55] sm:p-[18px_20px]">
        <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-canvas text-muted">
          <Icone nom="cadenas" taille={17} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block font-title text-[15px] font-extrabold text-navy">{m.title}</b>
          <span className="text-[13px] text-muted">{raison}</span>
        </span>
      </div>
    )
  }

  return (
    <section
      id={id}
      className={`overflow-hidden rounded-[18px] bg-surface transition ${
        ouvert
          ? 'border-[1.5px] border-accent/35 shadow-[0_10px_30px_rgba(232,108,70,.14)]'
          : 'border border-line shadow-card hover:border-accent/25'
      }`}
    >
      <button onClick={onToggle} className="flex w-full items-center gap-3.5 p-4 text-left sm:px-5">
        <span
          className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-xl font-title text-sm font-extrabold ${
            fini ? 'bg-success-bg text-success' : 'bg-accent text-on-accent'
          }`}
        >
          {fini ? <Icone nom="valide" taille={18} epaisseur={2.2} /> : numero}
        </span>

        <span className="min-w-0 flex-1">
          <b className="block font-title text-[15px] font-extrabold text-navy">{m.title}</b>
          <span className="text-[13px] text-muted">
            {fini
              ? `${m.lesson_count} leçons · terminé`
              : `${m.done_count} leçon${m.done_count > 1 ? 's' : ''} sur ${m.lesson_count} · en cours`}
          </span>
        </span>

        <Anneau
          valeur={part}
          taille={38}
          epaisseur={4}
          couleur={fini ? '#1F9D55' : '#E86C46'}
          texte=""
        />
      </button>

      {ouvert && <ListeLecons moduleId={m.id} />}
    </section>
  )
}

function ListeLecons({ moduleId }) {
  const [lignes, setLignes] = useState(null)

  useEffect(() => {
    let vivant = true
    Promise.all([
      supabase
        .from('lessons')
        .select('id, position, title, duration_seconds')
        .eq('module_id', moduleId)
        .order('position'),
      supabase.from('lesson_progress').select('lesson_id'),
    ]).then(([lecons, progres]) => {
      if (!vivant) return
      const vues = new Set((progres.data || []).map((p) => p.lesson_id))
      setLignes((lecons.data || []).map((l) => ({ ...l, vue: vues.has(l.id) })))
    })
    return () => {
      vivant = false
    }
  }, [moduleId])

  if (!lignes) return <p className="px-5 pb-5 text-sm text-muted">Chargement…</p>

  // La leçon à reprendre : la première non vue.
  const suivante = lignes.find((l) => !l.vue)?.id

  return (
    <div className="px-2.5 pb-3 sm:px-3">
      {lignes.map((l, i) => {
        const active = l.id === suivante
        return (
          <Link
            key={l.id}
            to={`/lecon/${l.id}`}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
              active ? 'bg-accent-pastel' : 'hover:bg-canvas'
            }`}
          >
            <span
              className={`grid h-6 w-6 flex-none place-items-center rounded-full ${
                l.vue ? 'bg-success-bg text-success' : active ? 'bg-accent text-on-accent' : 'bg-canvas text-muted'
              }`}
            >
              {l.vue ? (
                <Icone nom="valide" taille={13} epaisseur={2.4} />
              ) : active ? (
                <Icone nom="lecture" taille={13} />
              ) : (
                <span className="text-[11px] font-bold">{i + 1}</span>
              )}
            </span>

            <span
              className={`min-w-0 flex-1 text-[14px] ${
                active ? 'font-bold text-navy' : l.vue ? 'text-ink' : 'text-muted'
              }`}
            >
              {l.title}
            </span>

            {l.duration_seconds > 0 && (
              <span className="flex-none text-xs text-muted">
                {Math.round(l.duration_seconds / 60)} min
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

function dateDuJour() {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
