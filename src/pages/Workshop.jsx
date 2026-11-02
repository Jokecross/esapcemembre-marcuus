import { useCallback, useEffect, useState, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import Icone from '../components/Icone.jsx'
import Anneau from '../components/Anneau.jsx'
import BlocPrompt from '../components/BlocPrompt.jsx'
import { useEtatWorkshop } from '../components/ProgrammeVerrouille.jsx'
import { APP, OUTIL } from '../lib/marque'

/**
 * Le parcours « Mon Cockpit Black Friday » : une page d'accueil, une page
 * par jour, le rappel du jour 0 et « Si ça ne marche pas ».
 *
 * Les sept jours se comptent depuis l'inscription de l'élève et s'ouvrent
 * à minuit chez lui. C'est la base qui le décide (`mon_workshop`) : le
 * prompt et la page d'un jour à venir ne sont tout simplement pas
 * renvoyés. Les élèves arrivés avant le workshop voient les sept jours.
 *
 * Les prompts sont affichés et copiés tels qu'ils sont en base, sans
 * aucune transformation.
 */

/** Les jours (mon_workshop) et les réglages du parcours. */
function useParcours() {
  const [jours, setJours] = useState(null)
  const [reglages, setReglages] = useState(null)

  const charger = useCallback(
    () => supabase.rpc('mon_workshop').then(({ data }) => setJours(data || [])),
    [],
  )

  useEffect(() => {
    // `workshop_demarrer` relève le fuseau, pour que minuit soit celui de l'élève.
    supabase.rpc('workshop_demarrer', { p_fuseau: fuseauNavigateur() }).then(() => charger())
    supabase
      .from('workshop_reglages')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setReglages(data || {}))
  }, [charger])

  return { jours, reglages, recharger: charger }
}

/** Le titre court d'un jour pour la liste : « Mes marges ». */
const nomJour = (j) => ((j.titre || '').trim() && j.titre !== `Jour ${j.jour}` ? j.titre : null)

/** Le titre affiché au-dessus de chaque prompt. */
function titrePrompt(id, jour) {
  if (id === 'PROMPT_J1_SHOP') return 'Le prompt · Jour 1 · Mon shop'
  if (id === 'PROMPT_J1_COACH') return 'Le prompt · Jour 1 (suite) · Mon coach'
  return `Le prompt du jour ${jour}`
}

function Retour() {
  return (
    <Link
      to="/workshop"
      className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-muted transition hover:text-navy"
    >
      <Icone nom="fleche" taille={15} className="rotate-180" />
      Mon Cockpit Black Friday
    </Link>
  )
}

function EnTete({ eyebrow, titre, sous }) {
  return (
    <>
      <p className="eyebrow mt-5 text-accent">{eyebrow}</p>
      <h1 className="mt-1.5 font-title text-[25px] font-extrabold leading-tight tracking-tight text-navy sm:text-[31px]">
        {titre}
      </h1>
      {sous && <p className="mt-2.5 max-w-[62ch] text-[15px] leading-relaxed">{sous}</p>}
    </>
  )
}

/* =====================================================================
   L'accueil du parcours
   ===================================================================== */

export default function Workshop() {
  const { jours, reglages } = useParcours()
  const etat = useEtatWorkshop(true)

  if (!jours || !reglages) return <p className="text-muted">Chargement…</p>

  const parcours = reglages.parcours || {}
  const bandeau = parcours.bandeau
  const ouverts = jours.filter((j) => j.ouvert).length

  // L'introduction n'est pas vue : c'est elle qui retient tout. On le dit
  // ici, en grand, plutôt que de laisser l'élève devant sept cadenas.
  const introAFaire = etat && !etat.intro_ok && !etat.dispense && !etat.equipe

  return (
    <>
      <p className="eyebrow">Ton workshop</p>
      <h1 className="mt-1.5 font-title text-[25px] font-extrabold tracking-tight text-navy sm:text-[31px]">
        Mon Cockpit Black Friday
      </h1>
      <p className="mt-2.5 max-w-[62ch] text-[15px] leading-relaxed">
        Un prompt par jour à coller dans {OUTIL}. Jour après jour, ton {APP} prend forme : c'est
        l'outil avec lequel tu prépares ton Black Friday.
      </p>

      {bandeau?.points?.length > 0 && (
        <section className="mt-6 rounded-[22px] border-[1.5px] border-accent/50 bg-accent-pastel/60 p-5 sm:p-6">
          <h2 className="flex items-center gap-2.5 font-title text-[19px] font-extrabold text-navy">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-on-accent">
              <Icone nom="cible" taille={17} />
            </span>
            {bandeau.titre}
          </h2>
          <ul className="mt-4 grid gap-2.5">
            {bandeau.points.map((p, i) => (
              <li key={i} className="flex gap-2.5 text-[14.5px] leading-relaxed text-navy">
                <span className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {introAFaire ? (
        <section className="relative mt-6 overflow-hidden rounded-[22px] bg-panel p-6 shadow-[0_18px_40px_rgba(0,0,0,.18)] sm:p-8">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-accent-light/[.14]"
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/[.12] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[.12em] text-[#DDE1E7]">
                <Icone nom="lecture" taille={14} /> Une étape avant
              </span>
              <h2 className="mt-3.5 font-title text-[22px] font-extrabold leading-tight text-white sm:text-[26px]">
                Regarde ton introduction pour ouvrir le jour 1
              </h2>
              <p className="mt-2.5 max-w-[42ch] text-[15px] leading-relaxed text-[#C9C2B2]">
                Quelques minutes de vidéo, et ton workshop démarre. C'est la seule chose qui te
                sépare de ton premier prompt.
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-full bg-surface px-7 py-3.5 font-title text-[15px] font-extrabold text-navy transition hover:-translate-y-0.5"
            >
              Regarder l'introduction
              <Icone nom="fleche" taille={18} />
            </Link>
          </div>
        </section>
      ) : (
        <div className="card mt-6 flex flex-wrap items-center gap-4 p-5">
          <Anneau valeur={ouverts / 7} taille={48} texte={ouverts} />
          <p className="min-w-0 flex-1 text-sm">
            <b className="block font-title text-[15px] font-extrabold text-navy">
              {ouverts === 7 ? 'Tes sept jours sont ouverts' : `Tu en es au jour ${ouverts}`}
            </b>
            <span className="text-muted">
              {ouverts === 7
                ? 'Tu peux avancer à ton rythme.'
                : 'Le jour suivant s’ouvre cette nuit, à minuit.'}
            </span>
          </p>
          <span className="hidden h-1.5 w-48 overflow-hidden rounded-full bg-line sm:block">
            <span
              className="block h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${(ouverts / 7) * 100}%` }}
            />
          </span>
        </div>
      )}

      {reglages.video_systeme_url && <VideoSysteme url={reglages.video_systeme_url} />}

      <div className="mt-6 flex flex-col gap-3">
        <LigneJour
          to="/workshop/jour/0"
          numero="0"
          sombre
          titre={parcours.j0?.rappel_titre || 'Jour 0 · La base de ton app'}
          sous="Le prompt qui crée ton app, si tu dois la recréer de zéro."
        />

        {jours.map((j) =>
          j.ouvert ? (
            <LigneJour
              key={j.jour}
              to={`/workshop/jour/${j.jour}`}
              numero={j.jour}
              titre={nomJour(j) ? `Jour ${j.jour} · ${nomJour(j)}` : `Jour ${j.jour}`}
              sous={j.resume}
              fait={j.capture_faite}
            />
          ) : (
            <div key={j.jour} className="card flex items-center gap-3.5 p-4 opacity-[.55] sm:px-5">
              <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-canvas text-muted">
                <Icone nom="cadenas" taille={17} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block font-title text-[15px] font-extrabold text-navy">
                  {nomJour(j) ? `Jour ${j.jour} · ${nomJour(j)}` : `Jour ${j.jour}`}
                </b>
                {j.resume && <span className="line-clamp-2 text-[13px] text-muted">{j.resume}</span>}
              </span>
              <Compte ouvreLe={j.ouvre_le} />
            </div>
          ),
        )}

        {parcours.sos?.prompts?.length > 0 && (
          <LigneJour
            to="/workshop/sos"
            icone="reglages"
            titre={parcours.sos.titre || 'Si ça ne marche pas'}
            sous="Les prompts pour te débloquer seul, à n'importe quel moment."
          />
        )}
      </div>
    </>
  )
}

function LigneJour({ to, numero, icone, titre, sous, fait, sombre }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3.5 rounded-[18px] border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-accent/35 sm:px-5"
    >
      <span
        className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-xl font-title text-sm font-extrabold ${
          icone ? 'bg-accent-pastel text-accent' : sombre ? 'bg-panel text-white' : 'bg-accent text-on-accent'
        }`}
      >
        {icone ? <Icone nom={icone} taille={18} /> : numero}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block font-title text-[15px] font-extrabold text-navy">{titre}</b>
        {sous && <span className="line-clamp-2 text-[13px] text-muted">{sous}</span>}
      </span>
      {fait && <Icone nom="valide" taille={17} className="flex-none text-success" />}
      <Icone nom="fleche" taille={18} className="flex-none text-accent transition group-hover:translate-x-0.5" />
    </Link>
  )
}

/* =====================================================================
   La page d'un jour
   ===================================================================== */

export function JourPage() {
  const { n } = useParams()
  const numero = Number(n)
  if (numero === 0) return <JourZeroPage />
  return <JourN numero={numero} />
}

function JourN({ numero }) {
  const { jours, recharger } = useParcours()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [numero])

  if (!jours) return <p className="text-muted">Chargement…</p>
  const j = jours.find((x) => x.jour === numero)
  if (!j) return <Introuvable />

  const titre = nomJour(j) || `Jour ${j.jour}`
  const blocs = Array.isArray(j.blocs) ? j.blocs : []

  if (!j.ouvert) {
    return (
      <>
        <Retour />
        <EnTete eyebrow={`Jour ${j.jour} sur 7`} titre={titre} />
        <div className="card mt-6 flex items-center gap-4 p-5">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-canvas text-muted">
            <Icone nom="cadenas" taille={20} />
          </span>
          <p className="min-w-0 flex-1 text-[14.5px]">
            <b className="block font-title text-[15.5px] text-navy">Ce jour n'est pas encore ouvert</b>
            Il s'ouvre à minuit, le moment venu. En attendant, termine le jour précédent.
          </p>
          <Compte ouvreLe={j.ouvre_le} />
        </div>
      </>
    )
  }

  return (
    <>
      <Retour />
      <EnTete eyebrow={`Jour ${j.jour} sur 7`} titre={titre} />

      {blocs.length ? (
        blocs.map((b, i) => <Bloc key={i} bloc={b} jour={j} />)
      ) : (
        // Un jour saisi à l'ancienne, depuis le back-office : résumé, étapes, prompt.
        <>
          {j.resume && <Bloc bloc={{ type: 'construis', texte: j.resume }} jour={j} />}
          {etapesDe(j).length > 0 && <Bloc bloc={{ type: 'etapes', depart: 1, items: etapesDe(j) }} jour={j} />}
          {j.prompt && <BlocPrompt titre={`Le prompt du jour ${j.jour}`} texte={j.prompt} />}
          {j.prompt_2 && <BlocPrompt titre={j.prompt_2_titre || 'Le deuxième prompt'} texte={j.prompt_2} />}
          {!j.resume && !j.prompt && etapesDe(j).length === 0 && (
            <p className="mt-6 text-sm text-muted">Le contenu de ce jour arrive très vite.</p>
          )}
        </>
      )}

      {j.video_url && (
        <div className="mt-6 aspect-video overflow-hidden rounded-[14px] bg-panel">
          <iframe
            src={lecteur(j.video_url)}
            title={`Jour ${j.jour}`}
            allow="fullscreen"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
      )}

      <Capture jour={j.jour} deja={j.capture_faite} onDepose={recharger} />

      <Link
        to="/workshop/sos"
        className="mt-4 inline-block text-[13.5px] font-semibold text-muted underline underline-offset-2 hover:text-navy"
      >
        Quelque chose ne marche pas ? Va dans « Si ça ne marche pas ».
      </Link>

      <Voisins numero={j.jour} jours={jours} />
    </>
  )
}

/** Un bloc de la page d'un jour, dans l'ordre du brief. */
function Bloc({ bloc: b, jour: j }) {
  switch (b.type) {
    case 'construis':
      return (
        <section className="mt-6 rounded-[18px] bg-accent-pastel/60 p-5">
          <p className="eyebrow text-accent">Ce que tu construis aujourd'hui</p>
          <p className="mt-2 text-[15.5px] leading-relaxed text-navy">{b.texte}</p>
        </section>
      )
    case 'avant':
      return (
        <div className="mt-4 flex gap-3 rounded-xl border-[1.5px] border-accent/60 bg-surface p-4">
          <Icone nom="cible" taille={18} className="mt-0.5 flex-none text-accent" />
          <p className="text-[14.5px] text-navy">
            <b className="font-title">Avant de commencer : </b>
            {b.texte}
          </p>
        </div>
      )
    case 'partie':
      return (
        <h2 className="mt-9 border-t border-line pt-6 font-title text-[20px] font-extrabold text-navy">
          {b.titre}
        </h2>
      )
    case 'etapes':
      return <Etapes items={b.items} depart={b.depart || 1} />
    case 'encadre':
      return (
        <div className="mt-5 rounded-xl border border-line-strong bg-canvas p-4 sm:p-5">
          <b className="block font-title text-[15px] text-navy">{b.titre}</b>
          {b.ordonne ? (
            <ol className="mt-2.5 list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-navy marker:font-bold marker:text-accent">
              {b.items.map((x, i) => <li key={i}>{x}</li>)}
            </ol>
          ) : (
            <ul className="mt-2.5 space-y-1.5">
              {b.items.map((x, i) => (
                <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-navy">
                  <span className="mt-[8px] h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )
    case 'prompt': {
      const texte = j[b.champ]
      if (!texte) return null
      return <BlocPrompt titre={titrePrompt(b.id, j.jour)} texte={texte} />
    }
    case 'reussi':
      return (
        <section className="mt-7 rounded-[18px] border border-success/25 bg-success-bg p-5">
          <b className="block font-title text-[16px] text-success">Tu as réussi si…</b>
          <ul className="mt-3 space-y-2">
            {b.items.map((x, i) => (
              <li key={i} className="flex gap-2.5 text-[14.5px] leading-relaxed text-navy">
                <Icone nom="valide" taille={17} className="mt-0.5 flex-none text-success" />
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </section>
      )
    case 'coince':
      return (
        <section className="mt-4 rounded-[18px] border border-line-strong bg-surface p-5">
          <b className="block font-title text-[16px] text-navy">Si ça coince</b>
          <ul className="mt-3 space-y-2">
            {b.items.map((x, i) => (
              <li key={i} className="flex gap-2.5 text-[14.5px] leading-relaxed text-navy">
                <span className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </section>
      )
    case 'fin':
      return (
        <section className="mt-6 rounded-[22px] bg-panel p-6 text-[15.5px] leading-relaxed text-white shadow-[0_18px_40px_rgba(0,0,0,.18)]">
          <span className="eyebrow text-accent-light">Bravo</span>
          <p className="mt-2">{b.texte}</p>
        </section>
      )
    default:
      return null
  }
}

/** Les étapes, numérotées et reliées. Le jour 1 reprend à 6 après la partie 1. */
function Etapes({ items, depart }) {
  return (
    <div className="mt-5 rounded-xl bg-canvas p-4 sm:p-5">
      <h3 className="font-title text-[15px] font-extrabold text-navy">Les étapes</h3>
      <ol className="mt-4">
        {items.map((e, i) => (
          <li key={i} className="relative flex gap-3.5 pb-5 last:pb-0">
            {i < items.length - 1 && (
              <span aria-hidden="true" className="absolute bottom-0 left-[14px] top-8 w-px bg-line-strong" />
            )}
            <span className="grid h-[29px] w-[29px] flex-none place-items-center rounded-full border-[1.5px] border-accent/60 bg-surface font-title text-[12.5px] font-extrabold text-accent">
              {depart + i}
            </span>
            <p className="min-w-0 flex-1 pt-[3px] text-[14.5px] leading-relaxed text-navy">{e}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Jour précédent, jour suivant. */
function Voisins({ numero, jours }) {
  const prec = numero > 1 ? numero - 1 : 0
  const suiv = jours.find((x) => x.jour === numero + 1)
  return (
    <nav className="mt-9 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
      <Link to={`/workshop/jour/${prec}`} className="btn-ghost justify-start rounded-xl">
        <Icone nom="fleche" taille={16} className="rotate-180" />
        Jour {prec}
      </Link>
      {suiv && (
        <Link
          to={`/workshop/jour/${suiv.jour}`}
          className={`btn-ghost justify-end rounded-xl ${suiv.ouvert ? '' : 'opacity-60'}`}
        >
          Jour {suiv.jour}
          <Icone nom={suiv.ouvert ? 'fleche' : 'cadenas'} taille={16} />
        </Link>
      )}
    </nav>
  )
}

function Introuvable() {
  return (
    <>
      <Retour />
      <p className="mt-6 text-muted">Cette page n'existe pas.</p>
    </>
  )
}

/* =====================================================================
   Jour 0 · La base de ton app (le rappel, sans capture obligatoire)
   ===================================================================== */

function JourZeroPage() {
  const { reglages, jours } = useParcours()
  if (!reglages || !jours) return <p className="text-muted">Chargement…</p>
  const j0 = reglages.parcours?.j0 || {}

  return (
    <>
      <Retour />
      <EnTete eyebrow="Jour 0" titre={j0.rappel_titre || 'Jour 0 · La base de ton app'} sous={j0.rappel} />
      {reglages.prompt_j0 ? (
        <BlocPrompt titre="Le prompt du jour 0" texte={reglages.prompt_j0} libelle={j0.bouton_copie || 'COPIER LE PROMPT DU JOUR 0'} />
      ) : (
        <p className="mt-6 text-sm text-muted">Le prompt du jour 0 arrive très vite.</p>
      )}
      <Voisins numero={0} jours={jours} />
    </>
  )
}

/* =====================================================================
   Si ça ne marche pas
   ===================================================================== */

export function SosPage() {
  const { reglages } = useParcours()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  if (!reglages) return <p className="text-muted">Chargement…</p>
  const sos = reglages.parcours?.sos || {}

  return (
    <>
      <Retour />
      <EnTete eyebrow="Secours" titre={sos.titre || 'Si ça ne marche pas'} sous={sos.intro} />
      {(sos.prompts || []).map((p) => (
        <section key={p.id} className="card mt-6 p-5 sm:p-6">
          <h2 className="font-title text-[19px] font-extrabold text-navy">{p.titre}</h2>
          {p.dessus && <p className="mt-2 text-[14.5px] text-ink">{p.dessus}</p>}
          <BlocPrompt texte={p.texte} />
        </section>
      ))}
    </>
  )
}

/* =====================================================================
   Outils partagés
   ===================================================================== */

/**
 * L'adresse d'un lecteur vidéo, quelle que soit celle qu'on a collée.
 *
 * Loom, Vimeo, YouTube et Google Drive refusent d'être affichés avec leur lien de
 * partage : il leur faut leur adresse de lecteur. On convertit ici plutôt
 * que de compter sur celui qui remplit le back-office.
 */
function lecteur(url) {
  if (!url) return null
  const u = url.trim()

  const loom = u.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/)
  if (loom) return `https://www.loom.com/embed/${loom[1]}?hide_owner=true&hide_share=true&hide_title=true`

  // Google Drive : le lien de partage d'un fichier ouvre la page Drive.
  // Le lecteur intégrable est sur /preview. Le fichier doit être partagé
  // à « Tous les utilisateurs disposant du lien ».
  const drive =
    u.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/) ||
    u.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([A-Za-z0-9_-]{10,})/)
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`

  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)(?:[/?]([a-zA-Z0-9]+))?/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}${vimeo[2] ? `?h=${vimeo[2]}` : ''}`

  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`

  return u
}

/** Les étapes du jour, sans les lignes vides. */
function etapesDe(j) {
  return Array.isArray(j.etapes) ? j.etapes.filter((e) => typeof e === 'string' && e.trim()) : []
}


/** Le fuseau de l'élève, pour que ses jours s'ouvrent à minuit chez lui. */
function fuseauNavigateur() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

/**
 * La vidéo obligatoire, entre l'avancement et le jour 1 : elle explique
 * le système avant le premier prompt.
 */
function VideoSysteme({ url }) {
  return (
    <section className="mt-6 rounded-[22px] border-[1.5px] border-accent/45 bg-surface p-5 shadow-[0_18px_40px_rgba(0,0,0,.18)] sm:p-6">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[.12em] text-on-accent">
        <Icone nom="lecture" taille={14} /> Vidéo obligatoire
      </span>
      <h2 className="mt-3 font-title text-[19px] font-extrabold leading-tight text-navy sm:text-[22px]">
        À regarder pour comprendre le système
      </h2>
      <div className="mt-4 aspect-video overflow-hidden rounded-[14px] bg-panel">
        <iframe
          src={lecteur(url)}
          title="Vidéo obligatoire : comprendre le système"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
    </section>
  )
}

/** Le temps qu'il reste avant minuit, mis à jour chaque minute. */
function Compte({ ouvreLe }) {
  const [reste, setReste] = useState(() => calcul(ouvreLe))

  useEffect(() => {
    const t = setInterval(() => setReste(calcul(ouvreLe)), 30000)
    return () => clearInterval(t)
  }, [ouvreLe])

  if (!reste) return <span className="flex-none text-[11px] font-bold text-muted">Bientôt</span>
  return (
    <span className="flex-none text-right text-[11px] font-bold text-muted">
      s’ouvre dans
      <b className="block font-title text-[13.5px] text-navy">{reste}</b>
    </span>
  )
}

function calcul(iso) {
  if (!iso) return null
  const ms = new Date(iso) - new Date()
  if (ms <= 0) return null
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h >= 24 ? `${Math.floor(h / 24)} j ${h % 24} h` : h >= 1 ? `${h} h ${m} min` : `${m} min`
}

/* ---------- La capture du jour ----------
   Le compteur de jours n'est qu'un calendrier : il avance tout seul. La
   capture est la seule chose qui dise ce que l'élève a réellement
   construit.

   Elle n'ouvre ni ne ferme rien. Un élève coincé un soir ne doit pas
   perdre son lendemain. */
function Capture({ jour, deja, onDepose }) {
  const champ = useRef(null)
  const [faite, setFaite] = useState(!!deja)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')

  async function deposer(fichier) {
    if (!fichier) return
    setErreur('')
    if (!fichier.type.startsWith('image/')) {
      return setErreur("Dépose une image : une capture d'écran ou une photo.")
    }
    if (fichier.size > 10 * 1024 * 1024) {
      return setErreur('Image trop lourde : 10 Mo maximum.')
    }

    setEnvoi(true)
    const { data: s } = await supabase.auth.getSession()
    const membre = s.session.user.id
    const ext = (fichier.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const chemin = `${membre}/workshop-jour-${jour}-${Date.now()}.${ext}`

    const { error: envoiErreur } = await supabase.storage
      .from('preuves')
      .upload(chemin, fichier, { contentType: fichier.type })
    if (envoiErreur) {
      setEnvoi(false)
      return setErreur(`L'envoi a échoué : ${envoiErreur.message}`)
    }

    const { error: dbErreur } = await supabase.from('workshop_captures').upsert(
      {
        member_id: membre,
        jour,
        file_path: chemin,
        file_name: fichier.name,
        taille: fichier.size,
      },
      { onConflict: 'member_id,jour' },
    )
    setEnvoi(false)
    if (dbErreur) return setErreur(`Enregistrement impossible : ${dbErreur.message}`)
    setFaite(true)
    // Le jour suivant s'ouvre avec cette capture : on rafraîchit la liste.
    onDepose?.()
  }

  return (
    <div
      className={`mt-5 rounded-xl border p-4 ${
        faite ? 'border-success/30 bg-success-bg' : 'border-[1.5px] border-accent/60 bg-canvas'
      }`}
    >
      <div className="flex items-start gap-3">
        <Icone
          nom={faite ? 'valide' : 'document'}
          taille={18}
          className={`mt-0.5 ${faite ? 'text-success' : 'text-navy'}`}
        />
        <div className="min-w-0 flex-1">
          {faite ? (
            <>
              <b className="block font-title text-[14.5px] font-extrabold text-success">
                Capture du jour {jour} reçue
              </b>
              <span className="text-[13px] text-success">
                Tu peux la remplacer si tu as avancé depuis.
              </span>
            </>
          ) : (
            <>
              <b className="block font-title text-[14.5px] font-extrabold text-navy">
                Montre-nous ton résultat
              </b>
              <span className="text-[13px]">
                Une capture d'écran de ton {APP} une fois le prompt passé. C'est ce
                qui nous permet de voir où tu en es et de t'aider si tu bloques.
              </span>
            </>
          )}

          <input
            ref={champ}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => deposer(e.target.files?.[0])}
          />
          <button
            onClick={() => champ.current?.click()}
            disabled={envoi}
            className="btn-ghost mt-3 text-[13.5px]"
          >
            {envoi ? 'Envoi…' : faite ? 'Remplacer ma capture' : 'Déposer ma capture'}
          </button>

          {erreur && <p className="mt-2 text-sm font-semibold text-red-600">{erreur}</p>}
        </div>
      </div>
    </div>
  )
}
