import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import Icone from '../components/Icone.jsx'
import Anneau from '../components/Anneau.jsx'
import { useEtatWorkshop } from '../components/ProgrammeVerrouille.jsx'
import { APP, OUTIL } from '../lib/marque'

/**
 * Le workshop 7 jours : un prompt par jour, une vidéo par jour.
 *
 * Les sept jours se comptent depuis l'inscription de l'élève : le jour 1
 * s'ouvre au minuit suivant, qu'il soit venu ou non.
 *
 * Un jour s'ouvre à minuit chez l'élève — c'est la base qui le décide
 * (`mon_workshop`), pas le navigateur : le contenu d'un jour à venir
 * n'est tout simplement pas renvoyé. Changer l'heure de son ordinateur ne
 * donne rien.
 *
 * Les élèves arrivés avant le workshop sont dispensés : ils voient les
 * sept jours d'un coup.
 */
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

/**
 * Le prompt, débarrassé de la mise en forme du document source : les
 * citations Markdown « > » en début de ligne ne doivent pas se retrouver
 * dans ce que l'élève colle dans Base44.
 */
function proprePrompt(texte) {
  if (!texte) return texte
  const lignes = texte.split('\n')
  const citations = lignes.filter((l) => l.trim()).every((l) => /^\s*>/.test(l))
  if (!citations) return texte.trim()
  return lignes.map((l) => l.replace(/^\s*>\s?/, '')).join('\n').trim()
}

/** « Jour 1 · Ta boutique », ou « Jour 1 » tant que le titre n'est pas écrit. */
function intitule(j) {
  const titre = (j.titre || '').trim()
  return titre && titre !== `Jour ${j.jour}` ? `Jour ${j.jour} · ${titre}` : `Jour ${j.jour}`
}

/** Les étapes du jour, sans les lignes vides. */
function etapesDe(j) {
  return Array.isArray(j.etapes) ? j.etapes.filter((e) => typeof e === 'string' && e.trim()) : []
}

/** Sous le titre : ce qu'on construit, ou le nombre d'étapes une fois le jour déplié. */
function sousTitre(j, deplie) {
  const n = etapesDe(j).length
  const etapes = n ? `${n} étape${n > 1 ? 's' : ''}` : null
  return deplie ? etapes : j.resume || etapes
}

/** Le fuseau de l'élève, pour que ses jours s'ouvrent à minuit chez lui. */
function fuseauNavigateur() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

export default function Workshop() {
  const [jours, setJours] = useState(null)
  const [ouvert, setOuvert] = useState(null)
  const etat = useEtatWorkshop(true)
  // Le jour 0 n'existe que pour les anciens élèves : les nouveaux l'ont
  // fait pendant l'appel, avec leur conseiller.
  const [promptJ0, setPromptJ0] = useState(null)
  // La vidéo obligatoire et le prompt de secours, les mêmes pour tous,
  // réglés dans le back-office.
  const [videoSysteme, setVideoSysteme] = useState(null)
  const [secours, setSecours] = useState(null)

  useEffect(() => {
    supabase
      .from('workshop_reglages')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        setVideoSysteme(data?.video_systeme_url || null)
        setSecours(data?.prompt_secours || null)
      })
  }, [])

  useEffect(() => {
    if (!etat?.dispense) return
    supabase
      .from('workshop_reglages')
      .select('prompt_j0')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setPromptJ0(data?.prompt_j0 || null))
  }, [etat])

  // Rechargé à l'arrivée, puis après chaque capture : c'est elle qui ouvre
  // le jour suivant, il doit apparaître sans que l'élève rafraîchisse.
  const charger = useCallback(
    (deplier = true) =>
      supabase.rpc('mon_workshop').then(({ data }) => {
        const liste = data || []
        setJours(liste)
        if (!deplier) return
        // On déplie le dernier jour ouvert : c'est celui du jour même.
        const dernier = [...liste].reverse().find((j) => j.ouvert)
        setOuvert(dernier?.jour ?? null)
      }),
    [],
  )

  useEffect(() => {
    // Les jours partent de l'inscription : `workshop_demarrer` ne fait plus
    // que relever le fuseau, pour que minuit soit celui de l'élève.
    supabase
      .rpc('workshop_demarrer', { p_fuseau: fuseauNavigateur() })
      .then(() => charger())
  }, [charger])

  if (!jours) return <p className="text-muted">Chargement…</p>

  const faits = jours.filter((j) => j.ouvert).length

  // L'introduction n'est pas vue : c'est elle qui retient tout, et beaucoup
  // d'élèves ne le comprennent pas. On le dit ici, en grand, plutôt que de
  // les laisser devant sept cadenas sans explication.
  const introAFaire = etat && !etat.intro_ok && !etat.dispense && !etat.equipe

  return (
    <>
      <p className="eyebrow">Ton workshop</p>
      <h1 className="mt-1.5 font-title text-[25px] font-extrabold tracking-tight text-navy sm:text-[31px]">
        Construis ton cockpit en 7 jours
      </h1>
      <p className="mt-2.5 max-w-[62ch] text-[15px] leading-relaxed">
        Un prompt par jour à coller dans {OUTIL}. Jour après jour, ton {APP} prend forme : c'est
        l'outil avec lequel tu prépares ton Black Friday.
      </p>

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
          <Anneau valeur={faits / 7} taille={48} texte={faits} />
          <p className="min-w-0 flex-1 text-sm">
            <b className="block font-title text-[15px] font-extrabold text-navy">
              {faits === 7 ? 'Tes sept jours sont ouverts' : `Tu en es au jour ${faits}`}
            </b>
            <span className="text-muted">
              {faits === 7
                ? 'Tu peux avancer à ton rythme.'
                : 'Le jour suivant s’ouvre cette nuit, à minuit.'}
            </span>
          </p>
          <span className="hidden h-1.5 w-48 overflow-hidden rounded-full bg-line sm:block">
            <span
              className="block h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${(faits / 7) * 100}%` }}
            />
          </span>
        </div>
      )}

      {videoSysteme && <VideoSysteme url={videoSysteme} />}

      <div className="mt-6 flex flex-col gap-3">
        {promptJ0 && <JourZero prompt={promptJ0} ouvert={ouvert === 0} onToggle={() => setOuvert(ouvert === 0 ? null : 0)} />}

        {jours.map((j) => (
          <Jour
            key={j.jour}
            jour={j}
            ouvertEtat={ouvert === j.jour}
            onToggle={() => setOuvert(ouvert === j.jour ? null : j.jour)}
            onDepose={() => charger(false)}
            secours={!!secours}
          />
        ))}

        {secours && <Secours prompt={secours} />}
      </div>
    </>
  )
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

/**
 * Le jour 0, pour les élèves arrivés avant le workshop.
 *
 * Les nouveaux le font pendant l'appel, avec leur conseiller : ils n'ont
 * rien à voir ici. Les anciens, eux, n'ont jamais eu cette étape — sans
 * elle, ils n'ont pas d'application à faire évoluer les jours suivants.
 * Pas de vidéo : un prompt à copier, et c'est parti.
 */
function JourZero({ prompt, ouvert, onToggle }) {
  return (
    <section
      className={`overflow-hidden rounded-[18px] bg-surface transition ${
        ouvert
          ? 'border-[1.5px] border-accent/35 shadow-[0_10px_30px_rgba(232,108,70,.14)]'
          : 'border border-line shadow-card hover:border-accent/25'
      }`}
    >
      <button onClick={onToggle} className="flex w-full items-center gap-3.5 p-4 text-left sm:px-5">
        <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-panel font-title text-sm font-extrabold text-white">
          0
        </span>
        <span className="min-w-0 flex-1">
          <b className="block font-title text-[15px] font-extrabold text-navy">
            Jour 0 · Le point de départ
          </b>
          <span className="text-[13px] text-muted">
            Commence par là : ce prompt crée ton {APP}. Les jours suivants le complètent.
          </span>
        </span>
        <span className="flex-none font-title text-lg font-bold text-accent">
          {ouvert ? '−' : '+'}
        </span>
      </button>

      {ouvert && (
        <div className="border-t border-line p-4 sm:p-5">
          <div className="flex gap-3 rounded-xl bg-canvas p-4">
            <Icone nom="cible" taille={18} className="mt-0.5 text-accent" />
            <p className="text-sm">
              Ouvre <b className="text-navy">{OUTIL}</b>, crée une nouvelle application et colle ce
              prompt en entier. C'est le point de départ de ton {APP} : les jours suivants partent
              de là. Pas de vidéo pour
              celui-là, il n'y a rien à expliquer.
            </p>
          </div>

          <Prompt titre={`Le prompt à coller dans ${OUTIL}`} texte={proprePrompt(prompt)} />
        </div>
      )}
    </section>
  )
}

function Jour({ jour: j, ouvertEtat, onToggle, onDepose, secours }) {
  if (!j.ouvert) {
    return (
      <div className="card flex items-center gap-3.5 p-4 opacity-[.55] sm:px-5">
        <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-canvas text-muted">
          <Icone nom="cadenas" taille={17} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block font-title text-[15px] font-extrabold text-navy">
            {intitule(j)}
          </b>
          {sousTitre(j) && (
            <span className="line-clamp-2 text-[13px] text-muted">{sousTitre(j)}</span>
          )}
        </span>
        <Compte ouvreLe={j.ouvre_le} />
      </div>
    )
  }

  return (
    <section
      className={`overflow-hidden rounded-[18px] bg-surface transition ${
        ouvertEtat
          ? 'border-[1.5px] border-accent/35 shadow-[0_10px_30px_rgba(232,108,70,.14)]'
          : 'border border-line shadow-card hover:border-accent/25'
      }`}
    >
      <button onClick={onToggle} className="flex w-full items-center gap-3.5 p-4 text-left sm:px-5">
        <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-accent font-title text-sm font-extrabold text-on-accent">
          {j.jour}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block font-title text-[15px] font-extrabold text-navy">
            {intitule(j)}
          </b>
          {sousTitre(j, ouvertEtat) && (
            <span className="line-clamp-2 text-[13px] text-muted">{sousTitre(j, ouvertEtat)}</span>
          )}
        </span>
        {j.capture_faite && (
          <Icone nom="valide" taille={17} className="flex-none text-success" />
        )}
        <span className="flex-none font-title text-lg font-bold text-accent">
          {ouvertEtat ? '−' : '+'}
        </span>
      </button>

      {ouvertEtat && <Contenu jour={j} onDepose={onDepose} secours={secours} />}
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

function Contenu({ jour: j, onDepose, secours }) {
  const etapes = etapesDe(j)
  return (
    <div className="border-t border-line p-4 sm:p-5">
      {j.resume && (
        <div className="mb-5">
          <p className="eyebrow text-accent">Ce qu'on construit aujourd'hui</p>
          <p className="mt-1.5 max-w-[68ch] text-[15px] leading-relaxed text-navy">{j.resume}</p>
        </div>
      )}

      {j.video_url && (
        <div className="aspect-video overflow-hidden rounded-[14px] bg-panel">
          <iframe
            src={lecteur(j.video_url)}
            title={`Jour ${j.jour}`}
            allow="fullscreen"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
      )}

      {etapes.length > 0 && <Etapes etapes={etapes} decale={!!j.video_url} />}

      {j.prompt && <Prompt titre={`Le prompt à coller dans ${OUTIL}`} texte={proprePrompt(j.prompt)} />}
      {j.prompt_2 && (
        <Prompt titre={j.prompt_2_titre || 'Le deuxième prompt'} texte={proprePrompt(j.prompt_2)} />
      )}

      {secours && j.prompt && (
        <a
          href="#secours"
          className="mt-3 inline-block text-[13px] font-semibold text-muted underline underline-offset-2 hover:text-navy"
        >
          Quelque chose ne marche pas ? Le prompt de secours est en bas de la page.
        </a>
      )}

      {j.consignes && (
        <div className="mt-5 flex gap-3 rounded-xl border-[1.5px] border-accent/45 bg-canvas p-4">
          <Icone nom="cible" taille={18} className="mt-0.5 flex-none text-accent" />
          <p className="text-sm">
            <b className="block font-title text-[14.5px] font-extrabold text-navy">Avant demain</b>
            <span className="mt-0.5 block whitespace-pre-line">{j.consignes}</span>
          </p>
        </div>
      )}

      {!j.video_url && !j.prompt && etapes.length === 0 && (
        <p className="text-sm text-muted">Le contenu de ce jour arrive très vite.</p>
      )}

      <Capture jour={j.jour} deja={j.capture_faite} onDepose={onDepose} />
    </div>
  )
}

/** Le bonus sous les sept jours : un prompt pour réparer, quel que soit le jour. */
function Secours({ prompt }) {
  return (
    <section id="secours" className="mt-3 scroll-mt-24 rounded-[18px] border border-line bg-surface p-4 shadow-card sm:p-5">
      <span className="eyebrow text-accent">Bonus</span>
      <h2 className="mt-1 font-title text-[17px] font-extrabold text-navy">Le prompt de secours</h2>
      <p className="mt-1.5 max-w-[62ch] text-sm">
        Si quelque chose ne marche plus, remplace le texte entre crochets par ce que tu vois, puis
        colle ce prompt dans {OUTIL}.
      </p>
      <Prompt titre="Le prompt de secours" texte={proprePrompt(prompt)} />
    </section>
  )
}

/** Les étapes du jour, numérotées et reliées : on voit d'un coup d'œil le chemin. */
function Etapes({ etapes, decale }) {
  return (
    <div className={`${decale ? 'mt-5' : ''} rounded-xl bg-canvas p-4 sm:p-5`}>
      <h3 className="font-title text-[15px] font-extrabold text-navy">
        Les étapes du jour
        <span className="ml-2 text-[13px] font-bold text-muted">{etapes.length}</span>
      </h3>
      <ol className="mt-4">
        {etapes.map((e, i) => (
          <li key={i} className="relative flex gap-3.5 pb-5 last:pb-0">
            {i < etapes.length - 1 && (
              <span aria-hidden="true" className="absolute bottom-0 left-[14px] top-8 w-px bg-line-strong" />
            )}
            <span className="grid h-[29px] w-[29px] flex-none place-items-center rounded-full border-[1.5px] border-accent/60 bg-surface font-title text-[12.5px] font-extrabold text-accent">
              {i + 1}
            </span>
            <p className="min-w-0 flex-1 whitespace-pre-line pt-[3px] text-[14.5px] leading-relaxed text-navy">
              {e}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
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

function Prompt({ titre, texte }) {
  const [copie, setCopie] = useState(false)

  function copier() {
    // execCommand d'abord : il passe sans demander d'autorisation, là où
    // l'API moderne peut rester bloquée selon le navigateur.
    const zone = document.createElement('textarea')
    zone.value = texte
    zone.style.position = 'fixed'
    zone.style.left = '-9999px'
    document.body.appendChild(zone)
    zone.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    document.body.removeChild(zone)

    const fini = () => {
      setCopie(true)
      setTimeout(() => setCopie(false), 2500)
    }
    if (ok) return fini()
    navigator.clipboard?.writeText(texte).then(fini, () => {})
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-title text-[15px] font-extrabold text-navy">{titre}</h3>
        <button onClick={copier} className={copie ? 'btn-ghost text-sm' : 'btn px-5 py-2.5 text-sm'}>
          <Icone nom={copie ? 'valide' : 'copier'} taille={16} epaisseur={copie ? 2.2 : 1.6} />
          {copie ? 'Copié' : 'Copier le prompt'}
        </button>
      </div>
      <pre className="mt-2.5 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-canvas p-4 font-mono text-xs leading-relaxed text-navy">
        {texte}
      </pre>
    </div>
  )
}
