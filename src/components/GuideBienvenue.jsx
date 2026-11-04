import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import Icone from './Icone.jsx'
import BlocPrompt from './BlocPrompt.jsx'
import { APP, MARQUE, OFFRE, OUTIL } from '../lib/marque'

const TOTAL = 4

/**
 * Le guide de bienvenue : trois cartes posées sur l'espace membre flouté.
 *
 * L'élève vient de créer son accès. Avant, il atterrissait sur la liste
 * des modules sans savoir par où commencer : il ne voyait pas que la
 * vidéo d'introduction était obligatoire, et il ignorait souvent qu'un
 * prompt l'attendait pour construire son outil. Les trois cartes disent
 * ces trois choses, dans l'ordre, une à la fois.
 *
 * La vidéo n'est pas obligatoire : c'est la fin du guide qui ouvre le
 * programme. Le seul passage obligé est la capture de l'outil, et
 * seulement pour qui dit ne pas avoir collé le prompt pendant l'appel.
 */
export default function GuideBienvenue({ etat, onFini }) {
  const [etape, setEtape] = useState(Math.min(etat.etape || 0, TOTAL - 1))

  // La base a le dernier mot : sans capture, elle refuse de passer le jour 0.
  const avancer = useCallback(async (suivante, promptRecu) => {
    const { error } = await supabase.rpc('guide_avancer', {
      p_etape: suivante,
      p_prompt_recu: promptRecu ?? null,
    })
    if (error) return
    setEtape(suivante)
  }, [])

  async function terminer() {
    await supabase.rpc('guide_termine')
    onFini()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/45 backdrop-blur-[6px]">
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
        <div className="card w-full max-w-xl p-7 shadow-[0_32px_80px_-24px_rgba(0,0,0,.55)] sm:p-9">
          <Compteur etape={etape} />

          {etape === 0 && <Bienvenue prenom={etat.prenom} onSuivant={() => avancer(1)} />}
          {etape === 1 && <JourZero prompt={etat.prompt_j0} onSuivant={() => avancer(2)} />}
          {etape === 2 && <Workshop onSuivant={() => avancer(3)} />}
          {etape === 3 && <Video lecons={etat.lecons_intro || []} onFini={terminer} />}
        </div>
      </div>
    </div>
  )
}

/* ---------- Le compteur, commun aux trois cartes ---------- */

function Compteur({ etape }) {
  return (
    <div className="flex items-center gap-3">
      <span className="eyebrow text-accent">
        Étape {etape + 1} / {TOTAL}
      </span>
      <span className="flex flex-1 gap-1.5">
        {Array.from({ length: TOTAL }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i <= etape ? 'bg-accent' : 'bg-line'
            }`}
          />
        ))}
      </span>
    </div>
  )
}

/* ---------- 1. La bienvenue ---------- */

function Bienvenue({ prenom, onSuivant }) {
  return (
    <>
      <h1 className="mt-5 text-[26px] leading-tight sm:text-3xl">
        Bienvenue dans ta formation
        <br />
        <span className="text-accent">{MARQUE} {OFFRE}</span>
        {prenom ? `, ${prenom}` : ''}.
      </h1>

      <p className="mt-4 text-[15px] leading-relaxed">
        Tu viens de passer le cap, et c'est déjà la partie que la plupart des gens ne
        franchissent jamais. À partir d'ici, tu n'es plus en train de te renseigner : tu
        construis.
      </p>

      <p className="mt-3 text-[15px] leading-relaxed">
        Ce guide prend quelques minutes. Il te fait créer la base de ton {APP}, te montre
        par où continuer, et te fait regarder la vidéo qui ouvre le programme.
        Ensuite, tout l'espace est à toi.
      </p>

      <button onClick={onSuivant} className="btn mt-7 w-full">
        Commencer
      </button>
    </>
  )
}

/* ---------- 2. Ton jour 0 ----------
   L'élève crée la base de son app dans Base44, puis dépose une capture.
   Sans capture, pas de suite : le bouton reste grisé, et la base refuse
   de toute façon d'avancer (guide_avancer). Les textes viennent du
   back-office (workshop_reglages.parcours.j0). */

const FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'heic']
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']

function JourZero({ prompt, onSuivant }) {
  const [t, setT] = useState(null)
  const [preuve, setPreuve] = useState(undefined) // undefined = on regarde
  const [apercu, setApercu] = useState(null)
  const [nomFichier, setNomFichier] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const [survol, setSurvol] = useState(false)
  const [indice, setIndice] = useState(false)
  const [suite, setSuite] = useState(false)
  const champ = useRef(null)

  useEffect(() => {
    supabase
      .from('workshop_reglages')
      .select('parcours')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setT(data?.parcours?.j0 || {}))
  }, [])

  // Revenu plus tard : l'étape est déjà validée, sa capture s'affiche.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: s }) => {
      const { data } = await supabase
        .from('preuves')
        .select('file_path, file_name')
        .eq('member_id', s.session.user.id)
        .maybeSingle()
      if (!data) return setPreuve(null)
      setPreuve(data)
      setNomFichier(data.file_name || '')
      const { data: u } = await supabase.storage.from('preuves').createSignedUrl(data.file_path, 3600)
      if (u?.signedUrl && !/\.hei[cf]$/i.test(data.file_path)) setApercu(u.signedUrl)
    })
  }, [])

  async function deposer(fichier) {
    if (!fichier || envoi) return
    setErreur('')
    setIndice(false)
    const ext = (fichier.name.split('.').pop() || '').toLowerCase()
    const typeOk = TYPES.includes(fichier.type) || (!fichier.type && FORMATS.includes(ext))
    if (!FORMATS.includes(ext) && !typeOk) return setErreur(t?.erreur_format)
    if (fichier.size > 10 * 1024 * 1024) return setErreur(t?.erreur_format)

    setEnvoi(true)
    try {
      const { data: s } = await supabase.auth.getSession()
      const membre = s.session.user.id
      const chemin = `${membre}/jour0-${Date.now()}.${FORMATS.includes(ext) ? ext : 'jpg'}`
      const { error: e1 } = await supabase.storage
        .from('preuves')
        .upload(chemin, fichier, { contentType: fichier.type || (ext === 'heic' ? 'image/heic' : undefined) })
      if (e1) throw e1
      const { error: e2 } = await supabase.from('preuves').upsert(
        {
          member_id: membre,
          file_path: chemin,
          file_name: fichier.name,
          taille: fichier.size,
          statut: 'deposee',
          motif: null,
        },
        { onConflict: 'member_id' },
      )
      if (e2) throw e2
      setPreuve({ file_path: chemin, file_name: fichier.name })
      setNomFichier(fichier.name)
      // Le HEIC ne s'affiche pas dans la plupart des navigateurs : on montre son nom.
      setApercu(/\.hei[cf]$/i.test(fichier.name) ? null : URL.createObjectURL(fichier))
    } catch {
      setErreur(t?.erreur_envoi)
    } finally {
      setEnvoi(false)
      if (champ.current) champ.current.value = ''
    }
  }

  async function continuer() {
    if (!preuve || suite) return
    setSuite(true)
    try {
      await onSuivant()
    } finally {
      setSuite(false)
    }
  }

  if (!t || preuve === undefined) return <p className="mt-6 text-sm text-muted">Chargement…</p>

  return (
    <>
      <h1 className="mt-5 text-[25px] leading-tight sm:text-[28px]">{t.titre}</h1>
      <p className="mt-3.5 text-[15px] leading-relaxed">{t.intro}</p>

      <ol className="mt-5 space-y-3">
        {(t.etapes || []).map((e, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-accent-pastel font-title text-[13px] font-extrabold text-accent">
              {i + 1}
            </span>
            <span className="pt-0.5 text-[14.5px] leading-relaxed text-navy">{e}</span>
          </li>
        ))}
      </ol>

      <p className="mt-4 rounded-xl bg-canvas px-4 py-3 text-[13.5px] leading-relaxed text-ink">{t.note}</p>

      <BlocPrompt texte={prompt || ''} libelle={t.bouton_copie} titre="Le prompt du jour 0" />

      {/* La capture */}
      <input
        ref={champ}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
        className="sr-only"
        onChange={(e) => deposer(e.target.files?.[0])}
      />
      {preuve ? (
        <div className="mt-6 rounded-2xl border border-success/30 bg-success-bg p-4">
          <div className="flex items-center gap-3.5">
            {apercu ? (
              <img src={apercu} alt="Ta capture" className="h-16 w-16 flex-none rounded-lg object-cover ring-1 ring-success/30" />
            ) : (
              <span className="grid h-16 w-16 flex-none place-items-center rounded-lg bg-surface text-success ring-1 ring-success/30">
                <Icone nom="valide" taille={24} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-bold text-success">{t.capture_ok}</p>
              {nomFichier && <p className="truncate text-[12.5px] text-success/80">{nomFichier}</p>}
              <button
                type="button"
                onClick={() => champ.current?.click()}
                disabled={envoi}
                className="mt-1 text-[13px] font-bold text-navy underline underline-offset-2 disabled:opacity-50"
              >
                {envoi ? 'Envoi…' : t.changer}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => champ.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setSurvol(true)
          }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => {
            e.preventDefault()
            setSurvol(false)
            deposer(e.dataTransfer.files?.[0])
          }}
          disabled={envoi}
          className={`mt-6 flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-5 py-8 text-center transition ${
            survol ? 'border-accent bg-accent-pastel' : 'border-line-strong bg-canvas hover:border-accent/60'
          }`}
        >
          <Icone nom="document" taille={26} className="text-accent" />
          <b className="font-title text-[15.5px] text-navy">{envoi ? 'Envoi…' : t.zone}</b>
          <span className="text-[13px] text-muted">{t.zone_sous}</span>
          <span className="text-[11.5px] text-muted">PNG, JPG, WEBP ou HEIC · 10 Mo max.</span>
        </button>
      )}
      {erreur && <p className="mt-2.5 text-sm font-semibold text-red-600">{erreur}</p>}

      {/* Un bouton désactivé ne reçoit ni survol ni toucher : l'enveloppe, si. */}
      <div
        className="mt-7"
        title={preuve ? undefined : t.bloque}
        onPointerDown={() => !preuve && setIndice(true)}
        onMouseEnter={() => !preuve && setIndice(true)}
        onMouseLeave={() => setIndice(false)}
      >
        <button
          onClick={continuer}
          disabled={!preuve || envoi || suite}
          className="btn w-full py-4 text-[15px] uppercase tracking-wide"
        >
          {suite ? 'En cours…' : t.bouton_final}
        </button>
      </div>
      {!preuve && indice && <p className="mt-2.5 text-center text-[13px] font-semibold text-accent">{t.bloque}</p>}
    </>
  )
}

/* ---------- 3. Le workshop ---------- */

function Workshop({ onSuivant }) {
  return (
    <>
      <h1 className="mt-5 text-[26px] leading-tight sm:text-3xl">
        Ton {APP} se construit
        <br />
        <span className="text-accent">en 7 jours</span>.
      </h1>

      <p className="mt-4 text-[15px] leading-relaxed">
        Chaque jour, un prompt à coller dans {OUTIL}. Et chaque jour, ton {APP} sait faire
        une chose de plus : calculer ta marge au prix Black Friday, te proposer tes offres,
        te donner ton planning jusqu'au 27 novembre, écrire tes pubs, tes mails et tes SMS.
      </p>

      <p className="mt-3 text-[15px] leading-relaxed">
        C'est pour ça qu'il faut revenir tous les jours : un jour sauté, c'est une étape qui
        manque à ton {APP}.
      </p>

      <div className="mt-5 rounded-2xl border-[1.5px] border-accent/60 bg-canvas p-5">
        <p className="font-title font-bold text-navy">Tes vidéos sont déjà ouvertes</p>
        <p className="mt-1.5 text-[15px] leading-relaxed">
          Tout ce que ta formule contient est accessible{' '}
          <b className="text-navy">dès aujourd'hui</b> : tu peux commencer dès ce soir.
        </p>
      </div>

      <button onClick={onSuivant} className="btn mt-7 w-full">
        Suivant
      </button>
    </>
  )
}

/* ---------- 4. La vidéo d'introduction ---------- */

function Video({ lecons, onFini }) {
  const [n, setN] = useState(0)
  const [source, setSource] = useState(null)
  const [erreur, setErreur] = useState(null)
  const cadre = useRef(null)

  const lecon = lecons[n]
  // S'il n'y a pas d'introduction en base, le guide ne doit pas enfermer
  // l'élève devant un cadre vide.
  const sansVideo = !lecon
  const derniere = n >= lecons.length - 1

  useEffect(() => {
    if (sansVideo) return
    setSource(null)
    setErreur(null)
    let vivant = true
    supabase.auth.getSession().then(async ({ data: s }) => {
      try {
        const res = await fetch(`/api/video-token?lessonId=${lecon.id}`, {
          headers: { Authorization: `Bearer ${s.session.access_token}` },
        })
        if (!vivant) return
        if (!res.ok) throw new Error('indisponible')
        setSource(await res.json())
      } catch {
        if (vivant) setErreur("La vidéo n'a pas pu être chargée.")
      }
    })
    return () => {
      vivant = false
    }
  }, [lecon, sansVideo])

  // Vimeo et Loom annoncent la fin par un message de la fenêtre. On
  // s'abonne auprès du lecteur, puis on écoute.
  useEffect(() => {
    if (source?.kind !== 'lecteur') return

    function abonner() {
      for (const value of ['ready', 'ended', 'finish']) {
        try {
          cadre.current?.contentWindow?.postMessage(
            JSON.stringify({ method: 'addEventListener', value }),
            '*',
          )
        } catch {
          /* le lecteur n'est pas encore prêt : le message suivant le trouvera */
        }
      }
    }

    function ecouter(e) {
      if (!/vimeo|loom/.test(e.origin)) return
      let d = e.data
      if (typeof d === 'string') {
        try {
          d = JSON.parse(d)
        } catch {
          return
        }
      }
      const nom = d?.event || d?.type
      if (nom === 'ready') return abonner()
      if (nom === 'ended' || nom === 'finish') marquerVue()
    }

    window.addEventListener('message', ecouter)
    const t = setTimeout(abonner, 1200)
    return () => {
      window.removeEventListener('message', ecouter)
      clearTimeout(t)
    }
  }, [source])

  // La vidéo n'ouvre plus rien, mais la regarder jusqu'au bout doit rester
  // visible dans la progression de l'élève.
  async function marquerVue() {
    if (!lecon) return
    const { data: s } = await supabase.auth.getSession()
    await supabase
      .from('lesson_progress')
      .upsert(
        { lesson_id: lecon.id, member_id: s.session.user.id },
        { onConflict: 'member_id,lesson_id', ignoreDuplicates: true },
      )
  }

  return (
    <>
      <h1 className="mt-5 text-[26px] leading-tight sm:text-3xl">
        {lecon?.title || 'Introduction au programme'}
      </h1>

      <p className="mt-4 text-[15px] leading-relaxed">
        Dernière étape : {lecons.length > 1 ? 'ces vidéos t\'expliquent' : "cette vidéo t'explique"}{' '}
        comment le programme est construit et dans quel ordre avancer. Prends le temps de
        {lecons.length > 1 ? ' les ' : ' la '}regarder — tu la retrouveras dans ton espace
        quand tu voudras.
      </p>

      {lecons.length > 1 && (
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-muted">
          Vidéo {n + 1} sur {lecons.length}
        </p>
      )}

      {!sansVideo && (
        <div className="mt-5 aspect-video overflow-hidden rounded-[18px] bg-panel">
          {source?.kind === 'lecteur' ? (
            <iframe
              key={source.url}
              ref={cadre}
              src={source.url}
              title={lecon.title}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          ) : source?.kind ? (
            <video
              key={source.url}
              src={source.url}
              controls
              controlsList="nodownload"
              onEnded={marquerVue}
              onContextMenu={(e) => e.preventDefault()}
              className="h-full w-full"
            />
          ) : (
            <div className="grid h-full place-items-center px-6 text-center text-sm text-[#DDE1E7]">
              {erreur || 'Préparation de la vidéo…'}
            </div>
          )}
        </div>
      )}

      <button onClick={onFini} className="btn mt-6 w-full">
        <Icone nom="fleche" className="h-4 w-4" />
        Accéder à mon espace membre
      </button>

      {lecons.length > 1 && !derniere && (
        <button
          onClick={() => setN(n + 1)}
          className="mx-auto mt-3 block text-xs font-semibold text-muted underline"
        >
          Passer à la vidéo suivante
        </button>
      )}
    </>
  )
}
